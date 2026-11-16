// Applies SQL migrations from src/db/migrations in filename order, tracked in schema_migrations.
import { readFileSync } from "node:fs";
import pg from "pg";
import { runMigrations } from "../server/migrations.js";

function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !m[1].startsWith("#") && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env — rely on real env vars */
  }
}
loadEnv();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const result = await runMigrations(client);
    console.log(`Migrations complete: ${result.applied} applied, ${result.total} total.`);
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
