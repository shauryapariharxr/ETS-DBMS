import { Router } from "express";
import { body, param } from "express-validator";
import { validate } from "../validation.js";
import { requireRole } from "../auth.js";
import { ApiError } from "../errors.js";
import {
  createVenue,
  deleteVenue,
  getVenue,
  getVenueSeats,
  listVenues,
  updateVenue,
} from "../services/venues.js";

export const venuesRouter = Router();

const sectionRules = [
  body("sections").isArray({ min: 1 }).withMessage("At least one section is required"),
  body("sections.*.name").trim().isLength({ min: 1, max: 40 }).withMessage("Section name required"),
  body("sections.*.tier").optional().isString().trim().isLength({ max: 40 }),
  body("sections.*.rows").isArray({ min: 1 }).withMessage("At least one row is required"),
  body("sections.*.rows.*").trim().isLength({ min: 1, max: 4 }).withMessage("Row labels are 1-4 characters"),
  body("sections.*.perRow").isInt({ min: 1, max: 30 }).withMessage("Seats per row must be 1-30").toInt(),
];

venuesRouter.get("/", async (_req, res) => {
  res.json({ venues: await listVenues() });
});

venuesRouter.get(
  "/:id",
  param("id").isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    const venue = await getVenue(req.params.id);
    if (!venue) throw new ApiError(404, "Venue not found", "VENUE_NOT_FOUND");
    res.json({ venue });
  }
);

venuesRouter.get(
  "/:id/seats",
  param("id").isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    const venue = await getVenue(req.params.id);
    if (!venue) throw new ApiError(404, "Venue not found", "VENUE_NOT_FOUND");
    res.json({ seats: await getVenueSeats(req.params.id) });
  }
);

venuesRouter.post(
  "/",
  requireRole("admin"),
  body("name").trim().isLength({ min: 2, max: 120 }).withMessage("Venue name required"),
  body("address").trim().isLength({ min: 2, max: 200 }).withMessage("Address required"),
  body("city").trim().isLength({ min: 2, max: 80 }).withMessage("City required"),
  ...sectionRules,
  validate,
  async (req, res) => {
    const venue = await createVenue(req.user, req.body);
    res.status(201).json({ venue });
  }
);

venuesRouter.put(
  "/:id",
  requireRole("admin"),
  param("id").isInt({ min: 1 }).toInt(),
  body("name").optional().trim().isLength({ min: 2, max: 120 }),
  body("address").optional().trim().isLength({ min: 2, max: 200 }),
  body("city").optional().trim().isLength({ min: 2, max: 80 }),
  validate,
  async (req, res) => {
    const venue = await updateVenue(req.user, req.params.id, req.body);
    res.json({ venue });
  }
);

venuesRouter.delete(
  "/:id",
  requireRole("admin"),
  param("id").isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    const venue = await deleteVenue(req.user, req.params.id);
    res.json({ deleted: true, venue });
  }
);
