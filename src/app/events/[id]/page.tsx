import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getEvent } from "@/lib/queries";
import { Footer, Header, StatusChip } from "@/components/ui";

export const dynamic = "force-dynamic";

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, event] = await Promise.all([getSessionUser(), getEvent(Number(id))]);
  if (!event) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <Header session={session} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Link href="/" className="text-sm text-ink-blue hover:underline">
          ← All events
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-ink-blue via-ink-blue to-sky-teal p-8 text-white">
          <span className="chip bg-white/90 text-ink-blue">{event.category}</span>
          <h1 className="mt-3 font-display text-3xl font-bold">{event.title}</h1>
          <p className="mt-2 max-w-2xl text-white/85">{event.description}</p>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>📅 {fmtDate(event.starts_at)}</span>
            <span>📍 {event.venue_name}, {event.city}</span>
            <span>🚪 {event.reentry_allowed ? `Re-entry allowed · ${event.entry_gate}` : "Single entry"}</span>
            <StatusChip status={event.status} />
          </div>
        </div>

        {event.banner_url && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.banner_url}
              alt={`${event.title} banner`}
              className="h-64 w-full object-cover"
            />
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="card p-6">
            <h2 className="font-display text-lg font-semibold">Ticket tiers</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-mint-mist/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-4 py-2.5">Tier</th>
                    <th className="px-4 py-2.5">Base</th>
                    <th className="px-4 py-2.5">Tax</th>
                    <th className="px-4 py-2.5">Fee</th>
                    <th className="px-4 py-2.5 text-right">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {event.tiers.map((t) => {
                    const left = t.quantity - t.sold;
                    return (
                      <tr key={t.id} className="border-t border-line">
                        <td className="px-4 py-3 font-medium">{t.name}</td>
                        <td className="tnum px-4 py-3">₹{Number(t.base_price).toLocaleString("en-IN")}</td>
                        <td className="tnum px-4 py-3 text-ink-soft">{(Number(t.tax_rate) * 100).toFixed(1)}%</td>
                        <td className="tnum px-4 py-3 text-ink-soft">₹{Number(t.fee_amount).toLocaleString("en-IN")}</td>
                        <td className="tnum px-4 py-3 text-right">
                          {left > 0 ? <span className="font-medium text-success">{left} left</span> : <span className="text-danger">Sold out</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Prices, taxes and fees are locked at the moment of purchase.
            </p>
          </section>

          <aside className="card h-fit p-6">
            <h2 className="font-display text-lg font-semibold">Ready when you are</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Pick exact seats on the interactive map. Held for {process.env.HOLD_MINUTES_DEFAULT ?? 10} minutes
              while you check out.
            </p>
            <div className="mt-5 space-y-3">
              {event.status !== "scheduled" ? (
                <button className="btn-primary w-full" disabled>
                  Sales closed
                </button>
              ) : (
                <Link href={`/events/${event.id}/seats`} className="btn-primary w-full">
                  Select seats
                </Link>
              )}
              <p className="text-center text-xs text-ink-soft">
                {event.capacity - event.tickets_sold} of {event.capacity} seats available
              </p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
