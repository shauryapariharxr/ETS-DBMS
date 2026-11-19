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

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.city) params.set("city", sp.city);
    if (sp.category) params.set("category", sp.category);
    params.set("page", String(target));
    return `/?${params.toString()}`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header session={session} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute -top-56 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-ink-blue/15 blur-[130px]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mono-label">Live ticketing infrastructure</p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.03] tracking-tight sm:text-6xl">
            Find your seat.{" "}
            <span className="bg-gradient-to-r from-ink-blue via-sky-teal to-ink-blue bg-clip-text text-transparent">
              Keep the memory.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-ink-soft">
            Interactive seat maps, prices locked at checkout and QR entry at the gate —
            backed by a REST API and PostgreSQL.
          </p>

          <dl className="mt-8 flex flex-wrap gap-3">
            {[
              { label: "Events live", value: pagination.total },
              { label: "Cities", value: cities.length },
              { label: "Entry", value: "QR" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-line bg-surface/70 px-4 py-3 backdrop-blur"
              >
                <dt className="mono-label">{stat.label}</dt>
                <dd className="tnum mt-1.5 font-display text-lg font-semibold text-ink">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <form
            action="/"
            className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface/80 p-3 backdrop-blur"
          >
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Search events…"
              className="input max-w-xs border-transparent bg-transparent"
            />
            <select name="city" defaultValue={sp.city ?? ""} className="input max-w-[160px] border-transparent bg-transparent">
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
              className="input max-w-[150px] border-transparent bg-transparent"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button className="btn-primary" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-xl font-semibold">
            Upcoming events{" "}
            <span className="text-sm font-normal text-ink-soft">
              ({pagination.total})
            </span>
          </h2>
          {(sp.q || sp.city || sp.category) && (
            <Link href="/" className="text-sm text-ink-blue hover:underline">
              Clear filters
            </Link>
          )}
        </div>

        {events.length === 0 ? (
          <div className="card p-12 text-center text-ink-soft">
            No events match your filters.{" "}
            <Link href="/" className="text-ink-blue hover:underline">
              Reset
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="card group overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="relative flex h-32 items-end bg-gradient-to-br from-ink-blue/25 via-sky-teal/10 to-transparent p-4">
                  <div className="grid-lines absolute inset-0 opacity-70" />
                  <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full border border-ink-blue/20 bg-ink-blue/5" />
                  <div className="pointer-events-none absolute right-6 top-6 h-16 w-16 rounded-full border border-sky-teal/20" />
                  {event.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.banner_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <span className="chip relative border border-ink-blue/30 bg-[#05070b]/85 text-ink-blue backdrop-blur">
                    {event.category}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold leading-snug transition group-hover:text-ink-blue">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    {fmtDate(event.starts_at)} · {event.venue_name}, {event.city}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="tnum text-sm font-semibold text-ink-blue">
                      {event.min_price
                        ? `from ₹${Number(event.min_price).toLocaleString("en-IN")}`
                        : "Free"}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {event.capacity - event.tickets_sold} seats left
                    </span>
                  </div>
                  <div className="mt-3">
                    <StatusChip status={event.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {pagination.pages > 1 && (
          <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
            {pagination.page > 1 ? (
              <Link href={pageHref(pagination.page - 1)} className="btn-ghost">
                ← Previous
              </Link>
            ) : (
              <span className="btn-ghost pointer-events-none opacity-40">← Previous</span>
            )}
            <span className="tnum text-ink-soft">
              Page {pagination.page} of {pagination.pages}
            </span>
            {pagination.page < pagination.pages ? (
              <Link href={pageHref(pagination.page + 1)} className="btn-ghost">
                Next →
              </Link>
            ) : (
              <span className="btn-ghost pointer-events-none opacity-40">Next →</span>
            )}
          </nav>
        )}
      </main>
      <Footer />
    </div>
  );
}
