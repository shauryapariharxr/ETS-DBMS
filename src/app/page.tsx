import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getEventList } from "@/lib/queries";
import { Footer, Header, StatusChip } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Music", "Comedy", "Tech", "Theatre", "Sports"];

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", {
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
      <section className="bg-gradient-to-r from-ink-blue to-sky-teal text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Find your seat. Keep the memory.
          </h1>
          <p className="mt-2 max-w-xl text-white/85">
            Interactive seat maps, fair pricing locked at checkout, and QR entry — all backed by an
            Express REST API on PostgreSQL.
          </p>
          <form action="/" className="mt-6 flex flex-wrap gap-2">
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Search events…"
              className="input max-w-xs border-transparent text-ink"
            />
            <select
              name="city"
              defaultValue={sp.city ?? ""}
              className="input max-w-[160px] border-transparent text-ink"
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
              className="input max-w-[150px] border-transparent text-ink"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button className="btn bg-white font-semibold text-ink-blue hover:bg-mint-mist" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
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
                className="card group overflow-hidden transition hover:shadow-[var(--shadow-lift)]"
              >
                <div className="relative flex h-28 items-end bg-gradient-to-br from-ink-blue to-sky-teal p-4">
                  {event.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.banner_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <span className="chip relative bg-white/90 text-ink-blue">{event.category}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-ink-blue">
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
