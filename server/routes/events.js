import { Router } from "express";
import { body, param, query } from "express-validator";
import { validate } from "../validation.js";
import { authRequired, requireRole } from "../auth.js";
import { ApiError } from "../errors.js";
import {
  createEvent,
  deleteEvent,
  getEvent,
  getSeatMap,
  listCities,
  listEvents,
  updateEvent,
} from "../services/events.js";
import { holdSeats, sweepExpired } from "../services/booking.js";
import { HOLD_MINUTES, MAX_SEATS_PER_ORDER } from "../config.js";

export const eventsRouter = Router();

const bannerRule = body("banner_url")
  .optional({ values: "falsy" })
  .isString()
  .trim()
  .matches(/^\/uploads\/[\w.-]+$/)
  .withMessage("Banner must be a file uploaded through /api/v1/uploads");

const createEventRules = [
  body("venue_id").isInt({ min: 1 }).withMessage("Please choose a venue").toInt(),
  body("title").trim().isLength({ min: 2, max: 160 }).withMessage("Title must be 2-160 characters"),
  body("description").optional().isString().trim().isLength({ max: 4000 }),
  body("category").optional().isString().trim().isLength({ min: 2, max: 40 }),
  body("starts_at").isISO8601().withMessage("Valid start time required"),
  body("ends_at").isISO8601().withMessage("Valid end time required"),
  body("reentry_allowed").optional().isBoolean().toBoolean(),
  body("entry_gate").optional({ values: "falsy" }).isString().trim().isLength({ max: 40 }),
  bannerRule,
  body("tiers").isArray({ min: 1 }).withMessage("At least one ticket tier is required"),
  body("tiers.*.name").trim().isLength({ min: 1, max: 60 }).withMessage("Tier name is required"),
  body("tiers.*.base_price").isFloat({ min: 0 }).withMessage("Tier price must be ≥ 0").toFloat(),
  body("tiers.*.tax_rate").isFloat({ min: 0, max: 1 }).withMessage("Tax rate must be 0-1").toFloat(),
  body("tiers.*.fee_amount").isFloat({ min: 0 }).withMessage("Fee must be ≥ 0").toFloat(),
  body("tiers.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be ≥ 1").toInt(),
];

const updateEventRules = [
  param("id").isInt({ min: 1 }).withMessage("Invalid event id").toInt(),
  body("venue_id").optional().isInt({ min: 1 }).toInt(),
  body("title").optional().trim().isLength({ min: 2, max: 160 }),
  body("description").optional().isString().trim().isLength({ max: 4000 }),
  body("category").optional().isString().trim().isLength({ min: 2, max: 40 }),
  body("starts_at").optional().isISO8601().withMessage("Valid start time required"),
  body("ends_at").optional().isISO8601().withMessage("Valid end time required"),
  body("reentry_allowed").optional().isBoolean().toBoolean(),
  body("entry_gate").optional({ values: "falsy" }).isString().trim().isLength({ max: 40 }),
  body("status").optional().isIn(["scheduled", "completed"]).withMessage("Invalid status"),
  bannerRule,
];

/** GET /api/v1/events — search (q), filter (city, category), sort, pagination. */
eventsRouter.get(
  "/",
  query("page").optional().isInt({ min: 1 }).withMessage("page must be ≥ 1").toInt(),
  query("limit").optional().isInt({ min: 1, max: 60 }).withMessage("limit must be 1-60").toInt(),
  validate,
  async (req, res) => {
    const result = await listEvents({
      search: req.query.q ? String(req.query.q).trim() : undefined,
      city: req.query.city ? String(req.query.city) : undefined,
      category: req.query.category ? String(req.query.category) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      sort: req.query.sort ? String(req.query.sort) : undefined,
      order: req.query.order ? String(req.query.order) : undefined,
      page: Number(req.query.page ?? 1) || 1,
      limit: Number(req.query.limit ?? 12) || 12,
    });
    const cities = await listCities();
    res.json({ ...result, cities: cities.map((row) => row.city) });
  }
);

/** GET /api/v1/events/:id */
eventsRouter.get(
  "/:id",
  param("id").isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    const event = await getEvent(req.params.id);
    if (!event) throw new ApiError(404, "Event not found", "EVENT_NOT_FOUND");
    res.json({ event });
  }
);

/** GET /api/v1/events/:id/seats — live seat map (expired holds swept first). */
eventsRouter.get(
  "/:id/seats",
  param("id").isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    await sweepExpired(); // rule 9
    const seats = await getSeatMap(req.params.id);
    if (seats === null) throw new ApiError(404, "Event not found", "EVENT_NOT_FOUND");
    res.json({ seats });
  }
);

/** POST /api/v1/events — admin creates an event with its tiers. */
eventsRouter.post("/", requireRole("admin"), createEventRules, validate, async (req, res) => {
  const event = await createEvent(req.user, req.body);
  res.status(201).json({ id: event.id, event });
});

/** PUT /api/v1/events/:id — partial update. */
eventsRouter.put("/:id", requireRole("admin"), updateEventRules, validate, async (req, res) => {
  const event = await updateEvent(req.user, req.params.id, req.body);
  res.json({ event });
});

/** DELETE /api/v1/events/:id — only while no tickets exist. */
eventsRouter.delete(
  "/:id",
  requireRole("admin"),
  param("id").isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    const event = await deleteEvent(req.user, req.params.id);
    res.json({ deleted: true, event });
  }
);

/** POST /api/v1/events/:id/holds — hold up to 8 seats for HOLD_MINUTES. */
eventsRouter.post(
  "/:id/holds",
  authRequired,
  param("id").isInt({ min: 1 }).toInt(),
  body("seat_ids")
    .isArray({ min: 1, max: MAX_SEATS_PER_ORDER })
    .withMessage(`Select between 1 and ${MAX_SEATS_PER_ORDER} seats`),
  body("seat_ids.*").isInt({ min: 1 }).withMessage("Seat ids must be integers").toInt(),
  validate,
  async (req, res) => {
    const result = await holdSeats(req.user, req.params.id, req.body.seat_ids);
    res.status(201).json({ ...result, hold_minutes: HOLD_MINUTES });
  }
);
