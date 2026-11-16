"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    const dest =
      data.user.role === "admin" && nextUrl === "/" ? "/admin" : nextUrl;
    router.push(dest);
    router.refresh();
  }

  function quickFill(em: string, pw: string) {
    setEmail(em);
    setPassword(pw);
  }

  return (
    <div className="card w-full max-w-md p-8">
      <h1 className="font-display text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-soft">Sign in to book seats and manage events.</p>

      {params.get("denied") && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          You don&apos;t have access to that area.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required className="input" value={password}
                 onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <button className="btn-primary w-full" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 rounded-xl bg-mint-mist/60 p-4 text-xs">
        <p className="font-medium text-ink-soft">Demo accounts</p>
        <div className="mt-2 grid gap-1.5">
          <button type="button" className="text-left hover:text-ink-blue" onClick={() => quickFill("admin@stagepass.test", "Admin@123")}>
            👩‍💼 admin@stagepass.test · Admin@123
          </button>
          <button type="button" className="text-left hover:text-ink-blue" onClick={() => quickFill("customer@stagepass.test", "Customer@123")}>
            🧑 customer@stagepass.test · Customer@123
          </button>
          <button type="button" className="text-left hover:text-ink-blue" onClick={() => quickFill("scanner@stagepass.test", "Scanner@123")}>
            🎫 scanner@stagepass.test · Scanner@123
          </button>
          <button type="button" className="text-left hover:text-ink-blue" onClick={() => quickFill("organizer@stagepass.test", "Organizer@123")}>
            🎬 organizer@stagepass.test · Organizer@123
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link href="/register" className="font-medium text-ink-blue hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mint-mist px-4 py-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
