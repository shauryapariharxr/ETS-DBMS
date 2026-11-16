import { Router } from "express";
import { body, param, query } from "express-validator";
import { validate } from "../validation.js";
import { requireRole } from "../auth.js";
import {
  adminStats,
  cancelEvent,
  compTicket,
  createUser,
  deleteUser,
  listAllEvents,
  listAuditLogs,
  listRefunds,
  listUsers,
  occupancyByEvent,
  updateUser,
} from "../services/admin.js";
import { recentScans } from "../services/scans.js";

export const adminRouter = Router();

/** GET /api/v1/admin/stats — dashboard counts, revenue series and occupancy. */
adminRouter.get("/stats", requireRole("admin"), async (_req, res) => {
  const [stats, occupancy, scans] = await Promise.all([
    adminStats(),
    occupancyByEvent(),
    recentScans(10),
  ]);
  res.json({ ...stats, occupancy, recent_scans: scans });
});

/** GET /api/v1/admin/events — every event, including cancelled ones. */
adminRouter.get(
  "/events",
  requireRole("admin", "organizer"),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  async (req, res) => {
    const result = await listAllEvents({
      search: req.query.q ? String(req.query.q).trim() : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      page: Number(req.query.page ?? 1) || 1,
      limit: Number(req.query.limit ?? 50) || 50,
    });
    res.json(result);
  }
);

/** GET /api/v1/admin/users — paginated user list with search and role filter. */
adminRouter.get(
  "/users",
  requireRole("admin"),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  async (req, res) => {
    const result = await listUsers({
      search: req.query.q ? String(req.query.q).trim() : undefined,
      role: req.query.role ? String(req.query.role) : undefined,
      page: Number(req.query.page ?? 1) || 1,
      limit: Number(req.query.limit ?? 50) || 50,
    });
    res.json(result);
  }
);

/** POST /api/v1/admin/users — create a staff or customer account. */
adminRouter.post(
  "/users",
  requireRole("admin"),
  body("email").trim().isEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("full_name").trim().isLength({ min: 2 }).withMessage("Full name is required"),
  body("role")
    .isIn(["customer", "organizer", "admin", "scanner"])
    .withMessage("Role must be customer, organizer, admin or scanner"),
  validate,
  async (req, res) => {
    const user = await createUser(req.user, req.body);
    res.status(201).json({ user });
  }
);

/** PATCH /api/v1/admin/users/:id — update name and/or role. */
adminRouter.patch(
  "/users/:id",
  requireRole("admin"),
  param("id").isInt({ min: 1 }).toInt(),
  body("full_name").optional().trim().isLength({ min: 2, max: 120 }),
  body("role")
    .optional()
    .isIn(["customer", "organizer", "admin", "scanner"])
    .withMessage("Role must be customer, organizer, admin or scanner"),
  validate,
  async (req, res) => {
    const user = await updateUser(req.user, req.params.id, req.body);
    res.json({ user });
  }
);

/** DELETE /api/v1/admin/users/:id */
adminRouter.delete(
  "/users/:id",
  requireRole("admin"),
  param("id").isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    const user = await deleteUser(req.user, req.params.id);
    res.json({ deleted: true, user });
  }
);

/** GET /api/v1/admin/audit — append-only audit log + refund records. */
adminRouter.get(
  "/audit",
  requireRole("admin"),
  query("limit").optional().isInt({ min: 1, max: 500 }).toInt(),
  query("page").optional().isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    const [logs, refunds] = await Promise.all([
      listAuditLogs({
        search: req.query.q ? String(req.query.q).trim() : undefined,
        action: req.query.action ? String(req.query.action) : undefined,
        page: Number(req.query.page ?? 1) || 1,
        limit: Number(req.query.limit ?? 100) || 100,
      }),
      listRefunds(),
    ]);
    res.json({ logs: logs.logs, pagination: logs.pagination, refunds });
  }
);

/** POST /api/v1/admin/events/:id/cancel — stop sales and refund every payment (rule 8). */
adminRouter.post(
  "/events/:id/cancel",
  requireRole("admin"),
  param("id").isInt({ min: 1 }).toInt(),
  body("reason").trim().isLength({ min: 3 }).withMessage("Cancellation reason is required"),
  validate,
  async (req, res) => {
    const result = await cancelEvent(req.user, req.params.id, req.body.reason);
    res.json(result);
  }
);

/** POST /api/v1/admin/tickets/comp — authorized complimentary ticket (rule 5). */
adminRouter.post(
  "/tickets/comp",
  requireRole("admin"),
  body("event_id").isInt({ min: 1 }).withMessage("Event is required").toInt(),
  body("seat_id").isInt({ min: 1 }).withMessage("Seat is required").toInt(),
  body("customer_email").trim().isEmail().withMessage("Valid customer email required"),
  validate,
  async (req, res) => {
    const ticket = await compTicket(
      req.user,
      req.body.event_id,
      req.body.seat_id,
      req.body.customer_email
    );
    res.status(201).json({ ticket });
  }
);
