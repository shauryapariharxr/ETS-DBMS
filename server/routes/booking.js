import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../validation.js";
import { authRequired } from "../auth.js";
import { listHolds, releaseHolds, checkout, listMyTickets, transferTicket } from "../services/booking.js";
import { qrDataUrl } from "../qr.js";
import { MAX_SEATS_PER_ORDER } from "../config.js";

/** GET/DELETE /api/v1/holds */
export const holdsRouter = Router();

holdsRouter.get("/", authRequired, async (req, res) => {
  res.json({ holds: await listHolds(req.user.id) });
});

holdsRouter.delete(
  "/",
  authRequired,
  body("hold_ids").isArray({ min: 1 }).withMessage("hold_ids is required"),
  body("hold_ids.*").isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    const released = await releaseHolds(req.user, req.body.hold_ids);
    res.json({ released });
  }
);

/** POST /api/v1/bookings/checkout */
export const bookingsRouter = Router();

bookingsRouter.post(
  "/checkout",
  authRequired,
  body("hold_ids")
    .isArray({ min: 1, max: MAX_SEATS_PER_ORDER })
    .withMessage("No held seats to check out"),
  body("hold_ids.*").isInt({ min: 1 }).toInt(),
  body("method").isIn(["card", "upi"]).withMessage("Payment method must be card or upi"),
  body("card_last4")
    .if(body("method").equals("card"))
    .matches(/^\d{4}$/)
    .withMessage("Card payments need the last 4 digits"),
  validate,
  async (req, res) => {
    const last4 = req.body.card_last4 ? String(req.body.card_last4).slice(-4) : undefined;
    const tickets = await checkout(req.user, req.body.hold_ids, req.body.method, last4);
    res.status(201).json({ tickets });
  }
);

/** GET /api/v1/tickets/mine and POST /api/v1/tickets/:id/transfer */
export const ticketsRouter = Router();

ticketsRouter.get("/mine", authRequired, async (req, res) => {
  const tickets = await listMyTickets(req.user.id);
  const withQr = await Promise.all(
    tickets.map(async (ticket) => ({ ...ticket, qr_image: await qrDataUrl(ticket.qr_code) }))
  );
  res.json({ tickets: withQr });
});

ticketsRouter.post(
  "/:id/transfer",
  authRequired,
  body("to_email").trim().isEmail().withMessage("Valid recipient email required"),
  validate,
  async (req, res) => {
    const result = await transferTicket(req.user, Number(req.params.id), req.body.to_email);
    res.json(result);
  }
);
