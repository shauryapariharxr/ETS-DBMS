import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "sp_session";

type Role = "customer" | "organizer" | "admin" | "scanner";

/**
 * Edge middleware: gates /admin (admin|organizer) and the scanner portal
 * (scanner|admin|organizer).
 *
 * The Express API signs the session token and is the only holder of JWT_SECRET,
 * so middleware asks `/api/v1/auth/me` (same origin, cookie forwarded) instead of
 * verifying the signature itself. API routes still run their own requireRole()
 * checks, so this is a navigation gate, not the security boundary.
 */
async function sessionRole(req: NextRequest): Promise<Role | null> {
  if (!req.cookies.get(COOKIE_NAME)) return null;
  try {
    const res = await fetch(new URL("/api/v1/auth/me", req.url), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { role?: Role } };
    return data.user?.role ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  const isScannerArea = pathname.startsWith("/scan");
  const role = await sessionRole(req);

  if ((isAdminArea || isScannerArea) && !role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (isAdminArea && role && !["admin", "organizer"].includes(role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("denied", "admin");
    return NextResponse.redirect(url);
  }
  if (isScannerArea && role && !["scanner", "admin", "organizer"].includes(role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("denied", "scanner");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/scan/:path*"],
};
