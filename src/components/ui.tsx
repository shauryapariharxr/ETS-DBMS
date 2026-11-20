import Link from "next/link";

export interface SessionUser {
  full_name: string;
  role: string;
}

/** Brand mark extracted from the supplied logo, transparent background. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-mark.png" alt="" aria-hidden className={`${className} object-contain`} />
  );
}

export function Logo() {
  return (
    <Link href="/" aria-label="StagePass home" className="group flex items-center gap-2.5">
      <LogoMark className="h-7 w-7 opacity-90 transition-opacity group-hover:opacity-100" />
      <span className="font-display text-[15px] font-semibold tracking-[0.01em] text-ink">
        StagePass
      </span>
    </Link>
  );
}

const NAV_LINK = "nav-link whitespace-nowrap text-[13.5px] font-medium leading-none";

export function Header({ session }: { session: SessionUser | null }) {
  const isAdmin = session?.role === "admin";
  const canScan = session?.role === "scanner" || isAdmin;

  // Browsing links stay in the middle; account actions live on the right so the
  // bar never repeats a destination.
  const primaryLinks = [
    { href: "/", label: "Events" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/contact", label: "Contact" },
  ];

  const staffLinks = [
    ...(canScan ? [{ href: "/scan", label: "Scan entry" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const mobileLinks = [
    ...primaryLinks,
    ...(session ? [{ href: "/tickets", label: "My tickets" }] : []),
    ...staffLinks,
  ];

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-b from-warm-ivory via-warm-ivory/90 to-transparent pb-2 pt-3">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Floating pill bar: the page background shows through it. */}
        <div className="flex h-[62px] items-center gap-4 rounded-full border border-line/80 bg-[#0a0f18]/60 px-3 backdrop-blur-xl sm:px-5">
          <Logo />

          <nav className="mx-auto hidden items-center gap-6 md:flex" aria-label="Primary">
            {primaryLinks.map((link) => (
              <Link key={link.href} href={link.href} className={NAV_LINK}>
                {link.label}
              </Link>
            ))}

            {staffLinks.length > 0 && (
              <>
                <span aria-hidden className="h-4 w-px bg-line" />
                {staffLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={NAV_LINK}>
                    {link.label}
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {session ? (
              <>
                <Link
                  href="/account"
                  className="hidden max-w-[90px] truncate pr-1 text-[13px] text-ink-soft transition-colors hover:text-ink sm:inline"
                >
                  {session.full_name.split(" ")[0]}
                </Link>
                <form action="/logout" className="hidden sm:block">
                  <button type="submit" className={`${NAV_LINK} cursor-pointer`}>
                    Sign out
                  </button>
                </form>
                <Link href="/tickets" className="btn-primary btn-sm">
                  My tickets
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-fill btn-sm hidden sm:inline-flex">
                  Log in
                </Link>
                <Link href="/register" className="btn-primary btn-sm">
                  Get tickets
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Compact link row on phones, where the inline links are hidden. */}
        <nav
          className="mt-3 flex items-center gap-5 overflow-x-auto px-3 pb-1 md:hidden"
          aria-label="Primary mobile"
        >
          {mobileLinks.map((link) => (
            <Link key={link.href} href={link.href} className={NAV_LINK}>
              {link.label}
            </Link>
          ))}
          {!session && (
            <Link href="/login" className={NAV_LINK}>
              Log in
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

const FOOTER_COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/#events", label: "Browse events" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/tickets", label: "My tickets" },
      { href: "/register", label: "Create account" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refund-policy", label: "Refund & Cancellation" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/refund-policy", label: "Request a refund" },
      { href: "/terms#entry", label: "Entry & ticket rules" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line/70">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
              Seat-level ticketing for live events. Reserved seating, instant checkout and QR entry
              at the gate.
            </p>
            <Link href="/#events" className="btn-ghost btn-sm mt-5">
              Browse events
            </Link>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="mono-label">{column.title}</p>
              <ul className="mt-4 space-y-2.5 text-[13px] text-ink-soft">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line/70 pt-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} StagePass. All rights reserved.</span>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Legal">
            <Link href="/terms" className="transition-colors hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="/refund-policy" className="transition-colors hover:text-ink">
              Refunds
            </Link>
            <Link href="/contact" className="transition-colors hover:text-ink">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
