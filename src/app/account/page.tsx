"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountShell, type AccountUser } from "@/components/account-shell";
import { StatusChip } from "@/components/ui";
import { fmtEventDate } from "@/lib/datetime";

interface Ticket {
  id: number;
  ticket_number: string;
  status: string;
  event_id: number;
  event_title: string;
  starts_at: string;
  venue_name: string;
  city: string;
  section: string;
  row_label: string;
  seat_number: number;
  tier_name: string;
  total_price: string;
  qr_image: string;
}

interface EventCard {
  id: number;
  title: string;
  starts_at: string;
  banner_url: string | null;
  venue_name: string;
  city: string;
  min_price: string | null;
}

const money = (value: string | number) =>
  `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-5">
      <p className="mono-label">{label}</p>
      <p className="mt-3 font-display text-[26px] font-semibold leading-none">{value}</p>
      {hint && <p className="mt-2 text-[12px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [events, setEvents] = useState<EventCard[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const me = await fetch("/api/v1/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      if (!me?.user) {
        router.replace("/login?next=/account");
        return;
      }
      if (cancelled) return;
      setUser(me.user);

      const [ticketsRes, eventsRes] = await Promise.all([
        fetch("/api/v1/tickets/mine").catch(() => null),
        fetch("/api/v1/events?limit=3").catch(() => null),
      ]);
      const ticketData = ticketsRes?.ok ? await ticketsRes.json() : { tickets: [] };
      const eventData = eventsRes?.ok ? await eventsRes.json() : { events: [] };

      if (cancelled) return;
      setTickets(ticketData.tickets ?? []);
      setEvents(eventData.events ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="mono-label">Loading your account…</p>
      </div>
    );
  }

  const all = tickets ?? [];
  const now = Date.now();
  const usable = all.filter((ticket) => ticket.status === "active");
  const upcoming = all
    .filter((ticket) => new Date(ticket.starts_at).getTime() >= now && ticket.status !== "cancelled")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const next = upcoming[0] ?? null;
  const spent = all.reduce((sum, ticket) => sum + Number(ticket.total_price ?? 0), 0);

  return (
    <AccountShell user={user}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-label">Overview</p>
          <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight">
            Welcome back, {user.full_name.split(" ")[0]}.
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Your bookings, entry codes and what&apos;s coming up next.
          </p>
        </div>
        <Link href="/#events" className="btn-primary btn-sm self-start sm:self-auto">
          Find events
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live tickets" value={tickets ? String(usable.length) : "—"} hint="Ready to scan at the gate" />
        <Stat label="Upcoming" value={tickets ? String(upcoming.length) : "—"} hint="Scheduled events" />
        <Stat label="Seats booked" value={tickets ? String(all.length) : "—"} hint="Across all orders" />
        <Stat label="Total spent" value={tickets ? money(spent) : "—"} hint="Including fees and taxes" />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[17px] font-semibold">Next up</h2>
          <Link href="/tickets" className="text-[13px] font-medium text-ink-blue hover:underline">
            All tickets →
          </Link>
        </div>

        {tickets === null ? (
          <div className="mt-4 h-44 animate-pulse rounded-2xl border border-line bg-mint-mist/40" />
        ) : next ? (
          <article className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="mono-label">Your next event</span>
                  <StatusChip status={next.status} />
                </div>
                <h3 className="mt-3 font-display text-xl font-semibold leading-snug">{next.event_title}</h3>
                <p className="mt-1 text-[13.5px] text-ink-soft">
                  {fmtEventDate(next.starts_at, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {next.venue_name}, {next.city}
                </p>
                <dl className="mt-5 grid max-w-sm grid-cols-3 gap-3 border-t border-line/70 pt-4 text-[13px]">
                  <div>
                    <dt className="mono-label">Section</dt>
                    <dd className="mt-1.5 font-medium">{next.section}</dd>
                  </div>
                  <div>
                    <dt className="mono-label">Row</dt>
                    <dd className="mt-1.5 font-medium">{next.row_label}</dd>
                  </div>
                  <div>
                    <dt className="mono-label">Seat</dt>
                    <dd className="mt-1.5 font-medium">{next.seat_number}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex items-center gap-4 border-t border-line/70 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={next.qr_image}
                  alt={`Entry QR for ticket ${next.ticket_number}`}
                  className="h-28 w-28 rounded-xl border border-line bg-white p-1"
                />
                <div className="text-[12px] text-ink-soft">
                  <p className="mono-label">Entry code</p>
                  <p className="mt-2 font-mono text-[12px] text-ink">{next.ticket_number}</p>
                  <Link href="/tickets" className="mt-3 inline-block font-medium text-ink-blue hover:underline">
                    Open ticket →
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface/40 p-8 text-center">
            <p className="font-display text-[15px] font-semibold">Nothing booked yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-soft">
              Pick a show, choose your seat on the map and your QR ticket will appear here instantly.
            </p>
            <Link href="/#events" className="btn-primary btn-sm mt-4">
              Browse events
            </Link>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[17px] font-semibold">Recent bookings</h2>
          <Link href="/tickets" className="text-[13px] font-medium text-ink-blue hover:underline">
            Manage tickets →
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface/60">
          {tickets === null ? (
            <div className="h-24 animate-pulse bg-mint-mist/40" />
          ) : all.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-ink-soft">No bookings on this account yet.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {all.slice(0, 4).map((ticket) => (
                <li key={ticket.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{ticket.event_title}</p>
                    <p className="text-[12px] text-ink-soft">
                      {fmtEventDate(ticket.starts_at, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                      {ticket.section} {ticket.row_label}-{ticket.seat_number}
                    </p>
                  </div>
                  <span className="font-mono text-[11.5px] text-ink-soft">{ticket.ticket_number}</span>
                  <span className="text-[13px] tabular-nums">{money(ticket.total_price)}</span>
                  <StatusChip status={ticket.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {events.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[17px] font-semibold">Coming to a stage near you</h2>
            <Link href="/#events" className="text-[13px] font-medium text-ink-blue hover:underline">
              See all events →
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {events.slice(0, 3).map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group overflow-hidden rounded-2xl border border-line bg-surface/60 transition-colors hover:border-ink-blue/40"
              >
                <div className="relative h-32 overflow-hidden bg-mint-mist">
                  {event.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.banner_url}
                      alt=""
                      className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="grid-lines h-full w-full" />
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate text-[13.5px] font-medium">{event.title}</p>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {fmtEventDate(event.starts_at, { day: "numeric", month: "short" })} · {event.city}
                  </p>
                  <p className="mt-2 text-[12.5px] text-ink-blue">
                    {event.min_price ? `From ${money(event.min_price)}` : "See pricing"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AccountShell>
  );
}
