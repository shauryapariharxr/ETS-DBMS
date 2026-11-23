import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getEvent } from "@/lib/queries";
import { Footer, Header, StatusChip } from "@/components/ui";
import { fmtEventDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

function fmtDate(d: string) {
  return fmtEventDate(d, {
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

  const seatsLeft = event.capacity - event.tickets_sold;

  return (
    <div className="flex min-h-screen flex-col">
      <Header session={session} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <Link
          href="/#events"
          className="mt-6 inline-flex items-center gap-2 text-[13px] text-ink-soft transition-colors hover:text-ink"
        >
          ← All events
        </Link>

        <section className="relative mt-4 overflow-hidden rounded-3xl border border-line">
          {event.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.banner_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-45"
            />
          ) : (
            <div className="absolute inset-0 grid-lines opacity-40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f18] via-[#0a0f18]/85 to-[#0a0f18]/40" />

          <div className="relative p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip border border-ink-blue/30 bg-ink-blue/10 text-ink-blue">
                {event.category}
              </span>
              <StatusChip status={event.status} />
            </div>

            <h1 className="mt-5 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[40px]">
              {event.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
              {event.description}
            </p>

            <dl className="mt-8 grid gap-6 border-t border-line/70 pt-6 sm:grid-cols-3">
              <div>
                <dt className="mono-label">Date &amp; time</dt>
                <dd className="mt-2.5 text-[14px] text-ink">{fmtDate(event.starts_at)}</dd>
              </div>
              <div>
                <dt className="mono-label">Venue</dt>
                <dd className="mt-2.5 text-[14px] text-ink">
                  {event.venue_name}
                  <span className="block text-[13px] text-ink-soft">
                    {event.venue_address}, {event.city}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="mono-label">Entry</dt>
                <dd className="mt-2.5 text-[14px] text-ink">
                  {event.reentry_allowed ? `Re-entry allowed · ${event.entry_gate ?? "GATE-A"}` : "Single entry"}
                  <span className="block text-[13px] text-ink-soft">QR ticket at the gate</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="mt-6 grid gap-6 pb-4 lg:grid-cols-[1.65fr_1fr]">
          <section className="card min-w-0 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="mono-label">Pricing</p>
                <h2 className="mt-2.5 font-display text-lg font-semibold">Ticket tiers</h2>
              </div>
              <p className="text-[12px] text-ink-soft">Prices locked at purchase</p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[440px] text-sm">
                <thead className="bg-mint-mist/60 text-left">
                  <tr>
                    <th className="mono-label px-4 py-3 text-ink-soft">Tier</th>
                    <th className="mono-label px-4 py-3 text-ink-soft">Base</th>
                    <th className="mono-label px-4 py-3 text-ink-soft">Tax</th>
                    <th className="mono-label px-4 py-3 text-ink-soft">Fee</th>
                    <th className="mono-label px-4 py-3 text-right text-ink-soft">Available</th>
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
                          {left > 0 ? (
                            <span className="font-medium text-success">{left} left</span>
                          ) : (
                            <span className="text-danger">Sold out</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              Taxes and booking fees are shown separately and captured with every ticket, so the
              amount you see is the amount you pay.
            </p>
          </section>

          <aside className="card h-fit min-w-0 p-6">
            <p className="mono-label">Checkout</p>
            <h2 className="mt-2.5 font-display text-lg font-semibold">Ready when you are</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
              Pick exact seats on the interactive map. Seats are held for{" "}
              {process.env.HOLD_MINUTES_DEFAULT ?? 10} minutes while you pay.
            </p>

            <div className="mt-5">
              {event.status !== "scheduled" ? (
                <button className="btn-ghost w-full" disabled>
                  Sales closed
                </button>
              ) : (
                <Link href={`/events/${event.id}/seats`} className="btn-primary w-full">
                  Select seats
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>

            <div className="mt-5 border-t border-line/70 pt-5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">Seats available</span>
                <span className="tnum text-ink">
                  {seatsLeft} / {event.capacity}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ink-blue to-sky-teal"
                  style={{
                    width: `${Math.max(4, Math.min(100, (seatsLeft / Math.max(1, event.capacity)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
