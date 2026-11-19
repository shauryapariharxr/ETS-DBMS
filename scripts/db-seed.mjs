// Seeds demo data: users, venues with seat layouts, events, tiers, sample tickets.
// Idempotent: clears the app tables first, but keeps the configured admin account
// (ADMIN_EMAIL in .env) so seeding never locks you out of the admin UI.
import { readFileSync } from "node:fs";
import pg from "pg";
import { seedDemoData } from "../server/seed.js";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !m[1].startsWith("#") && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const keepEmails = [process.env.ADMIN_EMAIL];
    const s = await seedDemoData(client, { reset: true, keepEmails });
    console.log(
      `Seed complete: ${s.users} users, ${s.venues} venues, ${s.seats} seats, ` +
        `${s.events} events, ${s.tiers} tiers, ${s.tickets} sample tickets.`
    );
    const kept = keepEmails.filter(Boolean);
    if (kept.length) console.log(`Preserved admin account(s): ${kept.join(", ")}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
