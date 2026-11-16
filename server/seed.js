// Demo dataset shared by `npm run db:seed` and the automatic first-boot setup.
// Works on a caller-supplied client and imports no config/pool, so both the CLI
// script and the running API can use it.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const rand = (n) => crypto.randomBytes(n).toString("hex");
const days = (n, h = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, 0, 0, 0);
  return d;
};

export const DEMO_ACCOUNTS = [
  ["admin@stagepass.test", "Admin@123", "Asha Admin", "admin"],
  ["customer@stagepass.test", "Customer@123", "Ravi Customer", "customer"],
  ["scanner@stagepass.test", "Scanner@123", "Sam Scanner", "scanner"],
  ["organizer@stagepass.test", "Organizer@123", "Ovi Organizer", "organizer"],
];

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
];

const EVENTS = [
  { v: 0, title: "Midnight Keys: Live Piano Night", category: "Music", inDays: 3, hours: 3, reentry: false, prices: { VIP: 2500, Standard: 900 } },
  { v: 0, title: "Laugh Lineup: Standup Showcase", category: "Comedy", inDays: 10, hours: 2.5, reentry: false, prices: { VIP: 1800, Standard: 700 } },
  { v: 1, title: "Neon Pulse Arena Tour", category: "Music", inDays: 17, hours: 4, reentry: true, prices: { Floor: 3500, Mezzanine: 1500 } },
  { v: 1, title: "FutureStack Dev Summit", category: "Tech", inDays: 24, hours: 8, reentry: true, prices: { Floor: 2800, Mezzanine: 1200 } },
];

/**
 * Inserts the demo dataset (4 users, 2 venues with seats, 4 events, tiers and a
 * few sample tickets). Pass `reset: true` to truncate the app tables first.
 */
export async function seedDemoData(client, { reset = false } = {}) {
  const c = client;
  await c.query("BEGIN");
  try {
    if (reset) {
      await c.query(`TRUNCATE audit_logs, refunds, scans, payments, tickets, seat_holds,
                     ticket_tiers, events, seats, venues, users RESTART IDENTITY CASCADE`);
    }

    // Users
    const hash = (p) => bcrypt.hashSync(p, 10);
    const userIds = {};
    for (const [email, password, name, role] of DEMO_ACCOUNTS) {
      const { rows } = await c.query(
        "INSERT INTO users(email,password_hash,full_name,role) VALUES ($1,$2,$3,$4) RETURNING id",
        [email, hash(password), name, role]
      );
      userIds[role] = rows[0].id;
    }

    // Venues + seats
    const venueIds = [];
    const seatsByTier = [];
    let seatCount = 0;
    for (const v of VENUES) {
      const capacity = v.sections.reduce((s, sec) => s + sec.rows.length * sec.perRow, 0);
      const { rows } = await c.query(
        "INSERT INTO venues(name,address,city,capacity) VALUES ($1,$2,$3,$4) RETURNING id",
        [v.name, v.address, v.city, capacity]
      );
      venueIds.push(rows[0].id);
      const tiers = {};
      for (const sec of v.sections) {
        for (const row of sec.rows) {
          for (let n = 1; n <= sec.perRow; n++) {
            await c.query(
              "INSERT INTO seats(venue_id,section,row_label,seat_number,tier_name) VALUES ($1,$2,$3,$4,$5)",
              [rows[0].id, sec.name, row, n, sec.tier]
            );
            (tiers[sec.tier] ??= []).push(`${sec.name}-${row}-${n}`);
            seatCount++;
          }
        }
      }
      seatsByTier.push(tiers);

      // Seeded venues were "created" by the admin — keep the audit trail realistic.
      await c.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data)
         VALUES ($1,'venue.created','venue',$2,$3)`,
        [userIds.admin, rows[0].id, JSON.stringify({ name: v.name, capacity })]
      );
    }

    // Events + tiers
    const eventIds = [];
    let tierCount = 0;
    for (const e of EVENTS) {
      const venueId = venueIds[e.v];
      const start = days(e.inDays);
      const end = new Date(start.getTime() + e.hours * 3600 * 1000);
      const { rows } = await c.query(
        `INSERT INTO events(venue_id,title,description,category,starts_at,ends_at,reentry_allowed,entry_gate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          venueId, e.title,
          `${e.title} — live at ${VENUES[e.v].name}, ${VENUES[e.v].city}. Doors open 30 minutes before showtime.`,
          e.category, start, end, e.reentry, e.reentry ? "GATE-A" : null,
        ]
      );
      eventIds.push(rows[0].id);
      for (const [tierName, price] of Object.entries(e.prices)) {
        const qty = seatsByTier[e.v][tierName]?.length ?? 50;
        await c.query(
          `INSERT INTO ticket_tiers(event_id,name,base_price,tax_rate,fee_amount,quantity,sales_start,sales_end)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [rows[0].id, tierName, price, 0.05, 40, qty, days(e.inDays - 14, 9), end]
        );
        tierCount++;
      }

      await c.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data)
         VALUES ($1,'event.created','event',$2,$3)`,
        [userIds.admin, rows[0].id, JSON.stringify({ title: e.title, venue_id: venueId })]
      );
    }

    // Sample paid tickets for the demo customer (nearest event, VIP seats A1-A3 + one used)
    const custId = userIds.customer;
    const ev0 = eventIds[0];
    const { rows: tierRows } = await c.query(
      "SELECT id,name,base_price,tax_rate,fee_amount FROM ticket_tiers WHERE event_id=$1", [ev0]
    );
    const { rows: seatRows } = await c.query(
      `SELECT s.id, s.tier_name FROM seats s
       JOIN events e ON e.venue_id = s.venue_id
       WHERE e.id=$1 AND s.section='VIP' AND s.row_label='A' AND s.seat_number<=3
       ORDER BY s.seat_number`, [ev0]
    );
    let i = 0;
    for (const seat of seatRows) {
      const tier = tierRows.find((t) => t.name === seat.tier_name) ?? tierRows[0];
      const base = Number(tier.base_price), tax = base * Number(tier.tax_rate), fee = Number(tier.fee_amount);
      const total = base + tax + fee;
      const status = i === 2 ? "used" : "active";
      const num = `TCK-${String(1000 + i)}`;
      const qr = `sp_${rand(16)}`;
      const { rows: t } = await c.query(
        `INSERT INTO tickets(event_id,seat_id,tier_id,user_id,ticket_number,qr_code,status,
           base_price,tax_amount,fee_amount,total_price,issued_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now()) RETURNING id`,
        [ev0, seat.id, tier.id, custId, num, qr, status, base, tax, fee, total]
      );
      const { rows: p } = await c.query(
        `INSERT INTO payments(ticket_id,user_id,method,amount,tax_amount,fee_amount,status,provider_ref)
         VALUES ($1,$2,'card',$3,$4,$5,'succeeded',$6) RETURNING id`,
        [t[0].id, custId, total, tax, fee, `demo_${rand(6)}`]
      );
      if (status === "used") {
        await c.query(
          `INSERT INTO scans(ticket_id,gate_id,scanned_by,result,reason)
           VALUES ($1,'GATE-A',$2,'granted',NULL)`,
          [t[0].id, userIds.scanner]
        );
      }
      await c.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data)
         VALUES ($1,'ticket.issued','ticket',$2,$3)`,
        [custId, t[0].id, JSON.stringify({ ticket_number: num, status })]
      );
      i++;
    }

    await c.query("COMMIT");
    return {
      users: DEMO_ACCOUNTS.length,
      venues: VENUES.length,
      seats: seatCount,
      events: EVENTS.length,
      tiers: tierCount,
      tickets: seatRows.length,
    };
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  }
}
