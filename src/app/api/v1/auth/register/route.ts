import { z } from "zod";
import { q } from "@/db/pool";
import { ok, route, readJson, ApiError } from "@/lib/api";
import { cookies } from "next/headers";
import { COOKIE_NAME, createToken } from "@/lib/auth";
import { hashPassword, type Role } from "@/lib/auth";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(2, "Name is required"),
});

export const POST = route(async (req: Request) => {
  const input = registerSchema.parse(await readJson<unknown>(req));
  const email = input.email.toLowerCase();
  const existing = await q(`SELECT id FROM users WHERE email=$1`, [email]);
  if (existing[0]) throw new ApiError(409, "An account with that email already exists");
  const rows = await q<{ id: number; email: string; full_name: string; role: Role }>(
    `INSERT INTO users(email, password_hash, full_name, role)
     VALUES ($1,$2,$3,'customer') RETURNING id, email, full_name, role`,
    [email, hashPassword(input.password), input.full_name]
  );
  const user = rows[0];
  const store = await cookies();
  store.set(COOKIE_NAME, await createToken(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
  return ok({ user }, 201);
});
