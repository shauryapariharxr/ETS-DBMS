// Production bootstrap: the first admin account, created from environment
// variables instead of shipping demo users with the code.
//
//   ADMIN_EMAIL     e.g. you@yourdomain.com
//   ADMIN_PASSWORD  at least 8 characters (hashed with bcrypt, never stored raw)
//   ADMIN_NAME      optional display name, defaults to "Administrator"
//
// Idempotent: if the account already exists it is only promoted to the admin
// role, so restarts and extra replicas are safe.
import bcrypt from "bcryptjs";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./config.js";

const MIN_PASSWORD_LENGTH = 8;

export async function ensureAdminAccount(client, { log = console.log } = {}) {
  const email = (ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    log("[setup] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin bootstrap");
    return { created: false, skipped: true };
  }
  if (!email.includes("@")) {
    throw new Error("ADMIN_EMAIL does not look like an email address");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const { rows } = await client.query("SELECT id, role FROM users WHERE email = $1", [email]);

  if (rows.length > 0) {
    if (rows[0].role !== "admin") {
      await client.query("UPDATE users SET role = 'admin' WHERE id = $1", [rows[0].id]);
      log(`[setup] admin account promoted: ${email}`);
    } else {
      log(`[setup] admin account already present: ${email}`);
    }
    return { created: false, skipped: false, email };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const fullName = (process.env.ADMIN_NAME ?? "").trim() || "Administrator";

  await client.query(
    `INSERT INTO users(email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin')`,
    [email, passwordHash, fullName]
  );

  log(`[setup] admin account created: ${email}`);
  return { created: true, skipped: false, email };
}
