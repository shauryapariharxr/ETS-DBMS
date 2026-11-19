// Creates (or promotes) the staff accounts from ADMIN_* and SCANNER_* variables.
// Used by `npm run db:admin`; the API runs the same bootstrap at boot (server/setup.js).
import { ensureAdminAccount, ensureScannerAccount } from "../server/bootstrap.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD, SCANNER_EMAIL, SCANNER_PASSWORD } from "../server/config.js";
import { pool } from "../server/db.js";

if (!ADMIN_EMAIL && !SCANNER_EMAIL) {
  console.error(
    "[db:admin] Set ADMIN_EMAIL/ADMIN_PASSWORD (and optionally SCANNER_EMAIL/SCANNER_PASSWORD) in .env."
  );
  process.exit(1);
}

const log = (message) => console.log(message);
const client = await pool.connect();
try {
  if (ADMIN_EMAIL && ADMIN_PASSWORD) await ensureAdminAccount(client, { log });
  else log("[db:admin] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin");
  if (SCANNER_EMAIL && SCANNER_PASSWORD) await ensureScannerAccount(client, { log });
  else log("[db:admin] SCANNER_EMAIL/SCANNER_PASSWORD not set — skipping scanner");
} catch (error) {
  console.error(`[db:admin] ${error.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
