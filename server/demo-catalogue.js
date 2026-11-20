// Demo catalogue for an empty database.
//
// The product ships with no data of its own: a fresh deployment has an empty
// events table until an admin creates venues and events. For the course demo we
// want the storefront to have something to show on first boot, so this module
// inserts a small catalogue of venues, seats, events and price tiers ONCE, only
// when the events table is empty. It never creates user accounts and never
// touches data that already exists, and it can be switched off with
// SEED_DEMO_DATA=false (see server/config.js and server/setup.js).
import { SEED_DEMO_DATA } from "./config.js";

const VENUES = [
  {
    name: "Aurora Grand Theatre",
    address: "12 Marine Drive",
    city: "Mumbai",
    sections: [
      { name: "VIP", tier: "VIP", rows: ["A", "B"], perRow: 10 },
      { name: "Stalls", tier: "Standard", rows: ["C", "D", "E", "F"], perRow: 12 },
    ],
  },
  {
    name: "Skyline Arena",
    address: "88 Stadium Road",
    city: "Pune",
    sections: [
      { name: "Floor", tier: "Floor", rows: ["A", "B", "C", "D"], perRow: 14 },
      { name: "Mezzanine", tier: "Mezzanine", rows: ["E", "F", "G", "H"], perRow: 16 },
    ],
  },
  {
    name: "The Grand Balcony",
    address: "5 Connaught Place",
    city: "Delhi",
    sections: [
      { name: "Balcony", tier: "Balcony", rows: ["A", "B", "C"], perRow: 12 },
      { name: "Dress Circle", tier: "Dress Circle", rows: ["D", "E", "F"], perRow: 10 },
    ],
  },
];

const EVENTS = [
  {
    venue: 0,
    title: "Midnight Keys — Live Piano Night",
    category: "Music",
    inDays: 3,
    hours: 2.5,
    reentry: false,
    banner: "/covers/midnight-keys.jpg",
    blurb:
      "An intimate evening of original piano compositions and reimagined classics, performed under a single spotlight with a live string quartet.",
    prices: { VIP: 2500, Standard: 900 },
  },
  {
    venue: 0,
    title: "Laugh Lineup — Standup Showcase",
    category: "Comedy",
    inDays: 10,
    hours: 2,
    reentry: false,
    banner: "/covers/laugh-lineup.jpg",
    blurb:
      "Four comics, one mic and zero filters. A fast-paced showcase of new material from the city's sharpest standup voices.",
    prices: { VIP: 1800, Standard: 700 },
  },
  {
    venue: 1,
    title: "Neon Pulse — Arena Tour",
    category: "Music",
    inDays: 17,
    hours: 3.5,
    reentry: true,
    banner: "/covers/neon-pulse.jpg",
    blurb:
      "A full-scale electronic live set with a 360° light rig, custom visuals and a floor built for dancing.",
    prices: { Floor: 3500, Mezzanine: 1500 },
  },
  {
    venue: 1,
    title: "FutureStack Dev Summit",
    category: "Tech",
    inDays: 24,
    hours: 8,
    reentry: true,
    banner: "/covers/futurestack.jpg",
    blurb:
      "A full-day developer conference on databases, distributed systems and shipping reliable software at scale.",
    prices: { Floor: 2800, Mezzanine: 1200 },
  },
  {
    venue: 2,
    title: "Rangmanch — The Last Act",
    category: "Theatre",
    inDays: 31,
    hours: 2.5,
    reentry: false,
    banner: "/covers/rangmanch.jpg",
    blurb:
      "A two-act stage drama about a theatre company staging its final performance, told across three generations.",
    prices: { Balcony: 1200, "Dress Circle": 2000 },
  },
  {
    venue: 2,
    title: "Courtside Classic — Finals Night",
    category: "Sports",
    inDays: 38,
    hours: 3,
    reentry: false,
    banner: "/covers/courtside.jpg",
    blurb:
      "The season finale under the lights. Courtside seating, a live scoreboard and a post-match trophy presentation.",
    prices: { Balcony: 900, "Dress Circle": 1600 },
  },
];

/** Showtime at 19:00 local time, `days` from now. */
function showtime(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(19, 0, 0, 0);
  return d;
}

function salesOpen(days) {
  const d = showtime(days);
  d.setDate(d.getDate() - 14);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Inserts the demo catalogue when the events table is empty.
 * Safe to call on every boot: it returns `{ seeded: false }` and changes nothing
 * as soon as a single event exists.
 */
export async function seedDemoCatalogue(client) {
  if (!SEED_DEMO_DATA) return { seeded: false, skipped: true };

  const { rows } = await client.query("SELECT count(*)::int AS n FROM events");
  if (rows[0].n > 0) return { seeded: false, events: rows[0].n };

  const admin = await client.query(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
  );
  const actorId = admin.rows[0]?.id ?? null;

  await client.query("BEGIN");
  try {
    const venueIds = [];
    const seatsByTier = [];
    let seatCount = 0;

    for (const v of VENUES) {
      const capacity = v.sections.reduce((sum, s) => sum + s.rows.length * s.perRow, 0);
      const { rows: venueRows } = await client.query(
        "INSERT INTO venues(name,address,city,capacity) VALUES ($1,$2,$3,$4) RETURNING id",
        [v.name, v.address, v.city, capacity]
      );
      venueIds.push(venueRows[0].id);

      const tiers = {};
      for (const section of v.sections) {
        for (const row of section.rows) {
          for (let n = 1; n <= section.perRow; n++) {
            await client.query(
              "INSERT INTO seats(venue_id,section,row_label,seat_number,tier_name) VALUES ($1,$2,$3,$4,$5)",
              [venueRows[0].id, section.name, row, n, section.tier]
            );
            (tiers[section.tier] ??= []).push(`${section.name}-${row}-${n}`);
            seatCount++;
          }
        }
      }
      seatsByTier.push(tiers);

      await client.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data)
         VALUES ($1,'venue.created','venue',$2,$3)`,
        [actorId, venueRows[0].id, JSON.stringify({ name: v.name, capacity })]
      );
    }

    let tierCount = 0;
    for (const e of EVENTS) {
      const venue = VENUES[e.venue];
      const start = showtime(e.inDays);
      const end = new Date(start.getTime() + e.hours * 3600 * 1000);

      const { rows: eventRows } = await client.query(
        `INSERT INTO events(venue_id,title,description,category,starts_at,ends_at,reentry_allowed,entry_gate,banner_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          venueIds[e.venue],
          e.title,
          `${e.blurb} Live at ${venue.name}, ${venue.city}. Doors open 30 minutes before showtime.`,
          e.category,
          start,
          end,
          e.reentry,
          e.reentry ? "GATE-A" : null,
          e.banner ?? null,
        ]
      );

      for (const [tierName, price] of Object.entries(e.prices)) {
        const quantity = seatsByTier[e.venue][tierName]?.length ?? 40;
        await client.query(
          `INSERT INTO ticket_tiers(event_id,name,base_price,tax_rate,fee_amount,quantity,sales_start,sales_end)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [eventRows[0].id, tierName, price, 0.05, 40, quantity, salesOpen(e.inDays), end]
        );
        tierCount++;
      }

      await client.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data)
         VALUES ($1,'event.created','event',$2,$3)`,
        [actorId, eventRows[0].id, JSON.stringify({ title: e.title, source: "demo-catalogue" })]
      );
    }

    await client.query("COMMIT");
    return { seeded: true, venues: VENUES.length, seats: seatCount, events: EVENTS.length, tiers: tierCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
