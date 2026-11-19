/**
 * Event timestamps are authored as venue wall-clock time and stored without an
 * offset (the seed writes "7:00 pm" as 19:00Z).
 *
 * Formatting them in the host timezone made the same show read differently
 * depending on where the page rendered: server components on Vercel (UTC) said
 * "22 Nov, 07:00 pm" while browser components in IST said "23 Nov, 12:30 am".
 * Every event date is therefore formatted in UTC — exactly as stored — so the
 * server and the browser always agree. Timestamps that are real instants (audit
 * log, scans, join dates) keep their normal local formatting.
 */
const EVENT_TZ = "UTC";

export function fmtEventDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("en-IN", { ...opts, timeZone: EVENT_TZ });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, in the stored wall clock. */
export function toWallClockInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}

/** Parses a datetime-local value as wall clock and returns the matching ISO instant. */
export function fromWallClockInput(value: string): string {
  return new Date(`${value}:00.000Z`).toISOString();
}
