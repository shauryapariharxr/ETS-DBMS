"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/ui";
import { ApiError, postJson, warmUpApi } from "@/lib/client-api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") ?? "/account";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);

  // The API sleeps on its free tier. After a few seconds of waiting, say so
  // instead of leaving the button looking frozen.
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 3500);
    return () => clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    warmUpApi();
    // Already signed in? Go straight to the member area, not the login form.
    fetch("/api/v1/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) router.replace("/account");
      })
      .catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const data = await postJson<{ user: { role: string } }>("/api/v1/auth/login", {
        email: email.trim(),
        password,
      });
      const dest = data.user.role === "admin" && nextUrl === "/account" ? "/admin" : nextUrl;
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-2.5">
        <LogoMark className="h-9 w-9" />
        <span className="font-display text-lg font-semibold tracking-tight">StagePass</span>
      </div>

      <div className="card p-8">
        <p className="mono-label">Member access</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-soft">Sign in to book seats and manage events.</p>

        {params.get("denied") && (
          <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            You don&apos;t have access to that area.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn-primary w-full" disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {slow && (
            <p className="rounded-lg border border-line bg-surface/60 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
              The server was idle, so it is starting up — the first sign-in of the day can take
              up to a minute. Keep this page open.
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          New here?{" "}
          <Link href="/register" className="font-medium text-ink-blue hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-3 border-t border-line/70 pt-3 text-center text-[11.5px] leading-relaxed text-ink-soft/80">
          Organiser or gate staff? Sign in with your staff account — admin logins open the
          console automatically.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-ink-blue/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-52 right-0 h-[28rem] w-[28rem] rounded-full bg-sky-teal/10 blur-[130px]" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
