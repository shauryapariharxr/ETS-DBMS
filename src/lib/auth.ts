import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export type Role = "customer" | "organizer" | "admin" | "scanner";
export const COOKIE_NAME = "sp_session";

export interface SessionUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "sp_dev_fallback_secret"
  );
}

/**
 * Verifies the HS256 token issued by the Express API (`server/auth.js`).
 * Must stay compatible with that payload (sub, email, role, full_name/name).
 */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      id: Number(payload.sub),
      email: String(payload.email ?? ""),
      full_name: String(payload.full_name ?? payload.name ?? ""),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Session for server components — set by the Express API login endpoint. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
