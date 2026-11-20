"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StatusChip } from "@/components/ui";
import { AccountShell, type AccountUser } from "@/components/account-shell";
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

function fmtDate(d: string) {
  return fmtEventDate(d, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function TicketsList({ session }: { session: AccountUser | null }) {
  const params = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [transferring, setTransferring] = useState<number | null>(null);
  const [transferEmail, setTransferEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/tickets/mine");
    if (res.status === 401) {
      setTickets([]);
      return;
    }
    const data = await res.json();
    setTickets(data.tickets ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (params.get("booked")) {
      setMsg("🎉 Payment successful — your tickets are ready below.");
    }
  }, [params]);

  async function transfer(id: number) {
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/v1/tickets/${id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: transferEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Transfer failed");
      return;
    }
    setMsg(`Ticket transferred to ${transferEmail}.`);
    setTransferring(null);
    setTransferEmail("");
    load();
  }

  if (!session) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-ink-soft">Sign in to see your tickets.</p>
        <Link href="/login?next=/tickets" className="btn-primary mt-4">Sign in</Link>
      </div>
    );
  }

  if (tickets === null) {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card h-56 animate-pulse bg-mint-mist/40" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="font-display text-lg font-semibold">No tickets yet</p>
        <p className="mt-1 text-sm text-ink-soft">Book your first event to see QR tickets here.</p>
        <Link href="/" className="btn-primary mt-5">Browse events</Link>
      </div>
    );
  }

  return (
    <>
      {msg && <p className="mb-4 rounded-lg bg-success/10 px-4 py-2.5 text-sm font-medium text-success">{msg}</p>}
      {error && <p className="mb-4 rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        {tickets.map((t) => (
          <article key={t.id} className="card overflow-hidden">
            <div className="border-b border-line bg-[radial-gradient(120%_120%_at_0%_0%,rgba(70,224,208,0.16),transparent_62%)] px-5 py-4">
              <p className="font-display font-semibold leading-snug">{t.event_title}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {fmtDate(t.starts_at)} · {t.venue_name}, {t.city}
              </p>
            </div>
            <div className="flex items-center gap-4 p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.qr_image} alt={`QR for ${t.ticket_number}`} className="h-28 w-28 rounded-lg border border-line" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-mono text-xs text-ink-soft">{t.ticket_number}</p>
                <p className="mt-1 font-medium">
                  {t.section} · Row {t.row_label} · Seat {t.seat_number}
                </p>
                <p className="text-ink-soft">{t.tier_name} · ₹{Number(t.total_price).toLocaleString("en-IN")}</p>
                <div className="mt-2"><StatusChip status={t.status} /></div>
              </div>
            </div>
            {t.status === "active" && (
              <div className="border-t border-line px-5 py-3">
                {transferring === t.id ? (
                  <div className="flex gap-2">
                    <input className="input" placeholder="recipient@email.com" value={transferEmail}
                           onChange={(e) => setTransferEmail(e.target.value)} />
                    <button className="btn-primary" onClick={() => transfer(t.id)}>Send</button>
                    <button className="btn-ghost" onClick={() => setTransferring(null)}>✕</button>
                  </div>
                ) : (
                  <button className="text-sm font-medium text-ink-blue hover:underline"
                          onClick={() => { setTransferring(t.id); setMsg(null); setError(null); }}>
                    Transfer ticket →
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

export default function TicketsPage() {
  const [session, setSession] = useState<AccountUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSession(d?.user ?? null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="mono-label">Loading your tickets…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <p className="mono-label">Members only</p>
          <h1 className="mt-3 font-display text-xl font-semibold">Sign in for your tickets</h1>
          <p className="mt-1 text-sm text-ink-soft">Your QR codes live in the member area.</p>
          <Link href="/login?next=/tickets" className="btn-primary mt-5">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AccountShell user={session}>
      <div className="mb-6">
        <p className="mono-label">My tickets</p>
        <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight">Your entry passes</h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">Show the QR at the gate — one scan per ticket.</p>
      </div>
      <Suspense>
        <TicketsList session={session} />
      </Suspense>
    </AccountShell>
  );
}
