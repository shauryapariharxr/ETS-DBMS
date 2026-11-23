"use client";

import { useEffect, useState } from "react";

interface AuditRow {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  actor: string | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}
interface RefundRow {
  id: number;
  amount: string;
  status: string;
  reason: string;
  created_at: string;
  customer: string;
  event: string;
}

function fmt(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditRow[] | null>(null);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/v1/admin/audit?limit=200")
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs ?? []);
        setRefunds(d.refunds ?? []);
      });
  }, []);

  const filtered = (logs ?? []).filter(
    (l) =>
      !filter ||
      l.action.includes(filter.toLowerCase()) ||
      (l.actor ?? "").toLowerCase().includes(filter.toLowerCase()) ||
      l.entity_type.includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Audit log</h1>
          <p className="text-sm text-ink-soft">Append-only record of every mutation (Rule 10).</p>
        </div>
        <input className="input sm:max-w-xs" placeholder="Filter by action, actor, entity…"
               value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {refunds.length > 0 && (
        <section className="card min-w-0 p-6">
          <h2 className="font-display text-lg font-semibold">Refunds</h2>
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase text-ink-soft">
              <tr><th className="py-2">Customer</th><th className="py-2">Event</th><th className="py-2">Amount</th><th className="py-2">Reason</th><th className="py-2">When</th></tr>
            </thead>
            <tbody>
              {refunds.slice(0, 5).map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2.5">{r.customer}</td>
                  <td className="py-2.5">{r.event}</td>
                  <td className="tnum py-2.5 font-medium">₹{Number(r.amount).toLocaleString("en-IN")}</td>
                  <td className="py-2.5 text-ink-soft">{r.reason}</td>
                  <td className="tnum py-2.5 text-ink-soft">{fmt(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-mint-mist/50 text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Actor</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Entity</th>
              <th className="px-5 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-line align-top hover:bg-mint-mist/40">
                <td className="tnum whitespace-nowrap px-5 py-3 text-ink-soft">{fmt(l.created_at)}</td>
                <td className="px-5 py-3">{l.actor ?? "system"}</td>
                <td className="px-5 py-3">
                  <span className="chip bg-mint-mist text-ink-blue">{l.action}</span>
                </td>
                <td className="px-5 py-3 text-ink-soft">
                  {l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ""}
                </td>
                <td className="max-w-xs truncate px-5 py-3 font-mono text-xs text-ink-soft" title={JSON.stringify(l.new_data)}>
                  {l.new_data ? JSON.stringify(l.new_data) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-ink-soft">No matching entries.</p>}
      </div>
    </div>
  );
}
