"use client";

import { useCallback, useEffect, useState } from "react";

interface Venue {
  id: number;
  name: string;
  address: string;
  city: string;
  capacity: number;
  sections: number;
  seats: number;
}
interface SectionDraft {
  name: string;
  tier: string;
  rows: string;
  perRow: number;
}

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([
    { name: "Stalls", tier: "Standard", rows: "A,B,C", perRow: 12 },
  ]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/v1/venues").then((r) => r.json());
    setVenues(d.venues ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const totalSeats = sections.reduce(
    (sum, s) => sum + s.rows.split(",").filter(Boolean).length * (Number(s.perRow) || 0),
    0
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/v1/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, address, city,
        sections: sections.map((s) => ({
          name: s.name, tier: s.tier || s.name,
          rows: s.rows.split(",").map((r) => r.trim()).filter(Boolean),
          perRow: Number(s.perRow),
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    setMsg(`Venue "${data.venue.id}" created with ${totalSeats} seats.`);
    setName(""); setAddress(""); setCity("");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Venues</h1>
        <p className="text-sm text-ink-soft">Seat layouts are unique per venue (section + row + number).</p>
      </div>

      {msg && <p className="rounded-lg bg-success/10 px-4 py-2.5 text-sm font-medium text-success">{msg}</p>}
      {error && <p className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={create} className="card min-w-0 space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">New venue</h2>
          <div>
            <label className="label">Name</label>
            <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Address</label>
              <input required className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <label className="label">City</label>
              <input required className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label mb-0">Sections</p>
              <button type="button" className="text-sm font-medium text-ink-blue hover:underline"
                      onClick={() => setSections([...sections, { name: `Section ${sections.length + 1}`, tier: "", rows: "A,B", perRow: 10 }])}>
                + Add section
              </button>
            </div>
            {sections.map((s, i) => (
              <div key={i} className="mb-2 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
                <input className="input" placeholder="Section name" value={s.name}
                       onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input" placeholder="Tier name" value={s.tier}
                       onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, tier: e.target.value } : x)))} />
                <input className="input" placeholder="Rows (comma-sep): A,B,C" value={s.rows}
                       onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, rows: e.target.value } : x)))} />
                <input className="input" type="number" min={1} max={30} placeholder="Seats per row" value={s.perRow}
                       onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, perRow: Number(e.target.value) } : x)))} />
              </div>
            ))}
            <p className="text-xs text-ink-soft">Total seats: <strong className="tnum">{totalSeats}</strong></p>
          </div>

          <button className="btn-primary" type="submit">Create venue</button>
        </form>

        <div className="space-y-3">
          {(venues ?? []).map((v) => (
            <div key={v.id} className="card min-w-0 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold">{v.name}</p>
                  <p className="text-sm text-ink-soft">{v.address}, {v.city}</p>
                </div>
                <span className="chip bg-mint-mist text-ink-blue">#{v.id}</span>
              </div>
              <div className="mt-3 grid min-w-0 grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-mint-mist/60 py-2">
                  <p className="tnum font-semibold">{v.seats}</p>
                  <p className="text-[10px] text-ink-soft">seats</p>
                </div>
                <div className="rounded-lg bg-mint-mist/60 py-2">
                  <p className="tnum font-semibold">{v.sections}</p>
                  <p className="text-[10px] text-ink-soft">sections</p>
                </div>
                <div className="rounded-lg bg-mint-mist/60 py-2">
                  <p className="tnum font-semibold">{v.capacity}</p>
                  <p className="text-[10px] text-ink-soft">capacity</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
