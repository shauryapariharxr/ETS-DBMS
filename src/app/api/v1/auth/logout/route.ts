import { ok, route } from "@/lib/api";
import { COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export const POST = route(async () => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  return ok({ signedOut: true });
});
