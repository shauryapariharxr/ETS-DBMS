"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, LogoMark } from "@/components/ui";

export interface AccountUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/tickets", label: "My tickets" },
  { href: "/#events", label: "Browse events" },
  { href: "/contact", label: "Help & support" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Chrome for the signed-in member area.
 *
 * Deliberately not the marketing header: no hero-height pill, no promo links —
 * just a workspace bar, an identity rail and the content column, so a signed-in
 * visitor lands somewhere that reads as "my account", not the landing page.
 */
export function AccountShell({ user, children }: { user: AccountUser; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-line/70 bg-[#0a0f18]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
          <Logo />
          <span className="mono-label hidden rounded-full border border-line px-2.5 py-1 sm:inline">
            Member area
          </span>

          <div className="ml-auto flex items-center gap-3">
            <Link href="/#events" className="hidden text-[13px] font-medium text-ink-soft hover:text-ink sm:inline">
              Browse events
            </Link>
            <form action="/logout">
              <button type="submit" className="text-[13px] font-medium text-ink-soft hover:text-ink">
                Sign out
              </button>
            </form>
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-full border border-line bg-mint-mist/60 py-1 pl-1 pr-3 transition-colors hover:border-ink-blue/40"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-blue/15 font-mono text-[11px] font-semibold text-ink-blue">
                {initials(user.full_name)}
              </span>
              <span className="max-w-[110px] truncate text-[13px] font-medium">
                {user.full_name.split(" ")[0]}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10">
        <aside className="lg:w-[228px] lg:shrink-0">
          <div className="rounded-2xl border border-line bg-surface/60 p-5">
            <p className="mono-label">Signed in as</p>
            <p className="mt-3 truncate font-display text-[15px] font-semibold">{user.full_name}</p>
            <p className="truncate text-[12.5px] text-ink-soft">{user.email}</p>
          </div>

          <nav
            className="mt-4 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/40 p-1.5 lg:flex-col lg:overflow-visible"
            aria-label="Account"
          >
            {NAV.map((item) => {
              const active = item.href === pathname;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors ${
                    active ? "bg-ink-blue/12 text-ink" : "text-ink-soft hover:bg-mint-mist/60 hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 hidden items-start gap-2.5 rounded-2xl border border-line/70 bg-surface/40 p-4 lg:flex">
            <LogoMark className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
            <p className="text-[12px] leading-relaxed text-ink-soft">
              Tickets are scanned once at the gate. Keep the QR handy and arrive 30 minutes early.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
