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

const money = (value: number | string) => `₹${Number(value).toLocaleString("en-IN")}`;

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

      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
          <p className="mono-label flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-blue" />
            Seat-level ticketing
          </p>

          <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.04] tracking-[-0.025em] sm:text-6xl">
            Find your seat.
            <br />
            <span className="text-ink-soft">Keep the memory.</span>
          </h1>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-soft">
            Pick the exact seat on a live map, pay once at checkout and walk in with a QR ticket.
            Prices are locked the moment you reserve.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#events" className="btn-primary">
              Browse events
            </a>
            <Link href={session ? "/tickets" : "/login"} className="btn-ghost">
              {session ? "My tickets" : "I have a ticket"}
            </Link>
          </div>

          <dl className="mt-14 grid max-w-md grid-cols-3 divide-x divide-line border-t border-line pt-6">
            {[
              { label: "Events live", value: String(pagination.total) },
              { label: "Cities", value: String(cities.length) },
              { label: "Entry", value: "QR" },
            ].map((stat, i) => (
              <div key={stat.label} className={i === 0 ? "pr-5" : "px-5"}>
                <dd className="tnum font-display text-2xl font-semibold text-ink">{stat.value}</dd>
                <dt className="mono-label mt-1.5 text-ink-soft">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <main id="events" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-5 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">Upcoming events</h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              {pagination.total} {pagination.total === 1 ? "event" : "events"} on sale
              {filtered ? " matching your filters" : ""}
            </p>
          </div>

          <form action="/" className="flex flex-wrap items-center gap-2">
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Search events"
              className="input max-w-[220px]"
            />
            <select name="city" defaultValue={sp.city ?? ""} className="input max-w-[150px]">
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
              className="input max-w-[150px]"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button className="btn-ghost btn-sm" type="submit">
              Filter
            </button>
            {filtered && (
              <Link href="/#events" className="text-[13px] text-ink-soft hover:text-ink">
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
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="card group flex flex-col overflow-hidden transition-colors duration-200 hover:border-[#2a3d51]"
              >
                <div className="relative h-40 overflow-hidden border-b border-line">
                  <div className="grid-lines absolute inset-0 opacity-30" />
                  <div className="absolute inset-0 bg-gradient-to-t from-warm-ivory/90 via-transparent to-transparent" />
                  {event.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.banner_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-300 group-hover:opacity-100"
                    />
                  ) : null}
                  <span className="chip absolute left-4 top-4 border border-line bg-warm-ivory/85 text-ink-soft backdrop-blur">
                    {event.category}
                  </span>
                  <span className="mono-label absolute bottom-3 left-4 text-ink-soft">
                    {fmtDate(event.starts_at)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-[17px] font-semibold leading-snug">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    {event.venue_name}, {event.city}
                  </p>

                  <div className="mt-auto flex items-end justify-between pt-6">
                    <div>
                      <p className="mono-label text-ink-soft">From</p>
                      <p className="tnum mt-1 font-display text-base font-semibold text-ink">
                        {event.min_price ? money(event.min_price) : "Free"}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusChip status={event.status} />
                      <p className="mt-2 text-xs text-ink-soft">
                        {event.capacity - event.tickets_sold} seats left
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
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
      </main>
      <Footer />
    </div>
  );
}
