"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Tier {
  name: string;
  base_price: number;
  tax_rate: number;
  fee_amount: number;
}
interface Seat {
  id: number;
  section: string;
  row_label: string;
  seat_number: number;
  tier_name: string;
  state: "available" | "held" | "sold" | "selected";
}

const MAX_SEATS = 8;

function priceFor(tiers: Tier[], tierName: string) {
  const t = tiers.find((x) => x.name === tierName);
  if (!t) return { base: 0, tax: 0, fee: 0, total: 0 };
  const base = t.base_price;
  const tax = Math.round(base * t.tax_rate * 100) / 100;
  const fee = t.fee_amount;
  return { base, tax, fee, total: base + tax + fee };
}

function money(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function secsLeft(iso: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function SeatPicker({
  eventId,
  eventTitle,
  venueName,
  tiers,
}: {
  eventId: number;
  eventTitle: string;
  venueName: string;
  tiers: Tier[];
}) {
  const router = useRouter();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<Map<number, Seat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holds, setHolds] = useState<{ ids: number[]; expires: string } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [method, setMethod] = useState<"card" | "upi">("card");
  const [cardLast4, setCardLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSeats = useCallback(async () => {
    const res = await fetch(`/api/v1/events/${eventId}/seats`);
    const data = await res.json();
    setSeats(data.seats ?? []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  useEffect(() => {
    if (!holds) return;
    timer.current = setInterval(() => {
      const left = secsLeft(holds.expires);
      setRemaining(left);
      if (left <= 0) {
        setHolds(null);
        setSelected(new Map());
        setError("Your seat hold expired — seats released.");
        loadSeats();
      }
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [holds, loadSeats]);

  const sections = useMemo(() => {
    const map = new Map<string, Map<string, Seat[]>>();
    for (const s of seats) {
      if (!map.has(s.section)) map.set(s.section, new Map());
      const rows = map.get(s.section)!;
      if (!rows.has(s.row_label)) rows.set(s.row_label, []);
      rows.get(s.row_label)!.push(s);
    }
    return map;
  }, [seats]);

  const selectedTotal = [...selected.values()].reduce((sum, s) => sum + priceFor(tiers, s.tier_name).total, 0);

  function toggleSeat(seat: Seat) {
    if (seat.state === "sold" || seat.state === "held" || holds) return;
    setError(null);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else if (next.size < MAX_SEATS) next.set(seat.id, seat);
      else setError(`Maximum ${MAX_SEATS} seats per order.`);
      return next;
    });
  }

  async function holdSeats() {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/events/${eventId}/holds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seat_ids: [...selected.keys()] }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not hold those seats");
      await loadSeats();
      setSelected(new Map());
      return;
    }
    setHolds({ ids: data.hold_ids, expires: data.expires_at });
    setRemaining(secsLeft(data.expires_at));
    await loadSeats();
  }

  async function releaseHolds() {
    if (!holds) return;
    setBusy(true);
    await fetch(`/api/v1/holds`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hold_ids: holds.ids }),
    });
    setBusy(false);
    setHolds(null);
    setSelected(new Map());
    await loadSeats();
  }

  async function checkout() {
    if (!holds) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/bookings/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hold_ids: holds.ids,
        method,
        ...(method === "card" ? { card_last4: cardLast4 || "4242" } : {}),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Checkout failed");
      if (data.code === "HOLD_EXPIRED" || data.code === "HOLD_GONE") {
        setHolds(null);
        setSelected(new Map());
        await loadSeats();
      }
      return;
    }
    setBooked(true);
    setTimeout(() => {
      router.push("/tickets?booked=1");
      router.refresh();
    }, 1200);
  }

  const seatBtn = (s: Seat) => {
    const isSelected = selected.has(s.id);
    const disabled = s.state === "sold" || s.state === "held" || holds !== null || booked;
    const cls = isSelected
      ? "bg-ink-blue text-[#03110f] border-ink-blue scale-105"
      : s.state === "sold"
        ? "bg-ink-soft/25 border-transparent text-transparent"
        : s.state === "held"
          ? "bg-mint-mist border-mint-mist"
          : "bg-mint-mist border-sky-teal/50 hover:border-ink-blue hover:bg-ink-blue/15";
    return (
      <button
        key={s.id}
        type="button"
        disabled={disabled}
        onClick={() => toggleSeat(s)}
        title={`${s.section} · Row ${s.row_label} · Seat ${s.seat_number} (${s.tier_name}) — ${isSelected ? "selected" : s.state}`}
        aria-pressed={isSelected}
        aria-label={`Row ${s.row_label} seat ${s.seat_number}, ${s.tier_name}, ${isSelected ? "selected" : s.state}`}
        className={`h-7 w-7 shrink-0 rounded-md border text-[10px] font-semibold transition-all duration-150 ${cls} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {s.seat_number}
      </button>
    );
  };

  const tierNames = tiers.map((t) => t.name);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="font-display text-2xl font-bold">{eventTitle}</h1>
        <p className="text-sm text-ink-soft">{venueName}</p>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded border border-sky-teal/60 bg-mint-mist" /> Available</span>
          <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-ink-blue" /> Selected</span>
          <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-mint-mist" /> Held</span>
          <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-ink-soft/25" /> Sold</span>
          <span className="ml-auto">Tiers: {tierNames.join(" · ")}</span>
        </div>

        {/* Map */}
        <div className="card mt-4 overflow-x-auto p-6">
          <div className="mx-auto mb-6 w-3/4 rounded-b-2xl bg-gradient-to-r from-ink-blue/70 to-sky-teal/70 py-1.5 text-center text-xs font-medium uppercase tracking-widest text-[#03110f]">
            Stage
          </div>
          {loading ? (
            <div className="grid gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="mx-auto h-7 w-2/3 animate-pulse rounded bg-mint-mist" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {[...sections.entries()].map(([section, rows]) => (
                <div key={section}>
                  <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    {section}
                    {tiers.find((t) => t.name === seats.find((s) => s.section === section)?.tier_name) && (
                      <span className="ml-2 font-normal normal-case">
                        {money(priceFor(tiers, seats.find((s) => s.section === section)!.tier_name).total)}
                      </span>
                    )}
                  </p>
                  <div className="space-y-1.5">
                    {[...rows.entries()].map(([row, rowSeats]) => (
                      <div key={row} className="flex items-center justify-center gap-1.5">
                        <span className="tnum w-5 text-right text-[10px] text-ink-soft">{row}</span>
                        <div className="flex gap-1.5">{rowSeats.map(seatBtn)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary / checkout rail */}
      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold">Your selection</h2>

          {error && (
            <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}
          {booked && (
            <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">
              Payment successful! Taking you to your tickets…
            </p>
          )}

          {!holds ? (
            <>
              {selected.size === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">Click seats on the map to select (up to {MAX_SEATS}).</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {[...selected.values()].map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>
                        {s.section} · R{s.row_label}·S{s.seat_number}
                        <span className="ml-1 text-xs text-ink-soft">({s.tier_name})</span>
                      </span>
                      <span className="tnum">{money(priceFor(tiers, s.tier_name).total)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-line pt-3 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="tnum">{money(selectedTotal)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">Incl. taxes &amp; fees — locked at purchase.</p>
              </div>
              <button
                className="btn-primary mt-4 w-full"
                disabled={selected.size === 0 || busy || booked}
                onClick={holdSeats}
              >
                {busy ? "Holding…" : `Hold ${selected.size || ""} seat${selected.size === 1 ? "" : "s"}`}
              </button>
            </>
          ) : (
            <>
              <div className="mt-3 rounded-xl bg-warning/10 p-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-warning">Seats held</p>
                <p className="tnum font-display text-2xl font-bold tabular-nums">{mmss(remaining)}</p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {[...selected.values()].map((s) => (
                  <li key={s.id} className="flex items-center justify-between">
                    <span>{s.section} · R{s.row_label}·S{s.seat_number}</span>
                    <span className="tnum">{money(priceFor(tiers, s.tier_name).total)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-3">
                <div className="flex justify-between font-semibold text-sm">
                  <span>Total</span>
                  <span className="tnum">{money(selectedTotal)}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="label">Payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["card", "upi"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`rounded-[10px] border px-3 py-2 text-sm font-medium transition ${
                        method === m ? "border-ink-blue bg-mint-mist text-ink-blue" : "border-line text-ink-soft"
                      }`}
                    >
                      {m === "card" ? "💳 Card" : "📱 UPI"}
                    </button>
                  ))}
                </div>
                {method === "card" && (
                  <input
                    className="input mt-1"
                    placeholder="Card number (last 4) — e.g. 4242"
                    maxLength={4}
                    inputMode="numeric"
                    value={cardLast4}
                    onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))}
                  />
                )}
                <p className="text-[11px] leading-snug text-ink-soft">
                  Mock provider: any value succeeds · card ending <strong>0002</strong> simulates a decline.
                </p>
              </div>
              <button className="btn-primary mt-4 w-full" disabled={busy || booked} onClick={checkout}>
                {busy ? "Processing…" : `Pay ${money(selectedTotal)}`}
              </button>
              <button className="btn-ghost mt-2 w-full" disabled={busy || booked} onClick={releaseHolds}>
                Release seats
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
