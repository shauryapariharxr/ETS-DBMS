// Production bootstrap: staff accounts created from environment variables instead
// of shipping demo users with the code.
//
//   ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME     role: admin   (full console)
//   SCANNER_EMAIL / SCANNER_PASSWORD / SCANNER_NAME   role: scanner (gate + /scan)
//
// Passwords are bcrypt-hashed, never stored raw, and must be at least 8 characters.
// Idempotent: an existing account is only promoted to the wanted role, so restarts
// and extra replicas are safe.
import bcrypt from "bcryptjs";
import { ADMIN_EMAIL, ADMIN_PASSWORD, SCANNER_EMAIL, SCANNER_PASSWORD } from "./config.js";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Creates `email` with `role`, or promotes the existing account to it.
 * Skips quietly when the credentials are not configured.
 */
export async function ensureAccount(
  client,
  { email, password, name, role, log = console.log, label = "account" }
) {
  const normalized = String(email ?? "").trim().toLowerCase();
  const secret = password ?? "";

  if (!normalized || !secret) {
    log(`[setup] ${label} credentials not set — skipping ${role} bootstrap`);
    return { created: false, skipped: true };
  }
  if (!normalized.includes("@")) {
    throw new Error(`${role} email does not look like an email address`);
  }
  if (secret.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${role} password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const { rows } = await client.query("SELECT id, role FROM users WHERE email = $1", [normalized]);

  if (rows.length > 0) {
    if (rows[0].role !== role) {
      await client.query("UPDATE users SET role = $1 WHERE id = $2", [role, rows[0].id]);
      log(`[setup] ${role} account promoted: ${normalized}`);
    } else {
      log(`[setup] ${role} account already present: ${normalized}`);
    }
    return { created: false, skipped: false, email: normalized };
  }

  const passwordHash = await bcrypt.hash(secret, 10);
  const fullName = String(name ?? "").trim() || (role === "admin" ? "Administrator" : "Gate staff");

  await client.query(
    `INSERT INTO users(email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)`,
    [normalized, passwordHash, fullName, role]
  );

  log(`[setup] ${role} account created: ${normalized}`);
  return { created: true, skipped: false, email: normalized };
}

export async function ensureAdminAccount(client, options = {}) {
  return ensureAccount(client, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME,
    role: "admin",
    label: "ADMIN_EMAIL/ADMIN_PASSWORD",
    ...options,
  });
}

export async function ensureScannerAccount(client, options = {}) {
  return ensureAccount(client, {
    email: SCANNER_EMAIL,
    password: SCANNER_PASSWORD,
    name: process.env.SCANNER_NAME,
    role: "scanner",
    label: "SCANNER_EMAIL/SCANNER_PASSWORD",
    ...options,
  });
}
