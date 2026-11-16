import { q, withTransaction } from "../db.js";
import { ApiError } from "../errors.js";
import { audit } from "../audit.js";

export async function listVenues() {
  return q(
    `SELECT v.id, v.name, v.address, v.city, v.capacity,
            COUNT(DISTINCT s.section)::int AS sections,
            COUNT(s.id)::int AS seats
     FROM venues v
     LEFT JOIN seats s ON s.venue_id = v.id
     GROUP BY v.id
     ORDER BY v.id`
  );
}

export async function getVenue(id) {
  const [venue] = await q(
    `SELECT v.id, v.name, v.address, v.city, v.capacity,
            (SELECT COUNT(*)::int FROM seats s WHERE s.venue_id = v.id) AS seats,
            (SELECT COUNT(DISTINCT s.section)::int FROM seats s WHERE s.venue_id = v.id) AS sections
     FROM venues v WHERE v.id = $1`,
    [id]
  );
  if (!venue) return null;

  const sections = await q(
    `SELECT section, tier_name,
            COUNT(*)::int AS seats,
            COUNT(DISTINCT row_label)::int AS rows
     FROM seats WHERE venue_id = $1
     GROUP BY section, tier_name
     ORDER BY section`,
    [id]
  );
  return { ...venue, section_detail: sections };
}

/** Creates a venue and every seat of its layout in one transaction (rule 2). */
export async function createVenue(actor, input) {
  const capacity = input.sections.reduce(
    (sum, section) => sum + section.rows.length * section.perRow,
    0
  );
  if (capacity <= 0) throw new ApiError(422, "Venue must have at least one seat", "EMPTY_LAYOUT");

  const venue = await withTransaction(async (tx) => {
    const [created] = await tx.query(
      `INSERT INTO venues(name, address, city, capacity) VALUES ($1,$2,$3,$4) RETURNING id`,
      [input.name, input.address, input.city, capacity]
    );

    for (const section of input.sections) {
      for (const row of section.rows) {
        for (let seatNumber = 1; seatNumber <= section.perRow; seatNumber += 1) {
          await tx.query(
            `INSERT INTO seats(venue_id, section, row_label, seat_number, tier_name)
             VALUES ($1,$2,$3,$4,$5)`,
            [created.id, section.name, row, seatNumber, section.tier || section.name]
          );
        }
      }
    }

    return created;
  });

  await audit(actor, "venue.created", "venue", venue.id, { name: input.name, capacity });
  return getVenue(venue.id);
}

/** Updates venue metadata; capacity is always re-derived from the seat rows. */
export async function updateVenue(actor, venueId, input) {
  const [current] = await q(`SELECT id, name, address, city FROM venues WHERE id = $1`, [venueId]);
  if (!current) throw new ApiError(404, "Venue not found", "VENUE_NOT_FOUND");

  const [venue] = await q(
    `UPDATE venues
        SET name = $2,
            address = $3,
            city = $4,
            capacity = (SELECT GREATEST(COUNT(*), 1)::int FROM seats WHERE venue_id = $1)
      WHERE id = $1
      RETURNING id, name, address, city, capacity`,
    [
      venueId,
      input.name ?? current.name,
      input.address ?? current.address,
      input.city ?? current.city,
    ]
  );

  await audit(actor, "venue.updated", "venue", venueId, input, current);
  return getVenue(venue.id);
}

/** Deletes a venue only when no event references it. */
export async function deleteVenue(actor, venueId) {
  const [event] = await q(`SELECT COUNT(*)::int AS count FROM events WHERE venue_id = $1`, [venueId]);
  if (event.count > 0) {
    throw new ApiError(409, "Venue has events scheduled — remove or move them first", "VENUE_IN_USE");
  }
  const deleted = await q(`DELETE FROM venues WHERE id = $1 RETURNING id, name`, [venueId]);
  if (!deleted[0]) throw new ApiError(404, "Venue not found", "VENUE_NOT_FOUND");

  await audit(actor, "venue.deleted", "venue", venueId, null, { name: deleted[0].name });
  return deleted[0];
}

export async function getVenueSeats(venueId) {
  return q(
    `SELECT id, section, row_label, seat_number, tier_name
     FROM seats WHERE venue_id = $1
     ORDER BY section, row_label, seat_number`,
    [venueId]
  );
}
