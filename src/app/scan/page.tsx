"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/ui";

interface Verdict {
  result: "granted" | "denied";
  reason: string | null;
  ticket?: { ticket_number: string; holder: string; section: string; row_label: string; seat_number: number; tier: string };
  event?: { title: string; starts_at: string };
}
interface HistoryItem {
  qr: string;
  gate: string;
  verdict: Verdict;
  at: string;
}

export default function ScanPortal() {
  const [user, setUser] = useState<{ full_name: string; role: string } | null>(null);
  const [gate, setGate] = useState("GATE-A");
  const [qr, setQr] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null));
  }, []);

  const submit = useCallback(
    async (code?: string) => {
      const value = (code ?? qr).trim();
      if (!value || busy) return;
      setBusy(true);
      setVerdict(null);
      const res = await fetch("/api/v1/scans/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_code: value, gate_id: gate }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setVerdict({ result: "denied", reason: data.error ?? "Scan failed" });
        return;
      }
      setVerdict(data);
      setHistory((h) => [{ qr: value, gate, verdict: data, at: new Date().toLocaleTimeString("en-IN") }, ...h].slice(0, 10));
      setQr("");
    },
    [qr, gate, busy]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && document.activeElement?.tagName !== "TEXTAREA") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-ivory">
        <div className="card p-8 text-center">
          <p className="text-ink-soft">Sign in as gate staff to scan.</p>
          <Link href="/login?next=/scan" className="btn-primary mt-4">Sign in</Link>
        </div>
      </div>
    );
  }

  const granted = verdict?.result === "granted";

  return (
    <div className="flex min-h-screen flex-col bg-warm-ivory">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/admin" className="font-display font-semibold">← StagePass Gate</Link>
          <span className="text-sm text-ink-soft">{user.full_name} · {gate}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="card p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <div>
              <label className="label">QR / ticket code</label>
              <input autoFocus className="input font-mono" placeholder="sp_… paste or scan" value={qr}
                     onChange={(e) => setQr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            </div>
            <div>
              <label className="label">Gate</label>
              <select className="input" value={gate} onChange={(e) => setGate(e.target.value)}>
                {["GATE-A", "GATE-B", "GATE-VIP"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary mt-4 w-full" disabled={busy || !qr.trim()} onClick={() => submit()}>
            {busy ? "Validating…" : "Validate entry"}
          </button>
          <p className="mt-2 text-center text-xs text-ink-soft">Tip: paste the code and press Enter — the field refocuses for the next guest.</p>
        </div>

        {verdict && (
          <div className={`mt-6 rounded-2xl border p-8 text-center ${granted ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger"}`}>
            <p className="font-display text-4xl font-bold">{granted ? "✓ ENTRY GRANTED" : "✕ DENIED"}</p>
            {!granted && <p className="mt-2 text-lg font-medium">{verdict.reason}</p>}
            {granted && verdict.ticket && (
              <div className="mt-3 text-sm">
                <p className="font-mono">{verdict.ticket.ticket_number}</p>
                <p className="mt-1 text-lg font-semibold">{verdict.ticket.holder}</p>
                <p>{verdict.ticket.section} · Row {verdict.ticket.row_label} · Seat {verdict.ticket.seat_number} · {verdict.ticket.tier}</p>
                <p className="mt-1 text-ink-soft">{verdict.event?.title}</p>
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="card mt-6 overflow-hidden">
            <p className="border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Session history
            </p>
            <ul className="divide-y divide-line text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <span className={`chip ${h.verdict.result === "granted" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                    {h.verdict.result}
                  </span>
                  <span className="flex-1 truncate font-mono text-xs">{h.qr}</span>
                  {h.verdict.reason && <span className="text-xs text-ink-soft">{h.verdict.reason}</span>}
                  <span className="tnum text-xs text-ink-soft">{h.at}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
