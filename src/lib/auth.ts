import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export type Role = "customer" | "organizer" | "admin" | "scanner";
export const COOKIE_NAME = "sp_session";
export const SESSION_MAX_AGE = 7 * 86400; // 7 days, seconds

export interface SessionUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export async function hashPassword(pw: string): Promise<string> {
  return await bcrypt.hash(pw, 10);
}

export async function comparePassword(pw: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(pw, hash);
}

function secret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "sp_dev_fallback_secret"
  );
}

/** HS256 JWT — matches verifyToken below. */
export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    role: user.role,
    full_name: user.full_name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      id: Number(payload.sub),
      email: String(payload.email ?? ""),
      full_name: String(payload.full_name ?? ""),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Fresh session from DB via cookie — role changes take effect immediately. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
