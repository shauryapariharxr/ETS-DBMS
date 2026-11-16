import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../validation.js";
import { requireRole } from "../auth.js";
import { validateScan } from "../services/scans.js";

export const scansRouter = Router();

/** POST /api/v1/scans/validate — scanner, organizer or admin only. */
scansRouter.post(
  "/validate",
  requireRole("scanner", "admin", "organizer"),
  body("qr_code").trim().isLength({ min: 1 }).withMessage("QR code is required"),
  body("gate_id").trim().isLength({ min: 1 }).withMessage("Gate id is required"),
  validate,
  async (req, res) => {
    const verdict = await validateScan(req.user, req.body.qr_code, req.body.gate_id);
    res.json(verdict);
  }
);
