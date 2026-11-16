import pg from "pg";
import { DATABASE_URL } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });

pool.on("error", (err) => console.error("[db] idle client error:", err.message));

/** Parameterised query helper — every call uses $n placeholders, never string concatenation. */
export async function q(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

/** First row or null. */
export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] ?? null;
}

/** Runs fn inside BEGIN/COMMIT; any throw rolls the whole unit of work back. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = {
      query: async (text, params = []) => (await client.query(text, params)).rows,
    };
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[db] rollback failed:", rollbackError.message);
    }
    throw err;
  } finally {
    client.release();
  }
}
