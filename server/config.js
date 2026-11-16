import "dotenv/config";
import path from "node:path";

const positive = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const NODE_ENV = process.env.NODE_ENV ?? "development";

/** API port. Hosting providers inject PORT; API_PORT wins locally. */
export const PORT = positive(process.env.API_PORT ?? process.env.PORT, 4000);

export const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "[config] DATABASE_URL is missing. Copy .env.example to .env and set the PostgreSQL URL."
  );
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET || "sp_dev_fallback_secret";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export const HOLD_MINUTES = positive(process.env.HOLD_MINUTES_DEFAULT, 10);
export const MAX_SEATS_PER_ORDER = 8;

export const SESSION_COOKIE = "sp_session";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** "none" + COOKIE_SECURE=true when the frontend is on a different site than the API. */
export const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || "lax";
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

/** Comma-separated allowlist for browser CORS requests. */
export const CORS_ORIGINS = (
  process.env.FRONTEND_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
export const CORS_ALLOW_ANY = process.env.CORS_ALLOW_ANY === "true";

/** multer destination — override with UPLOAD_DIR to use a mounted persistent volume. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), "server", "uploads");
export const UPLOAD_URL_PREFIX = "/uploads";
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
