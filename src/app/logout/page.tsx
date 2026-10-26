"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side sign-out: the cookie itself is cleared by the
 * /api/v1/auth/logout Route Handler (Next.js only allows cookie writes
 * in Route Handlers / Server Actions).
 */
export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch("/api/v1/auth/logout", { method: "POST" });
      } catch {
        // even on network failure, send the user to the login page
      }
      if (!cancelled) router.replace("/login");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">Signing out…</p>
    </div>
  );
}
