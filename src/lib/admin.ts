import { q, withTransaction } from "@/db/pool";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { generateQrCode, generateTicketNumber } from "@/lib/qr";
import type { SessionUser } from "@/lib/auth";

export async function adminStats() {
  const [revenue, tickets, events, scans, series] = await Promise.all([
    q<{ total: string }>(
      `SELECT COALESCE(SUM(amount),0)::text AS total FROM payments WHERE status = 'succeeded'`
    ),
    q<{ active: number; used: number; comped: number }>(
      `SELECT COUNT(*) FILTER (WHERE t.status='active')::int AS active,
              COUNT(*) FILTER (WHERE t.status='used')::int AS used,
              COUNT(*) FILTER (WHERE p.method='comp' )::int AS comped
       FROM tickets t LEFT JOIN payments p ON p.ticket_id = t.id`
    ),
    q<{ scheduled: number; cancelled: number }>(
      `SELECT COUNT(*) FILTER (WHERE status='scheduled')::int AS scheduled,
              COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled
       FROM events`
    ),
    q<{ today: number; granted: number; denied: number }>(
      `SELECT COUNT(*) FILTER (WHERE scanned_at::date = now()::date)::int AS today,
              COUNT(*) FILTER (WHERE result='granted')::int AS granted,
              COUNT(*) FILTER (WHERE result='denied')::int AS denied
       FROM scans`
    ),
    q<{ day: string; total: string }>(
      `SELECT d::date::text AS day, COALESCE(SUM(p.amount), 0)::text AS total
       FROM generate_series(now()::date - interval '13 days', now()::date, interval '1 day') d
       LEFT JOIN payments p ON p.created_at::date = d::date AND p.status='succeeded'
       GROUP BY d ORDER BY d`
    ),
  ]);
  return {
    revenue: revenue[0]?.total ?? "0",
    tickets: tickets[0] ?? { active: 0, used: 0, comped: 0 },
    events: events[0] ?? { scheduled: 0, cancelled: 0 },
    scans: scans[0] ?? { today: 0, granted: 0, denied: 0 },
    series,
  };
}

export async function occupancyByEvent() {
  return q(
    `SELECT e.id, e.title, e.starts_at, e.status, v.capacity,
            COUNT(t.id) FILTER (WHERE t.status IN ('active','used'))::int AS sold
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     LEFT JOIN tickets t ON t.event_id = e.id
     GROUP BY e.id, v.capacity
     ORDER BY e.starts_at`
  );
}

export async function listAllEvents() {
  return q(
    `SELECT e.id, e.title, e.category, e.status, e.starts_at, e.ends_at,
            v.name AS venue_name, v.city, v.id AS venue_id,
            (SELECT COUNT(*)::int FROM tickets t WHERE t.event_id = e.id AND t.status IN ('active','used')) AS sold,
            (SELECT COUNT(*)::int FROM ticket_tiers tt WHERE tt.event_id = e.id) AS tier_count
     FROM events e JOIN venues v ON v.id = e.venue_id
     ORDER BY e.starts_at DESC`
  );
}

export async function listUsers() {
  return q(
    `SELECT u.id, u.email, u.full_name, u.role, u.created_at,
            (SELECT COUNT(*)::int FROM tickets t WHERE t.user_id = u.id AND t.status IN ('active','used')) AS ticket_count
     FROM users u ORDER BY u.id`
  );
}

export async function listAuditLogs(limit = 100) {
  return q(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_data, a.new_data, a.created_at,
            u.full_name AS actor
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function listRefunds() {
  return q(
    `SELECT r.id, r.amount, r.status, r.reason, r.created_at, u.full_name AS customer, e.title AS event
     FROM refunds r
     JOIN payments p ON p.id = r.payment_id
     JOIN tickets t ON t.id = p.ticket_id
     JOIN events e ON e.id = t.event_id
     JOIN users u ON u.id = p.user_id
     ORDER BY r.created_at DESC LIMIT 50`
  );
}

export interface EventInput {
  venue_id: number;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  reentry_allowed: boolean;
  entry_gate?: string | null;
  tiers: { name: string; base_price: number; tax_rate: number; fee_amount: number; quantity: number }[];
}

export async function createEvent(actor: SessionUser, input: EventInput) {
  const starts = new Date(input.starts_at);
  const ends = new Date(input.ends_at);
  if (!(starts < ends)) throw new ApiError(422, "End time must be after start time"); // Rule 1
  const venue = await q(`SELECT id, capacity FROM venues WHERE id = $1`, [input.venue_id]);
  if (!venue[0]) throw new ApiError(404, "Venue not found"); // Rule 1

  return withTransaction(async (tx) => {
    const ev = await tx.query<{ id: number }>(
      `INSERT INTO events(venue_id, title, description, category, starts_at, ends_at, reentry_allowed, entry_gate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [input.venue_id, input.title, input.description, input.category, starts, ends, input.reentry_allowed, input.entry_gate ?? null]
    );
    const eventId = ev[0].id;
    for (const t of input.tiers) {
      await tx.query(
        `INSERT INTO ticket_tiers(event_id, name, base_price, tax_rate, fee_amount, quantity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [eventId, t.name, t.base_price, t.tax_rate, t.fee_amount, t.quantity]
      );
    }
    await audit(actor, "event.created", "event", eventId, input);
    return eventId;
  });
}

export async function updateEventStatus(actor: SessionUser, eventId: number, status: "scheduled" | "completed") {
  const ev = await q<{ status: string }>(`SELECT status FROM events WHERE id = $1`, [eventId]);
  if (!ev[0]) throw new ApiError(404, "Event not found");
  if (ev[0].status === "cancelled") throw new ApiError(409, "Cancelled events cannot be reopened");
  await q(`UPDATE events SET status=$2 WHERE id=$1`, [eventId, status]);
  await audit(actor, "event.status_changed", "event", eventId, { status });
}

/** Cancel event: close sales + refund every succeeded payment (Rule 8). */
export async function cancelEvent(actor: SessionUser, eventId: number, reason: string) {
  const result = await withTransaction(async (tx) => {
    const ev = await tx.query<{ status: string; title: string }>(
      `SELECT status, title FROM events WHERE id = $1 FOR UPDATE`, [eventId]
    );
    if (!ev[0]) throw new ApiError(404, "Event not found");
    if (ev[0].status === "cancelled") throw new ApiError(409, "Event is already cancelled");

    await tx.query(`UPDATE events SET status='cancelled' WHERE id=$1`, [eventId]);
    await tx.query(`DELETE FROM seat_holds WHERE event_id=$1`, [eventId]);
    await tx.query(
      `UPDATE tickets SET status='cancelled' WHERE event_id=$1 AND status IN ('pending','active')`,
      [eventId]
    );

    const payRows = await tx.query<{ id: number; amount: string }>(
      `SELECT p.id, p.amount FROM payments p
       JOIN tickets t ON t.id = p.ticket_id
       WHERE t.event_id=$1 AND p.status='succeeded'`,
      [eventId]
    );
    let refundTotal = 0;
    for (const p of payRows) {
      await tx.query(
        `INSERT INTO refunds(payment_id, amount, status, reason) VALUES ($1,$2,'processed',$3)`,
        [p.id, p.amount, reason]
      );
      await tx.query(`UPDATE payments SET status='refunded' WHERE id=$1`, [p.id]);
      refundTotal += Number(p.amount);
    }
    return { title: ev[0].title, refunds: payRows.length, refundTotal };
  });
  await audit(actor, "event.cancelled", "event", eventId, { reason, ...result }); // Rule 10
  return result;
}

/** Complimentary ticket issuance (Rule 5: valid via authorized comp 'payment'). */
export async function compTicket(actor: SessionUser, eventId: number, seatId: number, customerEmail: string) {
  const ticket = await withTransaction(async (tx) => {
    const [ev] = await tx.query<{ status: string }>(`SELECT status FROM events WHERE id=$1 FOR UPDATE`, [eventId]);
    if (!ev || ev.status !== "scheduled") throw new ApiError(409, "Event is not open");
    const seat = await tx.query<{ id: number; section: string; row_label: string; seat_number: number; tier_name: string }>(
      `SELECT id, section, row_label, seat_number, tier_name FROM seats WHERE id=$1`,
      [seatId]
    );
    if (!seat[0]) throw new ApiError(404, "Seat not found");
    const busy = await tx.query(
      `SELECT 1 FROM tickets WHERE event_id=$1 AND seat_id=$2 AND status IN ('pending','active','used')
       UNION ALL SELECT 1 FROM seat_holds WHERE event_id=$1 AND seat_id=$2 AND expires_at > now() LIMIT 1`,
      [eventId, seatId]
    );
    if (busy[0]) throw new ApiError(409, "Seat is not available");
    const [cust] = await tx.query<{ id: number }>(
      `SELECT id FROM users WHERE email=$1 AND role IN ('customer','organizer')`,
      [customerEmail]
    );
    if (!cust) throw new ApiError(404, "Customer not found with that email");

    const tier = await tx.query<{ id: number; base_price: string; tax_rate: string; fee_amount: string }>(
      `SELECT id, base_price, tax_rate, fee_amount FROM ticket_tiers
       WHERE event_id=$1 AND name=$2 LIMIT 1`,
      [eventId, seat[0].tier_name]
    );
    if (!tier[0]) throw new ApiError(400, "No matching tier for that seat");

    const base = Number(tier[0].base_price);
    const tax = base * Number(tier[0].tax_rate);
    const fee = Number(tier[0].fee_amount);
    const total = base + tax + fee;

    const [t] = await tx.query<{ id: number; ticket_number: string; qr_code: string }>(
      `INSERT INTO tickets(event_id, seat_id, tier_id, user_id, ticket_number, qr_code, status,
         base_price, tax_amount, fee_amount, total_price)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10) RETURNING id, ticket_number, qr_code`,
      [eventId, seatId, tier[0].id, cust.id, generateTicketNumber(), generateQrCode(), 0, tax, fee, total]
    );
    const [p] = await tx.query<{ id: number }>(
      `INSERT INTO payments(ticket_id, user_id, method, amount, tax_amount, fee_amount, status, provider_ref)
       VALUES ($1,$2,'comp',0,$3,$4,'succeeded','comp_authorized')`,
      [t.id, cust.id, tax, fee]
    );
    return { ...t, seat: seat[0], payment_id: p.id };
  });
  await audit(actor, "ticket.comp_issued", "ticket", ticket.id, { ...ticket }); // Rule 5 + 10
  return ticket;
}

export async function createVenue(
  actor: SessionUser,
  input: { name: string; address: string; city: string; sections: { name: string; tier: string; rows: string[]; perRow: number }[] }
) {
  const capacity = input.sections.reduce((s, sec) => s + sec.rows.length * sec.perRow, 0);
  if (capacity <= 0) throw new ApiError(422, "Venue must have at least one seat");
  const v = await withTransaction(async (tx) => {
    const [venue] = await tx.query<{ id: number }>(
      `INSERT INTO venues(name, address, city, capacity) VALUES ($1,$2,$3,$4) RETURNING id`,
      [input.name, input.address, input.city, capacity]
    );
    for (const sec of input.sections) {
      for (const row of sec.rows) {
        for (let n = 1; n <= sec.perRow; n++) {
          await tx.query(
            `INSERT INTO seats(venue_id, section, row_label, seat_number, tier_name)
             VALUES ($1,$2,$3,$4,$5)`,
            [venue.id, sec.name, row, n, sec.tier || sec.name]
          );
        }
      }
    }
    return venue;
  });
  await audit(actor, "venue.created", "venue", v.id, { name: input.name, capacity }); // Rule 2 rows created under UNIQUE guard
  return v;
}
