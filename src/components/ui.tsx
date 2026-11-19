import Link from "next/link";

export interface SessionUser {
  full_name: string;
  role: string;
}

/** Reactor-ring mark: two concentric rings and a core dot, drawn inline (no icon font). */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeOpacity="0.28" />
      <circle cx="16" cy="16" r="8.5" stroke="currentColor" strokeOpacity="0.55" />
      <path d="M16 3v5M16 24v5M3 16h5M24 16h5" stroke="currentColor" strokeOpacity="0.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.2" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink transition hover:text-white">
      <span className="text-ink-blue">
        <LogoMark />
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight">StagePass</span>
    </Link>
  );
}

const NAV_LINK = "text-[13px] leading-none text-ink-soft transition-colors hover:text-ink";

export function Header({ session }: { session: SessionUser | null }) {
  const isAdmin = session?.role === "admin";
  const canScan = session?.role === "scanner" || isAdmin;

  const links = [
    { href: "/", label: "Events" },
    ...(session ? [{ href: "/tickets", label: "My tickets" }] : []),
    ...(canScan ? [{ href: "/scan", label: "Scan entry" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-warm-ivory/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={NAV_LINK}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden text-[13px] text-ink-soft sm:inline">
                {session.full_name.split(" ")[0]}
              </span>
              <form action="/logout">
                <button type="submit" className={NAV_LINK}>
                  Sign out
                </button>
              </form>
              <Link href={isAdmin ? "/admin" : "/tickets"} className="btn-primary btn-sm">
                {isAdmin ? "Dashboard" : "My tickets"}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={`hidden sm:inline ${NAV_LINK}`}>
                Sign in
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                Get tickets
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Compact nav row on phones, where the inline links are hidden. */}
      <nav
        className="flex items-center gap-6 overflow-x-auto border-t border-line/60 px-4 py-2.5 md:hidden"
        aria-label="Primary mobile"
      >
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={`${NAV_LINK} whitespace-nowrap`}>
            {link.label}
          </Link>
        ))}
        {!session && (
          <Link href="/login" className={`${NAV_LINK} whitespace-nowrap`}>
            Sign in
          </Link>
        )}
      </nav>
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

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-8 py-16 text-center">
      <span className="text-ink-blue/70">
        <LogoMark className="h-8 w-8" />
      </span>
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      {subtitle && <p className="max-w-sm text-sm text-ink-soft">{subtitle}</p>}
      {action}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-warm-ivory">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              Seat-level ticketing for live events. Reserved seating, instant checkout and QR entry
              at the gate.
            </p>
          </div>

          <div className="flex gap-14 text-[13px]">
            <div>
              <p className="mono-label">Attend</p>
              <ul className="mt-3 space-y-2 text-ink-soft">
                <li>
                  <Link href="/" className="hover:text-ink">
                    Events
                  </Link>
                </li>
                <li>
                  <Link href="/tickets" className="hover:text-ink">
                    My tickets
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-ink">
                    Create account
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mono-label">Staff</p>
              <ul className="mt-3 space-y-2 text-ink-soft">
                <li>
                  <Link href="/scan" className="hover:text-ink">
                    Gate scanner
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="hover:text-ink">
                    Admin console
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-ink">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} StagePass</span>
          <span className="font-mono tracking-tight">Next.js · Express · PostgreSQL</span>
        </div>
      </div>
    </footer>
  );
}
