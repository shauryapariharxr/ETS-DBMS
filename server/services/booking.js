import { q, withTransaction } from "../db.js";
import { ApiError } from "../errors.js";
import { audit } from "../audit.js";
import { generateQrCode, generateTicketNumber } from "../qr.js";
import { HOLD_MINUTES } from "../config.js";

/** Release expired holds and stale pending tickets (rule 9). Safe to call often. */
export async function sweepExpired() {
  return withTransaction(async (tx) => {
    const holds = await tx.query(
      `DELETE FROM seat_holds WHERE expires_at <= now() RETURNING event_id, seat_id`
    );
    const pendings = await tx.query(
      `UPDATE tickets SET status = 'cancelled'
       WHERE status = 'pending' AND issued_at < now() - interval '15 minutes'
       RETURNING id`
    );
    return { holds: holds.length, pendings: pendings.length };
  });
}

/** Holds seats for a user until expires_at (rule 9). */
export async function holdSeats(user, eventId, seatIds) {
  return withTransaction(async (tx) => {
    const [event] = await tx.query(`SELECT id, status FROM events WHERE id = $1 FOR UPDATE`, [
      eventId,
    ]);
    if (!event) throw new ApiError(404, "Event not found", "EVENT_NOT_FOUND");
    if (event.status !== "scheduled") {
      throw new ApiError(409, "Event is not open for sale", "SALES_CLOSED"); // rule 8
    }

    const seats = await tx.query(
      `SELECT s.*, e.id AS event_id
       FROM seats s
       JOIN events e ON e.venue_id = s.venue_id
       WHERE s.id = ANY($1::bigint[]) AND e.id = $2`,
      [seatIds, eventId]
    );
    if (seats.length !== seatIds.length) {
      throw new ApiError(400, "Some seats do not belong to this event's venue", "SEAT_MISMATCH");
    }

    const expires = new Date(Date.now() + HOLD_MINUTES * 60_000);
    const holdIds = [];

    for (const seat of seats) {
      const conflict = await tx.query(
        `SELECT 'hold' AS kind FROM seat_holds
          WHERE event_id = $1 AND seat_id = $2 AND expires_at > now()
         UNION ALL
         SELECT 'ticket' FROM tickets
          WHERE event_id = $1 AND seat_id = $2 AND status IN ('pending','active','used')
         LIMIT 1`,
        [eventId, seat.id]
      );
      if (conflict[0]) {
        throw new ApiError(
          409,
          `Seat ${seat.section}-${seat.row_label}${seat.seat_number} is no longer available`,
          "SEAT_TAKEN" // rule 3
        );
      }

      const inserted = await tx.query(
        `INSERT INTO seat_holds(event_id, seat_id, user_id, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id, seat_id) DO UPDATE
           SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at
         WHERE seat_holds.user_id = $3 AND seat_holds.expires_at <= now()
         RETURNING id`,
        [eventId, seat.id, user.id, expires]
      );
      if (!inserted[0]) {
        throw new ApiError(
          409,
          `Seat ${seat.section}-${seat.row_label}${seat.seat_number} is held by another session`,
          "SEAT_HELD"
        );
      }
      holdIds.push(inserted[0].id);
    }

    await audit(user, "holds.created", "event", eventId, { seat_ids: seatIds, expires });
    return { hold_ids: holdIds, expires_at: expires.toISOString() };
  });
}

export async function releaseHolds(user, holdIds) {
  const rows = await q(
    `DELETE FROM seat_holds WHERE id = ANY($1::bigint[]) AND user_id = $2 RETURNING id`,
    [holdIds, user.id]
  );
  return rows.length;
}

export async function listHolds(userId) {
  return q(
    `SELECT h.id, h.event_id, h.seat_id, h.expires_at,
            e.title AS event_title, s.section, s.row_label, s.seat_number, s.tier_name
     FROM seat_holds h
     JOIN events e ON e.id = h.event_id
     JOIN seats s ON s.id = h.seat_id
     WHERE h.user_id = $1 AND h.expires_at > now()
     ORDER BY h.expires_at`,
    [userId]
  );
}

/**
 * Atomic checkout: validates holds, snapshots prices (rule 4), records the payment
 * and activates the tickets in a single transaction (rules 3, 5, 6).
 */
export async function checkout(user, holdIds, method, cardLast4) {
  return withTransaction(async (tx) => {
    const holds = await tx.query(
      `SELECT id, event_id, seat_id, expires_at FROM seat_holds
       WHERE id = ANY($1::bigint[]) AND user_id = $2 FOR UPDATE`,
      [holdIds, user.id]
    );
    if (holds.length !== holdIds.length) {
      throw new ApiError(409, "Some holds are missing — please select seats again", "HOLD_GONE");
    }

    const now = Date.now();
    for (const hold of holds) {
      if (new Date(hold.expires_at).getTime() <= now) {
        throw new ApiError(409, "Your seat hold expired — please select seats again", "HOLD_EXPIRED");
      }
    }

    const eventId = holds[0].event_id;
    if (holds.some((hold) => hold.event_id !== eventId)) {
      throw new ApiError(400, "All seats in an order must belong to the same event", "MIXED_EVENTS");
    }

    const [event] = await tx.query(`SELECT status FROM events WHERE id = $1 FOR UPDATE`, [eventId]);
    if (!event || event.status !== "scheduled") {
      throw new ApiError(409, "Event is not open for sale", "SALES_CLOSED"); // rule 8
    }

    const priced = await tx.query(
      `WITH seat_tier AS (
         SELECT s.id AS seat_id,
                (SELECT t.id FROM ticket_tiers t
                  WHERE t.event_id = $2 AND t.name = s.tier_name
                  LIMIT 1) AS tier_id
         FROM seats s
         JOIN events e ON e.venue_id = s.venue_id
         WHERE s.id = ANY($1::bigint[]) AND e.id = $2
       )
       SELECT st.seat_id, tt.id AS tier_id, tt.base_price, tt.tax_rate, tt.fee_amount
       FROM seat_tier st
       JOIN ticket_tiers tt ON tt.id = st.tier_id`,
      [holds.map((hold) => hold.seat_id), eventId]
    );
    if (priced.length !== holds.length) {
      throw new ApiError(400, "Pricing unavailable for one or more seats", "PRICING_MISSING");
    }

    const mockDeclined = method === "card" && cardLast4 === "0002";
    if (mockDeclined) throw new ApiError(402, "Payment declined by provider", "PAYMENT_DECLINED");

    const tickets = [];
    const paymentIds = [];

    for (const price of priced) {
      const base = Number(price.base_price);
      const tax = Math.round(base * Number(price.tax_rate) * 100) / 100;
      const fee = Number(price.fee_amount);
      const total = base + tax + fee;

      const [ticket] = await tx.query(
        `INSERT INTO tickets(event_id, seat_id, tier_id, user_id, ticket_number, qr_code,
           status, base_price, tax_amount, fee_amount, total_price)
         VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10)
         RETURNING id, event_id, seat_id, ticket_number, qr_code, status,
                   base_price, tax_amount, fee_amount, total_price`,
        [
          eventId,
          price.seat_id,
          price.tier_id,
          user.id,
          generateTicketNumber(),
          generateQrCode(),
          base,
          tax,
          fee,
          total,
        ]
      );

      // rule 5: payment row and 'active' status commit together.
      const [payment] = await tx.query(
        `INSERT INTO payments(ticket_id, user_id, method, amount, tax_amount, fee_amount,
           status, provider_ref)
         VALUES ($1,$2,$3,$4,$5,$6,'succeeded',$7) RETURNING id`,
        [ticket.id, user.id, method, total, tax, fee, `mock_${Date.now()}`]
      );

      tickets.push(ticket);
      paymentIds.push(payment.id);
    }

    await tx.query(`DELETE FROM seat_holds WHERE id = ANY($1::bigint[])`, [holdIds]);

    await audit(user, "sale.completed", "event", eventId, {
      ticket_ids: tickets.map((ticket) => ticket.id),
      payment_ids: paymentIds,
      total: tickets.reduce((sum, ticket) => sum + Number(ticket.total_price), 0),
    });

    return tickets;
  });
}

export async function listMyTickets(userId) {
  return q(
    `SELECT t.id, t.ticket_number, t.qr_code, t.status, e.id AS event_id,
            e.title AS event_title, e.starts_at, v.name AS venue_name, v.city,
            s.section, s.row_label, s.seat_number, s.tier_name, t.total_price
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     JOIN venues v ON v.id = e.venue_id
     JOIN seats s ON s.id = t.seat_id
     WHERE t.user_id = $1
     ORDER BY e.starts_at DESC`,
    [userId]
  );
}

/** Transfers an active ticket to another account (audited). */
export async function transferTicket(actor, ticketId, toEmail) {
  const [ticket] = await q(`SELECT id, status, user_id FROM tickets WHERE id = $1 AND user_id = $2`, [
    ticketId,
    actor.id,
  ]);
  if (!ticket) throw new ApiError(404, "Ticket not found among your tickets", "TICKET_NOT_FOUND");
  if (ticket.status !== "active") {
    throw new ApiError(409, "Only active tickets can be transferred", "TICKET_NOT_ACTIVE");
  }

  const [recipient] = await q(`SELECT id, email FROM users WHERE email = $1`, [toEmail.toLowerCase()]);
  if (!recipient) throw new ApiError(404, "No user found with that email", "RECIPIENT_NOT_FOUND");
  if (recipient.id === actor.id) {
    throw new ApiError(400, "Cannot transfer a ticket to yourself", "SELF_TRANSFER");
  }

  await q(`UPDATE tickets SET user_id = $2 WHERE id = $1`, [ticketId, recipient.id]);
  await audit(actor, "ticket.transferred", "ticket", ticketId, { to: recipient.email });
  return { transferred: true, to: recipient.email };
}
