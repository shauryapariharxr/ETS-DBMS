"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, postJson, warmUpApi } from "@/lib/client-api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);

  // Start a sleeping API instance before the visitor finishes typing, and skip
  // the sign-up form entirely for visitors who already have a session.
  useEffect(() => {
    warmUpApi();
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
    setTaken(false);

    try {
      await postJson<{ user: { id: number } }>("/api/v1/auth/register", {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      // Keep the button state until the redirect lands — navigating away resets it.
      router.push("/account");
      router.refresh();
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;
      setTaken(apiError?.status === 409);
      setError(apiError?.message ?? "Could not create your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-ink-blue/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="mb-8">
          <Link href="/" aria-label="StagePass home" className="inline-flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" aria-hidden className="h-9 w-9 object-contain" />
            <span className="font-display text-lg font-semibold tracking-tight">StagePass</span>
          </Link>
        </div>

        <div className="card p-8">
          <p className="mono-label">New account</p>
          <h1 className="mt-3 font-display text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-ink-soft">Book seats in seconds.</p>

          {error && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
              {taken && (
                <>
                  {" "}
                  <Link href="/login" className="font-medium underline">
                    Sign in instead
                  </Link>
                </>
              )}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                required
                autoComplete="name"
                className="input"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
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
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password (min 8 chars)
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-soft">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-ink-blue hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
