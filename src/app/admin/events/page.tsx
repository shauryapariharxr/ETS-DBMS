"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusChip } from "@/components/ui";
import { fmtEventDate, fromWallClockInput, toWallClockInput } from "@/lib/datetime";

interface EventRow {
  id: number;
  title: string;
  category: string;
  status: string;
  starts_at: string;
  venue_name: string;
  city: string;
  sold: number;
  tier_count: number;
  banner_url?: string | null;
}
interface EventDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  reentry_allowed: boolean;
  entry_gate: string | null;
  venue_id: number;
  banner_url: string | null;
}
interface Venue {
  id: number;
  name: string;
  city: string;
  seats: number;
  sections: number;
}
interface TierDraft {
  name: string;
  base_price: number;
  tax_rate: number;
  fee_amount: number;
  quantity: number;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = () => ({
  venue_id: 0,
  title: "",
  description: "",
  category: "Music",
  starts_at: toLocalInput(new Date(Date.now() + 7 * 864e5)),
  ends_at: toLocalInput(new Date(Date.now() + 7 * 864e5 + 3 * 36e5)),
  reentry_allowed: false,
  entry_gate: "",
});

const defaultTiers = (): TierDraft[] => [
  { name: "Standard", base_price: 999, tax_rate: 0.05, fee_amount: 40, quantity: 100 },
];

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState(emptyForm());
  const [tiers, setTiers] = useState<TierDraft[]>(defaultTiers());
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");

  const [cancelTarget, setCancelTarget] = useState<EventRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [compEventId, setCompEventId] = useState(0);
  const [compSeatId, setCompSeatId] = useState("");
  const [compEmail, setCompEmail] = useState("");

  const load = useCallback(async () => {
    const [eventRes, venueRes] = await Promise.all([
      fetch("/api/v1/admin/events?limit=100").then((r) => r.json()),
      fetch("/api/v1/venues").then((r) => r.json()),
    ]);
    setEvents(eventRes.events ?? []);
    setVenues(venueRes.venues ?? []);
    setForm((current) =>
      !current.venue_id && venueRes.venues?.[0]
        ? { ...current, venue_id: venueRes.venues[0].id }
        : current
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreateForm() {
    setEditingId(null);
    setForm({ ...emptyForm(), venue_id: venues[0]?.id ?? 0 });
    setTiers(defaultTiers());
    setBannerFile(null);
    setBannerUrl("");
    setError(null);
    setShowCreate(true);
  }

  async function startEdit(event: EventRow) {
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/v1/events/${event.id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not load the event");
      return;
    }
    const detail: EventDetail = data.event;
    setForm({
      venue_id: detail.venue_id,
      title: detail.title,
      description: detail.description ?? "",
      category: detail.category,
      starts_at: toWallClockInput(detail.starts_at),
      ends_at: toWallClockInput(detail.ends_at),
      reentry_allowed: detail.reentry_allowed,
      entry_gate: detail.entry_gate ?? "",
    });
    setBannerUrl(detail.banner_url ?? "");
    setBannerFile(null);
    setEditingId(detail.id);
    setShowCreate(true);
  }

  /** Uploads the chosen banner with multer (POST /api/v1/uploads) and returns its URL. */
  async function uploadBanner(): Promise<string | null> {
    if (!bannerFile) return bannerUrl || null;
    const body = new FormData();
    body.append("file", bannerFile);
    const res = await fetch("/api/v1/uploads", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Banner upload failed");
    return data.url as string;
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const uploadedBanner = await uploadBanner();
      const payload = {
        ...form,
        starts_at: fromWallClockInput(form.starts_at),
        ends_at: fromWallClockInput(form.ends_at),
        entry_gate: form.entry_gate || null,
        banner_url: uploadedBanner,
        ...(editingId ? {} : { tiers }),
      };

      const res = await fetch(editingId ? `/api/v1/events/${editingId}` : "/api/v1/events", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }

      setMsg(editingId ? `Event #${editingId} updated.` : `Event created (#${data.id}).`);
      setShowCreate(false);
      setEditingId(null);
      setBannerFile(null);
      setBannerUrl("");
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(event: EventRow) {
    if (!window.confirm(`Delete "${event.title}"? Only events without issued tickets can be deleted.`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/v1/events/${event.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Delete failed");
      return;
    }
    setMsg(`Event "${event.title}" deleted.`);
    await load();
  }

  async function cancelEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelTarget) return;
    const res = await fetch(`/api/v1/admin/events/${cancelTarget.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Cancel failed");
      return;
    }
    setMsg(
      `"${data.title}" cancelled — sales stopped, ${data.refunds} refund(s) raised totalling ₹${Number(data.refundTotal).toLocaleString("en-IN")}.`
    );
    setCancelTarget(null);
    setCancelReason("");
    await load();
  }

  async function issueComp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/v1/admin/tickets/comp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: Number(compEventId),
        seat_id: Number(compSeatId),
        customer_email: compEmail,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Comp failed");
      return;
    }
    setMsg(`Comp ticket ${data.ticket.ticket_number} issued.`);
    setCompSeatId("");
    setCompEmail("");
    await load();
  }

  const fmt = (d: string) =>
    fmtEventDate(d, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Events</h1>
          <p className="text-sm text-ink-soft">
            Full CRUD: create, edit, delete, cancel with automatic refunds, and issue comps.
          </p>
        </div>
        <button className="btn-primary" onClick={showCreate ? () => setShowCreate(false) : openCreateForm}>
          {showCreate ? "Close" : "+ New event"}
        </button>
      </div>

      {msg && <p className="rounded-lg bg-success/10 px-4 py-2.5 text-sm font-medium text-success">{msg}</p>}
      {error && <p className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}

      {showCreate && (
        <form onSubmit={saveEvent} className="card space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">
            {editingId ? `Edit event #${editingId}` : "Create event"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input
                required
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Venue</label>
              <select
                required
                className="input"
                value={form.venue_id}
                onChange={(e) => setForm({ ...form, venue_id: Number(e.target.value) })}
              >
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name} — {venue.city} ({venue.seats} seats)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {["Music", "Comedy", "Tech", "Theatre", "Sports"].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Starts</label>
              <input
                type="datetime-local"
                required
                className="input"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Ends (must be after start)</label>
              <input
                type="datetime-local"
                required
                className="input"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea
                className="input min-h-20"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Banner image (JPG, PNG, WEBP or GIF · max 4 MB)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="input py-2"
                onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
              />
              {bannerUrl && (
                <p className="mt-1 text-xs text-ink-soft">
                  Current: <span className="font-mono">{bannerUrl}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="reentry"
                type="checkbox"
                className="h-4 w-4 accent-[#2b5e8c]"
                checked={form.reentry_allowed}
                onChange={(e) => setForm({ ...form, reentry_allowed: e.target.checked })}
              />
              <label htmlFor="reentry" className="text-sm">
                Allow re-entry (scans not limited to once)
              </label>
            </div>
            {form.reentry_allowed && (
              <div>
                <label className="label">Entry gate</label>
                <input
                  className="input"
                  placeholder="GATE-A"
                  value={form.entry_gate}
                  onChange={(e) => setForm({ ...form, entry_gate: e.target.value })}
                />
              </div>
            )}
          </div>

          {!editingId && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">Ticket tiers</p>
                <button
                  type="button"
                  className="text-sm font-medium text-ink-blue hover:underline"
                  onClick={() =>
                    setTiers([
                      ...tiers,
                      {
                        name: `Tier ${tiers.length + 1}`,
                        base_price: 500,
                        tax_rate: 0.05,
                        fee_amount: 30,
                        quantity: 50,
                      },
                    ])
                  }
                >
                  + Add tier
                </button>
              </div>
              <div className="space-y-2">
                {tiers.map((tier, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
                    <input
                      className="input"
                      placeholder="Name"
                      value={tier.name}
                      onChange={(e) =>
                        setTiers(tiers.map((x, j) => (j === index ? { ...x, name: e.target.value } : x)))
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      placeholder="₹ base"
                      value={tier.base_price}
                      onChange={(e) =>
                        setTiers(
                          tiers.map((x, j) => (j === index ? { ...x, base_price: Number(e.target.value) } : x))
                        )
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      placeholder="tax rate"
                      value={tier.tax_rate}
                      onChange={(e) =>
                        setTiers(
                          tiers.map((x, j) => (j === index ? { ...x, tax_rate: Number(e.target.value) } : x))
                        )
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      placeholder="₹ fee"
                      value={tier.fee_amount}
                      onChange={(e) =>
                        setTiers(
                          tiers.map((x, j) => (j === index ? { ...x, fee_amount: Number(e.target.value) } : x))
                        )
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      min={1}
                      placeholder="qty"
                      value={tier.quantity}
                      onChange={(e) =>
                        setTiers(
                          tiers.map((x, j) => (j === index ? { ...x, quantity: Number(e.target.value) } : x))
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn-ghost px-3"
                      title="Remove tier"
                      onClick={() => setTiers(tiers.filter((_, j) => j !== index))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editingId && (
            <p className="text-xs text-ink-soft">
              Ticket tiers are not changed by an edit — create a new event to change pricing.
            </p>
          )}

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Create event"}
          </button>
        </form>
      )}

      {/* Events table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-mint-mist/50 text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-5 py-3">Event</th>
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Sold</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((event) => (
              <tr key={event.id} className="border-t border-line hover:bg-warm-ivory/60">
                <td className="px-5 py-3.5">
                  <Link href={`/events/${event.id}`} className="font-medium hover:text-ink-blue">
                    {event.title}
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {event.venue_name} · {event.category}
                  </p>
                </td>
                <td className="tnum px-5 py-3.5 text-ink-soft">{fmt(event.starts_at)}</td>
                <td className="tnum px-5 py-3.5">{event.sold}</td>
                <td className="px-5 py-3.5">
                  <StatusChip status={event.status} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button className="text-sm font-medium text-ink-blue hover:underline" onClick={() => startEdit(event)}>
                      Edit
                    </button>
                    {event.status === "scheduled" && (
                      <button
                        className="text-sm font-medium text-danger hover:underline"
                        onClick={() => {
                          setCancelTarget(event);
                          setError(null);
                        }}
                      >
                        Cancel + refund
                      </button>
                    )}
                    <button
                      className="text-sm font-medium text-ink-soft hover:underline"
                      onClick={() => deleteEvent(event)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cancel modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <form onSubmit={cancelEvent} className="card w-full max-w-md p-6">
            <h3 className="font-display text-lg font-bold text-danger">Cancel “{cancelTarget.title}”?</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Sales stop immediately, all holds release, and every succeeded payment is refunded
              automatically. This cannot be undone.
            </p>
            <label className="label mt-4">Reason (recorded in the audit log)</label>
            <textarea
              required
              minLength={3}
              className="input"
              value={cancelReason}
              placeholder="e.g. Artist unavailable"
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setCancelTarget(null)}>
                Keep event
              </button>
              <button type="submit" className="btn-danger">
                Cancel event &amp; refund
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Comp ticket */}
      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold">Issue complimentary ticket</h2>
        <p className="text-sm text-ink-soft">
          Authorized free issuance — recorded as a comp payment (Rule 5).
        </p>
        <form onSubmit={issueComp} className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr_1.4fr_auto]">
          <select
            required
            className="input"
            value={compEventId}
            onChange={(e) => setCompEventId(Number(e.target.value))}
          >
            <option value={0}>Select event…</option>
            {(events ?? [])
              .filter((event) => event.status === "scheduled")
              .map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
          </select>
          <input
            required
            className="input"
            placeholder="Seat ID (from DB)"
            value={compSeatId}
            onChange={(e) => setCompSeatId(e.target.value)}
          />
          <input
            required
            type="email"
            className="input"
            placeholder="customer@email.com"
            value={compEmail}
            onChange={(e) => setCompEmail(e.target.value)}
          />
          <button className="btn-primary" type="submit">
            Issue comp
          </button>
        </form>
      </div>
    </div>
  );
}
