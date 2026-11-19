import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export function Header({ session }: { session: { full_name: string; role: string } | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[#05070b]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-ink-blue/40 bg-ink-blue/10 font-display text-lg font-bold text-ink-blue shadow-[0_0_22px_rgba(70,224,208,0.25)]">
            S
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">StagePass</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-lg px-3 py-2 text-ink-soft transition hover:bg-mint-mist hover:text-ink">
            Events
          </Link>
          {session && (
            <Link href="/tickets" className="rounded-lg px-3 py-2 text-ink-soft transition hover:bg-mint-mist hover:text-ink">
              My Tickets
            </Link>
          )}
          {session?.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-2 font-medium text-ink-blue transition hover:bg-ink-blue/10"
            >
              Admin
            </Link>
          )}
          {session ? (
            <form action="/logout" method="get">
              <button className="btn-ghost ml-1" type="submit">
                Sign out ({session.full_name.split(" ")[0]})
              </button>
            </form>
          ) : (
            <Link href="/login" className="btn-primary ml-1">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-ink-blue/10 text-ink-blue ring-1 ring-inset ring-ink-blue/25",
  cancelled: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/25",
  completed: "bg-line/60 text-ink-soft",
  active: "bg-success/10 text-success ring-1 ring-inset ring-success/25",
  used: "bg-line/60 text-ink-soft",
  pending: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/25",
};

export function StatusChip({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-mint-mist text-ink-soft";
  return <span className={`chip ${cls}`}>{status}</span>;
}

export function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-8 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-ink-blue/30 bg-ink-blue/10 text-xl">
        🎟️
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {subtitle && <p className="max-w-sm text-sm text-ink-soft">{subtitle}</p>}
      {action}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-[#05070b]/80">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-ink-soft">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-ink-blue/40 bg-ink-blue/10 font-display text-xs font-bold text-ink-blue">
              S
            </span>
            <strong className="font-display text-ink">StagePass</strong>
            <span className="text-ink-soft">— live events, seats and entry</span>
          </span>
          <span className="mono-label text-ink-soft">Interactive seat maps · Secure checkout · QR entry</span>
        </div>
      </div>
    </footer>
  );
}
