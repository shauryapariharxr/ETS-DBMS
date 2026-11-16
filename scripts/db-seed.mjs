// Seeds demo data: users, venues with seat layouts, events, tiers, sample tickets.
// Idempotent: truncates all app tables first.
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
    const s = await seedDemoData(client, { reset: true });
    console.log(
      `Seed complete: ${s.users} users, ${s.venues} venues, ${s.seats} seats, ` +
        `${s.events} events, ${s.tiers} tiers, ${s.tickets} sample tickets.`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
