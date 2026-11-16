// Seeds demo data: users, venues with seat layouts, events, tiers, sample tickets.
// Idempotent: truncates all app tables first.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !m[1].startsWith("#") && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rand = (n) => crypto.randomBytes(n).toString("hex");
const days = (n, h = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, 0, 0, 0);
  return d;
};

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

async function main() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`TRUNCATE audit_logs, refunds, scans, payments, tickets, seat_holds,
                   ticket_tiers, events, seats, venues, users RESTART IDENTITY CASCADE`);

    // Users
    const hash = (p) => bcrypt.hashSync(p, 10);
    const users = [
      ["admin@stagepass.test", hash("Admin@123"), "Asha Admin", "admin"],
      ["customer@stagepass.test", hash("Customer@123"), "Ravi Customer", "customer"],
      ["scanner@stagepass.test", hash("Scanner@123"), "Sam Scanner", "scanner"],
      ["organizer@stagepass.test", hash("Organizer@123"), "Ovi Organizer", "organizer"],
    ];
    const userIds = {};
    for (const [email, ph, name, role] of users) {
      const { rows } = await c.query(
        "INSERT INTO users(email,password_hash,full_name,role) VALUES ($1,$2,$3,$4) RETURNING id",
        [email, ph, name, role]
      );
      userIds[role] = rows[0].id;
    }

    // Venues + seats
    const venueIds = [];
    const seatsByTier = [];
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
      }

      await c.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data)
         VALUES ($1,'event.created','event',$2,$3)`,
        [userIds.admin, rows[0].id, JSON.stringify({ title: e.title, venue_id: venueId })]
      );
    }

    // Sample paid tickets for the demo customer (nearest event, VIP seats A1-A2 + one used)
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
    console.log("Seed complete: 4 users, 2 venues, 188 seats, 4 events, 8 tiers, 3 sample tickets.");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
