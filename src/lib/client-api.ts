/**
 * Small fetch wrapper for browser calls to the StagePass API.
 *
 * The API runs on a free hosting tier, so the first request after a quiet
 * period can take 30–50 seconds while the instance wakes up. A plain
 * `await fetch(); await res.json()` would either hang the form forever or throw
 * on the gateway's HTML error page and leave the submit button stuck on
 * "Creating…". This wrapper always resolves to either data or a readable error.
 */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Default timeout is generous enough for a cold start, short enough to fail visibly. */
export const API_TIMEOUT_MS = 60_000;

async function request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(path, { ...init, signal: controller.signal });
    const text = await res.text();

    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Gateway/proxy error pages are HTML, not JSON.
      throw new ApiError(
        res.status >= 500
          ? "The server is not responding right now. Please try again in a moment."
          : `Unexpected response from the server (${res.status}). Please try again.`,
        res.status
      );
    }

    if (!res.ok) {
      const body = data as { error?: string; code?: string } | null;
      throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.code);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "The server took too long to answer. It may be starting up — please try again."
      );
    }
    throw new ApiError("Could not reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

export function postJson<T>(path: string, body: unknown, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
}

/**
 * Fire-and-forget health check used when a sign-in or sign-up page opens, so a
 * sleeping API instance starts booting before the visitor finishes typing.
 */
export function warmUpApi() {
  void fetch("/api/v1/health", { cache: "no-store" }).catch(() => {});
}
