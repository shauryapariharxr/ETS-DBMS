import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  COOKIE_SAMESITE,
  COOKIE_SECURE,
  JWT_EXPIRES_IN,
  JWT_SECRET,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "./config.js";
import { ApiError } from "./errors.js";

/** bcrypt hash — plain passwords are never stored (requirement: bcrypt). */
export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/** HS256 JWT carrying id, email, role and name. Readable by the Next.js edge middleware. */
export function createToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      name: user.full_name,
    },
    JWT_SECRET,
    {
      algorithm: "HS256",
      subject: String(user.id),
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload?.sub || typeof payload.role !== "string") return null;
    return {
      id: Number(payload.sub),
      email: String(payload.email ?? ""),
      full_name: String(payload.full_name ?? payload.name ?? ""),
      role: payload.role,
    };
  } catch {
    return null;
  }
}

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/** Accepts the httpOnly session cookie or an `Authorization: Bearer` token (Postman). */
export function tokenFromRequest(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7).trim();
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] ?? null;
}

export function setSessionCookie(res, user) {
  res.cookie(SESSION_COOKIE, createToken(user), {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/", sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE });
}

/** Populates req.user when a valid token is present; never rejects. */
export function optionalUser(req, _res, next) {
  const token = tokenFromRequest(req);
  req.user = token ? verifyToken(token) : null;
  next();
}

export function authRequired(req, _res, next) {
  if (!req.user) return next(new ApiError(401, "Sign in required", "UNAUTHENTICATED"));
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Sign in required", "UNAUTHENTICATED"));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions", "FORBIDDEN"));
    }
    next();
  };
}
