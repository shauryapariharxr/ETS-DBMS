import { q, withTransaction } from "../db.js";
import { ApiError } from "../errors.js";
import { audit } from "../audit.js";

/**
 * Validates a QR code at a gate (rules 6 & 7).
 * Every attempt — granted or denied — is logged in the same transaction (rule 10).
 */
export async function validateScan(scanner, qrCode, gateId) {
  if (!qrCode) throw new ApiError(400, "QR code is required", "QR_REQUIRED");
  if (!gateId) throw new ApiError(400, "Gate ID is required", "GATE_REQUIRED");

  const verdict = await withTransaction(async (tx) => {
    const [ticket] = await tx.query(
      `SELECT t.id AS ticket_id, t.status, t.ticket_number,
              u.full_name AS holder, s.section, s.row_label, s.seat_number,
              s.tier_name AS tier, e.title AS event_title, e.starts_at,
              e.status AS event_status, e.entry_gate, e.reentry_allowed
       FROM (SELECT $1::text AS qr) x
       LEFT JOIN tickets t ON t.qr_code = x.qr
       LEFT JOIN users u   ON u.id = t.user_id
       LEFT JOIN seats s   ON s.id = t.seat_id
       LEFT JOIN events e  ON e.id = t.event_id`,
      [qrCode]
    );

    const deny = async (reason, ticketId = ticket?.ticket_id ?? null) => {
      await tx.query(
        `INSERT INTO scans(ticket_id, gate_id, scanned_by, result, reason)
         VALUES ($1, $2, $3, 'denied', $4)`,
        [ticketId, gateId, scanner.id, reason]
      );
      return { result: "denied", reason };
    };

    if (!ticket || !ticket.ticket_id) return deny("Unknown ticket code", null);
    if (ticket.event_status === "cancelled") return deny("Event cancelled");
    if (ticket.status === "pending") return deny("Payment not completed");
    if (ticket.status === "cancelled") return deny("Ticket cancelled");
    if (ticket.status === "used") return deny("Ticket already scanned"); // rule 7

    if (ticket.entry_gate && ticket.entry_gate !== gateId) {
      return deny(`Wrong gate — use ${ticket.entry_gate}`);
    }

    if (!ticket.reentry_allowed) {
      const [prior] = await tx.query(
        `SELECT id FROM scans WHERE ticket_id = $1 AND result = 'granted' LIMIT 1`,
        [ticket.ticket_id]
      );
      if (prior) return deny("Ticket already scanned");
    }

    // Re-entry events keep the ticket active and count granted scans;
    // single-entry events flip it to 'used' permanently.
    if (!ticket.reentry_allowed) {
      await tx.query(`UPDATE tickets SET status = 'used' WHERE id = $1`, [ticket.ticket_id]);
    }
    await tx.query(
      `INSERT INTO scans(ticket_id, gate_id, scanned_by, result, reason)
       VALUES ($1, $2, $3, 'granted', NULL)`,
      [ticket.ticket_id, gateId, scanner.id]
    );

    return {
      result: "granted",
      reason: null,
      ticket: {
        ticket_number: ticket.ticket_number,
        holder: ticket.holder,
        section: ticket.section,
        row_label: ticket.row_label,
        seat_number: ticket.seat_number,
        tier: ticket.tier,
      },
      event: { title: ticket.event_title, starts_at: ticket.starts_at },
    };
  });

  await audit(scanner, `scan.${verdict.result}`, "scan", null, {
    gate: gateId,
    result: verdict.result,
    reason: verdict.reason,
    ticket: verdict.ticket?.ticket_number ?? null,
  });

  return verdict;
}

/** Recent scan feed for the admin dashboard. */
export async function recentScans(limit = 20) {
  return q(
    `SELECT sc.id, sc.result, sc.reason, sc.gate_id, sc.scanned_at,
            t.ticket_number, e.title AS event_title
     FROM scans sc
     LEFT JOIN tickets t ON t.id = sc.ticket_id
     LEFT JOIN events e  ON e.id = t.event_id
     ORDER BY sc.scanned_at DESC
     LIMIT $1`,
    [limit]
  );
}
