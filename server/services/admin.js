import { q, withTransaction } from "../db.js";
import { ApiError } from "../errors.js";
import { audit } from "../audit.js";
import { hashPassword } from "../auth.js";
import { generateQrCode, generateTicketNumber } from "../qr.js";

export const ROLES = ["customer", "organizer", "admin", "scanner"];

/** Dashboard counts and summaries (requirement: admin dashboard). */
export async function adminStats() {
  const [revenue, tickets, events, scans, series] = await Promise.all([
    q(`SELECT COALESCE(SUM(amount),0)::text AS total FROM payments WHERE status = 'succeeded'`),
    q(
      `SELECT COUNT(*) FILTER (WHERE t.status='active')::int AS active,
              COUNT(*) FILTER (WHERE t.status='used')::int AS used,
              COUNT(*) FILTER (WHERE p.method='comp')::int AS comped
       FROM tickets t LEFT JOIN payments p ON p.ticket_id = t.id`
    ),
    q(
      `SELECT COUNT(*) FILTER (WHERE status='scheduled')::int AS scheduled,
              COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled
       FROM events`
    ),
    q(
      `SELECT COUNT(*) FILTER (WHERE scanned_at::date = now()::date)::int AS today,
              COUNT(*) FILTER (WHERE result='granted')::int AS granted,
              COUNT(*) FILTER (WHERE result='denied')::int AS denied
       FROM scans`
    ),
    q(
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

export async function listAllEvents({ search, status, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.title ILIKE $${params.length} OR v.name ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const events = await q(
    `SELECT e.id, e.title, e.category, e.status, e.starts_at, e.ends_at, e.banner_url,
            v.name AS venue_name, v.city, v.id AS venue_id,
            (SELECT COUNT(*)::int FROM tickets t
              WHERE t.event_id = e.id AND t.status IN ('active','used')) AS sold,
            (SELECT COUNT(*)::int FROM ticket_tiers tt WHERE tt.event_id = e.id) AS tier_count
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     ${where}
     ORDER BY e.starts_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const [totals] = await q(
    `SELECT COUNT(*)::int AS total FROM events e JOIN venues v ON v.id = e.venue_id ${where}`,
    params
  );
  const total = totals?.total ?? 0;
  return { events, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Users list with ticket counts, search, role filter and pagination. */
export async function listUsers({ search, role, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (role) {
    params.push(role);
    conditions.push(`u.role = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const users = await q(
    `SELECT u.id, u.email, u.full_name, u.role, u.created_at,
            (SELECT COUNT(*)::int FROM tickets t
              WHERE t.user_id = u.id AND t.status IN ('active','used')) AS ticket_count
     FROM users u
     ${where}
     ORDER BY u.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const [totals] = await q(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params);
  const total = totals?.total ?? 0;
  return { users, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function createUser(actor, input) {
  if (!ROLES.includes(input.role)) {
    throw new ApiError(422, `Role must be one of ${ROLES.join(", ")}`, "INVALID_ROLE");
  }
  const email = input.email.toLowerCase();
  const [existing] = await q(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing) throw new ApiError(409, "An account with that email already exists", "EMAIL_TAKEN");

  const [user] = await q(
    `INSERT INTO users(email, password_hash, full_name, role)
     VALUES ($1,$2,$3,$4) RETURNING id, email, full_name, role, created_at`,
    [email, await hashPassword(input.password), input.full_name, input.role]
  );

  await audit(actor, "user.created", "user", user.id, { email, role: user.role });
  return user;
}

export async function updateUser(actor, userId, input) {
  const [current] = await q(`SELECT id, email, full_name, role FROM users WHERE id = $1`, [userId]);
  if (!current) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

  if (input.role !== undefined && !ROLES.includes(input.role)) {
    throw new ApiError(422, `Role must be one of ${ROLES.join(", ")}`, "INVALID_ROLE");
  }
  if (input.role && input.role !== current.role && current.role === "admin") {
    const [admins] = await q(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`);
    if (admins.count <= 1) {
      throw new ApiError(409, "At least one admin account must remain", "LAST_ADMIN");
    }
  }

  const [user] = await q(
    `UPDATE users SET full_name = $2, role = $3 WHERE id = $1
     RETURNING id, email, full_name, role, created_at`,
    [userId, input.full_name ?? current.full_name, input.role ?? current.role]
  );

  await audit(actor, "user.updated", "user", userId, user, current);
  return user;
}

export async function deleteUser(actor, userId) {
  if (actor.id === userId) {
    throw new ApiError(409, "You cannot delete your own admin account", "SELF_DELETE");
  }
  const [user] = await q(`SELECT id, email, role FROM users WHERE id = $1`, [userId]);
  if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

  const [refs] = await q(
    `SELECT (SELECT COUNT(*)::int FROM tickets WHERE user_id = $1) AS tickets,
            (SELECT COUNT(*)::int FROM payments WHERE user_id = $1) AS payments,
            (SELECT COUNT(*)::int FROM audit_logs WHERE actor_id = $1) AS audit`,
    [userId]
  );
  if (refs.tickets > 0 || refs.payments > 0 || refs.audit > 0) {
    throw new ApiError(
      409,
      "This account has tickets, payments or audit history and cannot be deleted",
      "USER_HAS_HISTORY"
    );
  }

  await q(`DELETE FROM users WHERE id = $1`, [userId]);
  await audit(actor, "user.deleted", "user", userId, null, { email: user.email });
  return user;
}

export async function listAuditLogs({ search, action, page = 1, limit = 100 } = {}) {
  const conditions = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(a.action ILIKE $${params.length} OR a.entity_type ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`
    );
  }
  if (action) {
    params.push(action);
    conditions.push(`a.action = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const logs = await q(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_data, a.new_data, a.created_at,
            u.full_name AS actor
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const [totals] = await q(
    `SELECT COUNT(*)::int AS total FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${where}`,
    params
  );
  const total = totals?.total ?? 0;
  return { logs, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function listRefunds(limit = 50) {
  return q(
    `SELECT r.id, r.amount, r.status, r.reason, r.created_at,
            u.full_name AS customer, e.title AS event
     FROM refunds r
     JOIN payments p ON p.id = r.payment_id
     JOIN tickets t ON t.id = p.ticket_id
     JOIN events e ON e.id = t.event_id
     JOIN users u ON u.id = p.user_id
     ORDER BY r.created_at DESC
     LIMIT $1`,
    [limit]
  );
}

/** Cancel event: close sales and refund every succeeded payment (rule 8). */
export async function cancelEvent(actor, eventId, reason) {
  const result = await withTransaction(async (tx) => {
    const [event] = await tx.query(`SELECT status, title FROM events WHERE id = $1 FOR UPDATE`, [
      eventId,
    ]);
    if (!event) throw new ApiError(404, "Event not found", "EVENT_NOT_FOUND");
    if (event.status === "cancelled") {
      throw new ApiError(409, "Event is already cancelled", "ALREADY_CANCELLED");
    }

    await tx.query(`UPDATE events SET status = 'cancelled' WHERE id = $1`, [eventId]);
    await tx.query(`DELETE FROM seat_holds WHERE event_id = $1`, [eventId]);
    await tx.query(
      `UPDATE tickets SET status = 'cancelled'
       WHERE event_id = $1 AND status IN ('pending','active')`,
      [eventId]
    );

    const payments = await tx.query(
      `SELECT p.id, p.amount FROM payments p
       JOIN tickets t ON t.id = p.ticket_id
       WHERE t.event_id = $1 AND p.status = 'succeeded'`,
      [eventId]
    );

    let refundTotal = 0;
    for (const payment of payments) {
      await tx.query(
        `INSERT INTO refunds(payment_id, amount, status, reason) VALUES ($1,$2,'processed',$3)`,
        [payment.id, payment.amount, reason]
      );
      await tx.query(`UPDATE payments SET status = 'refunded' WHERE id = $1`, [payment.id]);
      refundTotal += Number(payment.amount);
    }

    return { title: event.title, refunds: payments.length, refundTotal };
  });

  await audit(actor, "event.cancelled", "event", eventId, { reason, ...result }); // rule 10
  return result;
}

/** Complimentary ticket issuance (rule 5: valid via an authorized comp payment). */
export async function compTicket(actor, eventId, seatId, customerEmail) {
  const ticket = await withTransaction(async (tx) => {
    const [event] = await tx.query(`SELECT status FROM events WHERE id = $1 FOR UPDATE`, [eventId]);
    if (!event || event.status !== "scheduled") {
      throw new ApiError(409, "Event is not open", "SALES_CLOSED");
    }

    const [seat] = await tx.query(
      `SELECT id, section, row_label, seat_number, tier_name FROM seats WHERE id = $1`,
      [seatId]
    );
    if (!seat) throw new ApiError(404, "Seat not found", "SEAT_NOT_FOUND");

    const [busy] = await tx.query(
      `SELECT 1 FROM tickets
        WHERE event_id = $1 AND seat_id = $2 AND status IN ('pending','active','used')
       UNION ALL
       SELECT 1 FROM seat_holds
        WHERE event_id = $1 AND seat_id = $2 AND expires_at > now()
       LIMIT 1`,
      [eventId, seatId]
    );
    if (busy) throw new ApiError(409, "Seat is not available", "SEAT_TAKEN");

    const [customer] = await tx.query(
      `SELECT id FROM users WHERE email = $1 AND role IN ('customer','organizer')`,
      [customerEmail.toLowerCase()]
    );
    if (!customer) throw new ApiError(404, "Customer not found with that email", "CUSTOMER_NOT_FOUND");

    const [tier] = await tx.query(
      `SELECT id, base_price, tax_rate, fee_amount FROM ticket_tiers
       WHERE event_id = $1 AND name = $2 LIMIT 1`,
      [eventId, seat.tier_name]
    );
    if (!tier) throw new ApiError(400, "No matching tier for that seat", "TIER_MISSING");

    const base = Number(tier.base_price);
    const tax = base * Number(tier.tax_rate);
    const fee = Number(tier.fee_amount);
    const total = base + tax + fee;

    const [created] = await tx.query(
      `INSERT INTO tickets(event_id, seat_id, tier_id, user_id, ticket_number, qr_code, status,
         base_price, tax_amount, fee_amount, total_price)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10)
       RETURNING id, ticket_number, qr_code`,
      [
        eventId,
        seatId,
        tier.id,
        customer.id,
        generateTicketNumber(),
        generateQrCode(),
        0,
        tax,
        fee,
        total,
      ]
    );

    const [payment] = await tx.query(
      `INSERT INTO payments(ticket_id, user_id, method, amount, tax_amount, fee_amount, status, provider_ref)
       VALUES ($1,$2,'comp',0,$3,$4,'succeeded','comp_authorized') RETURNING id`,
      [created.id, customer.id, tax, fee]
    );

    return { ...created, seat, payment_id: payment.id };
  });

  await audit(actor, "ticket.comp_issued", "ticket", ticket.id, { ...ticket }); // rules 5 + 10
  return ticket;
}
