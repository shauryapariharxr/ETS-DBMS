// Manual sweep runner (business rule 9): npm run db:sweep
// Expires seat holds and cancels stale pending tickets. The Express API runs the
// same sweep every 30 seconds; this script is for an on-demand run.
import { readFileSync } from "node:fs";
import pg from "pg";

try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  /* no .env — rely on real environment variables */
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const holds = await client.query(
  `DELETE FROM seat_holds WHERE expires_at <= now() RETURNING id`
);
const pendings = await client.query(
  `UPDATE tickets SET status = 'cancelled'
   WHERE status = 'pending' AND issued_at < now() - interval '15 minutes' RETURNING id`
);
console.log(`Swept ${holds.rowCount} holds, ${pendings.rowCount} stale pendings.`);
await client.end();
