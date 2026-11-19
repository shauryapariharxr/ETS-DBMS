"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtEventDate } from "@/lib/datetime";

interface Stats {
  revenue: string;
  tickets: { active: number; used: number; comped: number };
  events: { scheduled: number; cancelled: number };
  scans: { today: number; granted: number; denied: number };
  series: { day: string; total: string }[];
  occupancy: { id: number; title: string; starts_at: string; status: string; capacity: number; sold: number }[];
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={`tnum mt-1 font-display text-2xl font-bold ${accent ? "text-ink-blue" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/stats")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Failed to load");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
        <Link href="/login?next=/admin" className="btn-primary mt-4">Sign in as admin</Link>
      </div>
    );
  }
  if (!stats) {
    return <div className="card h-64 animate-pulse bg-mint-mist/40" />;
  }

  const max = Math.max(...stats.series.map((s) => Number(s.total)), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-ink-soft">Live platform metrics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total revenue" value={`₹${Number(stats.revenue).toLocaleString("en-IN")}`} accent
                  sub="All succeeded payments" />
        <StatCard label="Tickets" value={String(stats.tickets.active + stats.tickets.used)}
                  sub={`${stats.tickets.active} active · ${stats.tickets.used} used`} />
        <StatCard label="Events" value={String(stats.events.scheduled)}
                  sub={`${stats.events.cancelled} cancelled`} />
        <StatCard label="Scans today" value={String(stats.scans.today)}
                  sub={`${stats.scans.granted} granted · ${stats.scans.denied} denied`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Revenue — last 14 days</h2>
          {stats.series.every((s) => Number(s.total) === 0) ? (
            <p className="mt-8 text-center text-sm text-ink-soft">No sales in this window yet.</p>
          ) : (
            <div className="mt-6 flex h-40 items-end gap-1.5">
              {stats.series.map((s) => {
                const h = Math.max(4, (Number(s.total) / max) * 100);
                return (
                  <div key={s.day} className="group relative flex-1">
                    <div className="rounded-t-md bg-sky-teal transition group-hover:bg-ink-blue" style={{ height: `${h}%` }} />
                    <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                      {s.day.slice(5)} · ₹{Number(s.total).toLocaleString("en-IN")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Occupancy by event</h2>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {stats.occupancy.slice(0, 6).map((o) => {
                const pct = o.capacity ? Math.round((o.sold / o.capacity) * 100) : 0;
                return (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link href={`/events/${o.id}`} className="font-medium hover:text-ink-blue">{o.title}</Link>
                      <p className="text-xs text-ink-soft">{fmtEventDate(o.starts_at, { day: "numeric", month: "short" })}</p>
                    </td>
                    <td className="tnum w-24 py-2.5 text-right text-xs text-ink-soft">{o.sold}/{o.capacity}</td>
                    <td className="w-28 py-2.5">
                      <div className="h-2 rounded-full bg-mint-mist">
                        <div className="h-2 rounded-full bg-ink-blue" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
