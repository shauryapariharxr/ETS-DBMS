// Boot-time database bootstrap so a fresh deployment works with zero manual steps.
//
//   DB_AUTO_MIGRATE=true  → apply pending SQL migrations from src/db/migrations
//   ADMIN_EMAIL/ADMIN_PASSWORD → create (or promote) the first admin account
//
// The flag is off locally (see .env.example) and switched on by render.yaml.
// A session advisory lock serialises concurrent instances, and every step is
// idempotent, so restarts and extra replicas are safe.
import { AUTO_MIGRATE } from "./config.js";
import { ensureAdminAccount } from "./bootstrap.js";
import { pool } from "./db.js";
import { runMigrations } from "./migrations.js";

const SETUP_LOCK_KEY = 748392615;

export async function ensureDatabaseSchema() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1::bigint)", [SETUP_LOCK_KEY]);

    // The admin bootstrap needs the tables, so migrations run whenever either
    // the flag is on or admin credentials are configured.
    if (AUTO_MIGRATE) {
      const result = await runMigrations(client, {
        log: (message) => console.log(`[setup] ${message}`),
      });
      console.log(
        `[setup] schema ready (${result.applied} new migration(s), ${result.total} total)`
      );
    }

    await ensureAdminAccount(client);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1::bigint)", [SETUP_LOCK_KEY]).catch(() => {});
    client.release();
  }
}
