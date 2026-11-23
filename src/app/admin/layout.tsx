"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/scan", label: "Scan portal" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ full_name: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null));
  }, []);

  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-line px-5">
          <LogoMark className="h-7 w-7" />
          <div>
            <p className="font-display font-semibold leading-tight">StagePass</p>
            <p className="text-[11px] text-ink-soft">Admin panel</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                     className={`block rounded-[10px] px-3 py-2.5 text-[13.5px] transition ${
                       active ? "bg-ink-blue/10 font-semibold text-ink-blue ring-1 ring-inset ring-ink-blue/25" : "text-ink-soft hover:bg-mint-mist hover:text-ink"
                     }`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-4">
          {user && (
            <>
              <p className="truncate text-sm font-medium">{user.full_name}</p>
              <p className="text-xs capitalize text-ink-soft">{user.role}</p>
              <button onClick={signOut} className="btn-ghost mt-3 w-full text-sm">Sign out</button>
            </>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
        <span className="shrink-0 font-display text-[15px] font-semibold">StagePass</span>
        <nav className="flex min-w-0 flex-1 justify-end gap-0.5 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-ink-soft hover:bg-mint-mist hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-1 lg:ml-60">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
