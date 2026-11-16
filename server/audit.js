import { q } from "./db.js";

/** Append-only audit writer (business rule 10). Call after a successful mutation. */
export async function audit(actor, action, entityType, entityId, newData, oldData) {
  await q(
    `INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, new_data, old_data)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      actor?.id ?? null,
      action,
      entityType,
      entityId,
      newData === undefined ? null : JSON.stringify(newData),
      oldData === undefined ? null : JSON.stringify(oldData),
    ]
  );
}
