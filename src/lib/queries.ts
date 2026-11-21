import { cookies } from "next/headers";

/** Express API origin — server-side only. */
const API_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000"
).replace(/\/+$/, "");

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface EventListItem {
  id: number;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  status: string;
  banner_url: string | null;
  venue_name: string;
  city: string;
  min_price: string | null;
  tickets_sold: number;
  capacity: number;
}

export interface EventTier {
  id: number;
  name: string;
  base_price: string;
  tax_rate: string;
  fee_amount: string;
  quantity: number;
  sold: number;
}

export interface EventDetail extends EventListItem {
  venue_id: number;
  reentry_allowed: boolean;
  entry_gate: string | null;
  venue_address: string;
  tiers: EventTier[];
}

/** Server components call the same REST API the browser uses. */
async function apiGet<T>(path: string): Promise<T | null> {
  const store = await cookies();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { cookie: store.toString() },
      cache: "no-store",
    });
  } catch {
    throw new Error(`StagePass API unreachable at ${API_URL} — start it with "npm run api"`);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `API request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/**
 * The catalogue is the hottest read in the app and the API runs on a free tier
 * that sleeps when idle, so an uncached render can pay a 30–50 s cold start.
 * A few seconds of per-instance caching keeps refreshes and pagination instant
 * without hiding newly published events for long.
 */
const EVENT_LIST_TTL_MS = 30_000;
let eventListCache: { key: string; at: number; data: EventListPayload } | null = null;

interface EventListPayload {
  events: EventListItem[];
  cities: string[];
  pagination: Pagination;
}

export async function getEventList(opts: {
  q?: string;
  city?: string;
  category?: string;
  page?: number;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.city) params.set("city", opts.city);
  if (opts.category) params.set("category", opts.category);
  params.set("page", String(opts.page ?? 1));
  params.set("limit", String(opts.limit ?? 9));

  const path = `/api/v1/events?${params.toString()}`;
  const cached = eventListCache;
  if (cached && cached.key === path && Date.now() - cached.at < EVENT_LIST_TTL_MS) {
    return cached.data;
  }

  const data = await apiGet<EventListPayload>(path);

  const result =
    data ?? { events: [], cities: [], pagination: { page: 1, limit: 9, total: 0, pages: 1 } };
  eventListCache = { key: path, at: Date.now(), data: result };
  return result;
}

export async function getEvent(id: number): Promise<EventDetail | null> {
  const data = await apiGet<{ event: EventDetail }>(`/api/v1/events/${id}`);
  return data?.event ?? null;
}
