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

  const { rows } = await client.query(
    "SELECT id, role, password_hash FROM users WHERE email = $1",
    [normalized]
  );

  if (rows.length > 0) {
    const account = rows[0];
    const assignments = [];
    const values = [];

    if (account.role !== role) {
      assignments.push(`role = $${values.length + 1}`);
      values.push(role);
    }

    // The environment is the source of truth for staff credentials. If the
    // dashboard password is corrected, the next boot must make it work instead
    // of silently keeping the hash from the very first deploy — otherwise the
    // documented admin login answers "Invalid email or password".
    let passwordMatches = false;
    if (account.password_hash) {
      try {
        passwordMatches = await bcrypt.compare(secret, account.password_hash);
      } catch {
        passwordMatches = false;
      }
    }
    if (!passwordMatches) {
      assignments.push(`password_hash = $${values.length + 1}`);
      values.push(await bcrypt.hash(secret, 10));
    }

    if (assignments.length > 0) {
      values.push(account.id);
      await client.query(
        `UPDATE users SET ${assignments.join(", ")} WHERE id = $${values.length}`,
        values
      );
      log(`[setup] ${role} account synced from environment: ${normalized}`);
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
