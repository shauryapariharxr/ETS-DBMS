import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getEventList } from "@/lib/queries";
import { Footer, Header, StatusChip } from "@/components/ui";
import { fmtEventDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Music", "Comedy", "Tech", "Theatre", "Sports"];

function fmtDate(d: string) {
  return fmtEventDate(d, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateBadge(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }),
    month: d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }),
  };
}

const money = (value: number | string) => `₹${Number(value).toLocaleString("en-IN")}`;

const SEAT_ROWS = [
  { row: "A", taken: [1, 4, 9] },
  { row: "B", taken: [2, 3, 8, 11] },
  { row: "C", taken: [5] },
  { row: "D", taken: [] },
];

/** Decorative seat-map card for the hero — illustrates the booking model. */
function SeatPreview() {
  return (
    <div className="relative rounded-3xl border border-line bg-surface/80 p-5 shadow-card">
      <div className="pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-ink-blue/50 to-transparent" />
      <div className="flex items-center justify-between">
        <p className="mono-label">Seat map</p>
        <span className="chip border border-ink-blue/25 bg-ink-blue/10 text-ink-blue">
          Held 10 min
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-line/70 bg-[#080d14]/70 p-4">
        <div className="mx-auto mb-6 h-[3px] w-2/3 rounded-full bg-gradient-to-r from-transparent via-ink-blue/70 to-transparent" />
        <div className="space-y-2">
          {SEAT_ROWS.map((r) => (
            <div key={r.row} className="flex items-center justify-center gap-1.5">
              <span className="w-4 text-[10px] text-ink-soft">{r.row}</span>
              {Array.from({ length: 12 }).map((_, i) => {
                const selected = r.row === "B" && i === 4;
                const taken = r.taken.includes(i);
                return (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-[3px] ${
                      selected
                        ? "bg-ink-blue shadow-[0_0_10px_rgba(159,232,226,0.55)]"
                        : taken
                          ? "bg-[#1e2a3a]"
                          : "bg-sky-teal/45"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.22em] text-ink-soft">
          Stage
        </p>
      </div>

      <dl className="mt-5 flex items-end justify-between text-xs">
        <div>
          <dt className="text-ink-soft">Selected</dt>
          <dd className="mt-1 font-display text-[13px] font-medium text-ink">Stalls · B5</dd>
        </div>
        <div className="text-right">
          <dt className="text-ink-soft">Total</dt>
          <dd className="mt-1 font-display text-[13px] font-medium text-ink">₹985</dd>
        </div>
      </dl>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; category?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [session, { events, cities, pagination }] = await Promise.all([
    getSessionUser(),
    getEventList({ q: sp.q, city: sp.city, category: sp.category, page, limit: 9 }),
  ]);

  const filtered = Boolean(sp.q || sp.city || sp.category);

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.city) params.set("city", sp.city);
    if (sp.category) params.set("category", sp.category);
    params.set("page", String(target));
    return `/?${params.toString()}#events`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header session={session} />

      {/* ---- Hero ---- */}
      {/* No overflow-hidden here: clipping the soft glow at the section edge
          left a visible hairline right under the navbar. inset-x-0 keeps it
          inside the viewport, so nothing needs clipping. */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 -top-56 h-[42rem] bg-[radial-gradient(55%_55%_at_50%_10%,rgba(120,222,218,0.12),transparent_70%)]" />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.12fr_0.88fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-blue" />
                <span className="mono-label text-ink-soft">Seat-level ticketing</span>
              </p>

              <h1 className="mt-7 max-w-2xl font-display text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3.6rem]">
                Find your seat.
                <br />
                <span className="bg-gradient-to-r from-ink via-ink to-ink-soft bg-clip-text text-transparent">
                  Keep the memory.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                Pick the exact seat on a live map, pay once at checkout and walk in with a QR
                ticket. Prices are locked the moment you reserve.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/#events" className="btn-primary">
                  Browse events
                  <span aria-hidden>→</span>
                </Link>
                <Link href={session ? "/tickets" : "/login"} className="btn-fill">
                  {session ? "My tickets" : "I have a ticket"}
                </Link>
              </div>

              <dl className="mt-12 grid max-w-md grid-cols-3 divide-x divide-line border-y border-line/70 py-5">
                {[
                  { label: "Events live", value: String(pagination.total) },
                  { label: "Cities", value: String(cities.length) },
                  { label: "Entry", value: "QR" },
                ].map((stat, i) => (
                  <div key={stat.label} className={i === 0 ? "pr-5" : "px-5"}>
                    <dd className="tnum font-display text-2xl font-semibold text-ink">
                      {stat.value}
                    </dd>
                    <dt className="mono-label mt-2 text-ink-soft">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
              <SeatPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Catalogue ---- */}
      <main id="events" className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <div className="flex flex-col gap-6 border-t border-line/70 pt-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mono-label">On sale now</p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
              Upcoming events
            </h2>
            <p className="mt-2 text-[13.5px] text-ink-soft">
              {pagination.total} {pagination.total === 1 ? "event" : "events"} on sale
              {filtered ? " matching your filters" : ""}
            </p>
          </div>

          <form
            action="/"
            className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/70 p-2.5 lg:w-auto"
          >
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Search events"
              aria-label="Search events"
              className="input w-full sm:w-[210px]"
            />
            <select
              name="city"
              defaultValue={sp.city ?? ""}
              aria-label="City"
              className="input w-[calc(50%-4px)] sm:w-[140px]"
            >
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              name="category"
              defaultValue={sp.category ?? ""}
              aria-label="Category"
              className="input w-[calc(50%-4px)] sm:w-[150px]"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button className="btn-ghost w-full sm:w-auto" type="submit">
              Filter
            </button>
            {filtered && (
              <Link
                href="/#events"
                className="w-full px-1 text-center text-[13px] text-ink-soft transition-colors hover:text-ink sm:w-auto"
              >
                Reset
              </Link>
            )}
          </form>
        </div>

        {events.length === 0 ? (
          <div className="card mt-8 px-8 py-20 text-center">
            <p className="mono-label">Catalogue</p>
            {filtered ? (
              <>
                <p className="mt-4 font-display text-lg font-semibold text-ink">
                  Nothing matches those filters
                </p>
                <p className="mt-1 text-sm text-ink-soft">Try another city or category.</p>
                <Link href="/#events" className="btn-ghost mt-6">
                  Clear filters
                </Link>
              </>
            ) : (
              <>
                <p className="mt-4 font-display text-lg font-semibold text-ink">
                  No events on sale yet
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  New shows appear here as soon as they are published.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const badge = dateBadge(event.starts_at);
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="card card-hover group flex flex-col overflow-hidden"
                >
                  <div className="relative h-44 overflow-hidden border-b border-line">
                    {event.banner_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.banner_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-90"
                      />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(120,222,218,0.18),transparent_55%)]" />
                        <div className="grid-lines absolute inset-0 opacity-40" />
                      </>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface via-surface/60 to-transparent" />

                    <span className="chip absolute left-4 top-4 border border-line bg-[#0a0f18]/70 text-ink-soft backdrop-blur">
                      {event.category}
                    </span>

                    <div className="absolute bottom-3 left-4 flex items-baseline gap-2">
                      <span className="tnum font-display text-2xl font-semibold leading-none text-ink">
                        {badge.day}
                      </span>
                      <span className="mono-label text-ink-soft">{badge.month}</span>
                    </div>

                    <span className="absolute bottom-3 right-4 tnum text-[11px] text-ink-soft">
                      {event.capacity - event.tickets_sold} seats left
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-[16px] font-semibold leading-snug text-ink transition-colors group-hover:text-white">
                      {event.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] text-ink-soft">
                      {event.venue_name}, {event.city}
                    </p>
                    <p className="mono-label mt-4 text-ink-soft/80">{fmtDate(event.starts_at)}</p>

                    <div className="mt-auto flex items-end justify-between border-t border-line/70 pt-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                          From
                        </p>
                        <p className="tnum mt-1 font-display text-[15px] font-semibold text-ink">
                          {event.min_price ? money(event.min_price) : "Free"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.status !== "scheduled" && <StatusChip status={event.status} />}
                        <span
                          aria-hidden
                          className="grid h-7 w-7 place-items-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink-blue/40 group-hover:text-ink-blue"
                        >
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {pagination.pages > 1 && (
          <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Pagination">
            {pagination.page > 1 ? (
              <Link href={pageHref(pagination.page - 1)} className="btn-ghost btn-sm">
                ← Previous
              </Link>
            ) : (
              <span className="btn-ghost btn-sm pointer-events-none opacity-40">← Previous</span>
            )}
            <span className="tnum text-[13px] text-ink-soft">
              Page {pagination.page} of {pagination.pages}
            </span>
            {pagination.page < pagination.pages ? (
              <Link href={pageHref(pagination.page + 1)} className="btn-ghost btn-sm">
                Next →
              </Link>
            ) : (
              <span className="btn-ghost btn-sm pointer-events-none opacity-40">Next →</span>
            )}
          </nav>
        )}

        {/* ---- How it works ---- */}
        <section id="how-it-works" className="mt-20 border-t border-line/70 pt-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mono-label">How it works</p>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                Three steps from browse to gate
              </h2>
            </div>
            <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-soft">
              Every seat is reserved the instant you hold it, so two people can never buy the same
              ticket.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Pick a show",
                body: "Browse by city, date or category and open the event you want.",
              },
              {
                n: "02",
                title: "Choose your seats",
                body: "Select exact seats on the live map and check out with a single payment.",
              },
              {
                n: "03",
                title: "Scan in",
                body: "Show the QR ticket at the gate. One scan per ticket, re-entry only if allowed.",
              },
            ].map((step) => (
              <div key={step.n} className="rounded-2xl border border-line bg-surface/60 p-6">
                <span className="mono-label text-ink-blue">{step.n}</span>
                <h3 className="mt-4 font-display text-[15px] font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
