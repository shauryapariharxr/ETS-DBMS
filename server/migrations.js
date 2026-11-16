// Applies SQL migrations from src/db/migrations in filename order, tracked in
// schema_migrations. Shared by the CLI (scripts/db-migrate.mjs) and the boot-time
// setup path (server/setup.js) so both behave identically.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const DEFAULT_MIGRATIONS_DIR = path.resolve(process.cwd(), "src", "db", "migrations");

/** Migration files may wrap themselves in BEGIN/COMMIT; we own the transaction. */
const stripTransactionControl = (sql) =>
  sql.replace(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;\s*$/gim, "");

/**
 * Creates the tracking table, then applies every migration not yet recorded.
 * Each migration and its tracking row commit together.
 */
export async function runMigrations(
  client,
  { dir = DEFAULT_MIGRATIONS_DIR, log = console.log } = {}
) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );

  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  const { rows } = await client.query("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.name));
  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    log(`= schema up to date (${files.length} migration(s) applied)`);
    return { applied: 0, total: files.length };
  }

  for (const file of pending) {
    const sql = stripTransactionControl(readFileSync(path.join(dir, file), "utf8"));
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      log(`✓ applied migration ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${error.message}`);
    }
  }

  return { applied: pending.length, total: files.length };
}
