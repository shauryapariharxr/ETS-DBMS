import { z } from "zod";
import { q } from "@/db/pool";
import { ok, route, readJson, ApiError } from "@/lib/api";
import { cookies } from "next/headers";
import { COOKIE_NAME, createToken } from "@/lib/auth";
import { comparePassword, type Role } from "@/lib/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = route(async (req: Request) => {
  const input = loginSchema.parse(await readJson<unknown>(req));
  const rows = await q<{ id: number; email: string; full_name: string; role: Role; password_hash: string }>(
    `SELECT id, email, full_name, role, password_hash FROM users WHERE email=$1`,
    [input.email.toLowerCase()]
  );
  const user = rows[0];
  if (!user || !(await comparePassword(input.password, user.password_hash))) {
    throw new ApiError(401, "Invalid email or password");
  }
  const store = await cookies();
  store.set(COOKIE_NAME, await createToken({ id: user.id, email: user.email, full_name: user.full_name, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
  return ok({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
});
