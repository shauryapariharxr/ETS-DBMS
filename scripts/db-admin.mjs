// Creates (or promotes) the admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
// Used by `npm run db:admin`, and mirrored by the boot-time bootstrap.
import { ensureAdminAccount } from "../server/bootstrap.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../server/config.js";
import { pool } from "../server/db.js";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "[db:admin] Set ADMIN_EMAIL and ADMIN_PASSWORD in .env (password: at least 8 characters)."
  );
  process.exit(1);
}

const client = await pool.connect();
try {
  await ensureAdminAccount(client, { log: (message) => console.log(message) });
} catch (error) {
  console.error(`[db:admin] ${error.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
