import { q, withTransaction } from "../db.js";
import { ApiError } from "../errors.js";
import { audit } from "../audit.js";

const EVENT_STATUSES = ["scheduled", "cancelled", "completed"];
const SORT_COLUMNS = { starts_at: "e.starts_at", title: "e.title", id: "e.id" };

/**
 * Event list with search, filters, sorting and pagination.
 * Powers the storefront grid (search/filter/pagination requirement).
 */
export async function listEvents({
  search,
  city,
  category,
  status,
  includeAll = false,
  page = 1,
  limit = 12,
  sort = "starts_at",
  order = "asc",
} = {}) {
  const conditions = [];
  const params = [];

  if (!includeAll) conditions.push("e.status = 'scheduled' AND e.ends_at > now()");
  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
  }
  if (city) {
    params.push(city);
    conditions.push(`v.city = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`e.category = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortColumn = SORT_COLUMNS[sort] ?? SORT_COLUMNS.starts_at;
  const direction = order === "desc" ? "DESC" : "ASC";
  const offset = (page - 1) * limit;

  // JOIN across events + venues, with per-event aggregates for pricing and sales.
  const events = await q(
    `SELECT e.id, e.title, e.description, e.category, e.starts_at, e.ends_at, e.status,
            e.banner_url, v.name AS venue_name, v.city,
            (SELECT MIN(tt.base_price) FROM ticket_tiers tt WHERE tt.event_id = e.id) AS min_price,
            (SELECT COUNT(*)::int FROM tickets t
              WHERE t.event_id = e.id AND t.status IN ('active','used')) AS tickets_sold,
            v.capacity
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     ${where}
     ORDER BY ${sortColumn} ${direction}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const [totals] = await q(
    `SELECT COUNT(*)::int AS total FROM events e JOIN venues v ON v.id = e.venue_id ${where}`,
    params
  );
  const total = totals?.total ?? 0;

  return {
    events,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Event detail including its ticket tiers and live availability. */
export async function getEvent(id) {
  const [event] = await q(
    `SELECT e.id, e.title, e.description, e.category, e.starts_at, e.ends_at, e.status,
            e.reentry_allowed, e.entry_gate, e.banner_url, e.venue_id,
            v.name AS venue_name, v.address AS venue_address, v.city, v.capacity,
            (SELECT COUNT(*)::int FROM tickets t
              WHERE t.event_id = e.id AND t.status IN ('active','used')) AS tickets_sold
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     WHERE e.id = $1`,
    [id]
  );
  if (!event) return null;

  const tiers = await q(
    `SELECT tt.id, tt.name, tt.base_price, tt.tax_rate, tt.fee_amount, tt.quantity,
            (SELECT COUNT(*)::int FROM tickets t
              WHERE t.tier_id = tt.id AND t.status IN ('active','used')) AS sold
     FROM ticket_tiers tt
     WHERE tt.event_id = $1
     ORDER BY tt.base_price DESC`,
    [id]
  );

  return { ...event, tiers };
}

export async function listCities() {
  return q(`SELECT DISTINCT city FROM venues ORDER BY city`);
}

export async function createEvent(actor, input) {
  const starts = new Date(input.starts_at);
  const ends = new Date(input.ends_at);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    throw new ApiError(422, "Start and end times must be valid dates", "INVALID_DATE");
  }
  if (!(starts < ends)) throw new ApiError(422, "End time must be after start time", "INVALID_TIME_RANGE");

  const [venue] = await q(`SELECT id, capacity FROM venues WHERE id = $1`, [input.venue_id]);
  if (!venue) throw new ApiError(404, "Venue not found", "VENUE_NOT_FOUND");

  const eventId = await withTransaction(async (tx) => {
    const [event] = await tx.query(
      `INSERT INTO events(venue_id, title, description, category, starts_at, ends_at,
         reentry_allowed, entry_gate, banner_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        input.venue_id,
        input.title,
        input.description ?? "",
        input.category ?? "Music",
        starts,
        ends,
        Boolean(input.reentry_allowed),
        input.entry_gate || null,
        input.banner_url || null,
      ]
    );

    for (const tier of input.tiers) {
      await tx.query(
        `INSERT INTO ticket_tiers(event_id, name, base_price, tax_rate, fee_amount, quantity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [event.id, tier.name, tier.base_price, tier.tax_rate, tier.fee_amount, tier.quantity]
      );
    }

    await audit(actor, "event.created", "event", event.id, input);
    return event.id;
  });

  return getEvent(eventId);
}

/** Partial update: only the supplied fields change. */
export async function updateEvent(actor, eventId, input) {
  const [current] = await q(`SELECT * FROM events WHERE id = $1`, [eventId]);
  if (!current) throw new ApiError(404, "Event not found", "EVENT_NOT_FOUND");

  const startsAt = input.starts_at ? new Date(input.starts_at) : new Date(current.starts_at);
  const endsAt = input.ends_at ? new Date(input.ends_at) : new Date(current.ends_at);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new ApiError(422, "Start and end times must be valid dates", "INVALID_DATE");
  }
  if (!(startsAt < endsAt)) {
    throw new ApiError(422, "End time must be after start time", "INVALID_TIME_RANGE");
  }

  const venueId = input.venue_id ?? Number(current.venue_id);
  if (input.venue_id !== undefined) {
    const [venue] = await q(`SELECT id FROM venues WHERE id = $1`, [venueId]);
    if (!venue) throw new ApiError(404, "Venue not found", "VENUE_NOT_FOUND");
  }

  const status = input.status ?? current.status;
  if (!EVENT_STATUSES.includes(status)) {
    throw new ApiError(422, `Status must be one of ${EVENT_STATUSES.join(", ")}`, "INVALID_STATUS");
  }
  if (current.status === "cancelled" && status !== "cancelled") {
    throw new ApiError(409, "Cancelled events cannot be reopened", "EVENT_CANCELLED");
  }

  await q(
    `UPDATE events
        SET venue_id = $2, title = $3, description = $4, category = $5,
            starts_at = $6, ends_at = $7, reentry_allowed = $8, entry_gate = $9,
            banner_url = $10, status = $11
      WHERE id = $1`,
    [
      eventId,
      venueId,
      input.title ?? current.title,
      input.description ?? current.description,
      input.category ?? current.category,
      startsAt,
      endsAt,
      input.reentry_allowed ?? current.reentry_allowed,
      input.entry_gate !== undefined ? input.entry_gate || null : current.entry_gate,
      input.banner_url !== undefined ? input.banner_url || null : current.banner_url,
      status,
    ]
  );

  await audit(
    actor,
    "event.updated",
    "event",
    eventId,
    { title: input.title ?? current.title, status, starts_at: startsAt, ends_at: endsAt },
    { title: current.title, status: current.status }
  );

  return getEvent(eventId);
}

/** Hard delete, only while the event has no tickets (otherwise cancel + refund). */
export async function deleteEvent(actor, eventId) {
  const deleted = await withTransaction(async (tx) => {
    const [event] = await tx.query(`SELECT id, title, status FROM events WHERE id = $1 FOR UPDATE`, [
      eventId,
    ]);
    if (!event) throw new ApiError(404, "Event not found", "EVENT_NOT_FOUND");

    const [sales] = await tx.query(`SELECT COUNT(*)::int AS count FROM tickets WHERE event_id = $1`, [
      eventId,
    ]);
    if (sales.count > 0) {
      throw new ApiError(
        409,
        "This event already has tickets — cancel it instead of deleting",
        "EVENT_HAS_TICKETS"
      );
    }

    await tx.query(`DELETE FROM seat_holds WHERE event_id = $1`, [eventId]);
    await tx.query(`DELETE FROM events WHERE id = $1`, [eventId]);
    return event;
  });

  await audit(actor, "event.deleted", "event", eventId, null, { title: deleted.title });
  return deleted;
}

/** Seat map with live state for one event. */
export async function getSeatMap(eventId) {
  const [event] = await q(`SELECT venue_id FROM events WHERE id = $1`, [eventId]);
  if (!event) return null;

  return q(
    `SELECT s.id, s.section, s.row_label, s.seat_number, s.tier_name,
            CASE
              WHEN t.id IS NOT NULL THEN 'sold'
              WHEN h.id IS NOT NULL THEN 'held'
              ELSE 'available'
            END AS state
     FROM seats s
     LEFT JOIN seat_holds h
       ON h.seat_id = s.id AND h.event_id = $1 AND h.expires_at > now()
     LEFT JOIN tickets t
       ON t.seat_id = s.id AND t.event_id = $1 AND t.status IN ('pending','active','used')
     WHERE s.venue_id = $2
     ORDER BY s.section, s.row_label, s.seat_number`,
    [eventId, event.venue_id]
  );
}
