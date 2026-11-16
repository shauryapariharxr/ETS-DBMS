// Boot-time database bootstrap so a fresh deployment works with zero manual steps.
//
//   DB_AUTO_MIGRATE=true  → apply pending SQL migrations from src/db/migrations
//   DB_AUTO_SEED=true     → insert the demo dataset when the users table is empty
//
// Both flags are off locally (see .env.example) and switched on by render.yaml.
// A session advisory lock serialises concurrent instances, and every step is
// idempotent, so restarts and extra replicas are safe.
import { AUTO_MIGRATE, AUTO_SEED } from "./config.js";
import { pool } from "./db.js";
import { runMigrations } from "./migrations.js";
import { seedDemoData } from "./seed.js";

const SETUP_LOCK_KEY = 748392615;

export async function ensureDatabaseSchema() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1::bigint)", [SETUP_LOCK_KEY]);

    // Seeding needs the tables, so migrations always run when either flag is on.
    if (AUTO_MIGRATE || AUTO_SEED) {
      const result = await runMigrations(client, {
        log: (message) => console.log(`[setup] ${message}`),
      });
      console.log(
        `[setup] schema ready (${result.applied} new migration(s), ${result.total} total)`
      );
    }

    if (AUTO_SEED) {
      const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM users");
      if (rows[0].count === 0) {
        const stats = await seedDemoData(client);
        console.log(
          `[setup] demo data seeded: ${stats.users} users, ${stats.venues} venues, ` +
            `${stats.seats} seats, ${stats.events} events, ${stats.tiers} tiers, ${stats.tickets} tickets`
        );
      } else {
        console.log(`[setup] ${rows[0].count} user(s) already present — skipping demo seed`);
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1::bigint)", [SETUP_LOCK_KEY]).catch(() => {});
    client.release();
  }
}
