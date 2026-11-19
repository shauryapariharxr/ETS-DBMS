import { cookies } from "next/headers";

export type Role = "customer" | "organizer" | "admin" | "scanner";
export const COOKIE_NAME = "sp_session";

export interface SessionUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

/** Express API origin — mirrors src/lib/queries.ts. */
const API_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000"
).replace(/\/+$/, "");

/**
 * Session for server components.
 *
 * The Express API signs the token and is the only process holding JWT_SECRET,
 * so it is also the only thing that validates it: ask `/api/v1/auth/me` with the
 * cookie rather than verifying locally. Holding a copy of the signing key in the
 * frontend deployment made every protected page bounce to /login whenever the
 * two secrets differed.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  if (!store.get(COOKIE_NAME)) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { cookie: store.toString() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: SessionUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}
