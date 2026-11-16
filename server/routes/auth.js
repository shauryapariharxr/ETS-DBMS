import { Router } from "express";
import { body } from "express-validator";
import { q } from "../db.js";
import { ApiError } from "../errors.js";
import { validate } from "../validation.js";
import {
  authRequired,
  clearSessionCookie,
  comparePassword,
  hashPassword,
  setSessionCookie,
} from "../auth.js";
import { audit } from "../audit.js";

export const authRouter = Router();

/** POST /api/v1/auth/register — bcrypt hash + JWT session cookie. */
authRouter.post(
  "/register",
  body("email").trim().isEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("full_name").trim().isLength({ min: 2 }).withMessage("Full name is required"),
  validate,
  async (req, res) => {
    const email = String(req.body.email).toLowerCase();
    const { password, full_name: fullName } = req.body;

    const [existing] = await q(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing) {
      throw new ApiError(409, "An account with that email already exists", "EMAIL_TAKEN");
    }

    const [user] = await q(
      `INSERT INTO users(email, password_hash, full_name, role)
       VALUES ($1,$2,$3,'customer')
       RETURNING id, email, full_name, role`,
      [email, await hashPassword(password), fullName]
    );

    setSessionCookie(res, user);
    await audit(user, "user.registered", "user", user.id, { email });
    res.status(201).json({ user });
  }
);

/** POST /api/v1/auth/login */
authRouter.post(
  "/login",
  body("email").trim().isEmail().withMessage("Valid email required"),
  body("password").isString().isLength({ min: 1 }).withMessage("Password is required"),
  validate,
  async (req, res) => {
    const [row] = await q(
      `SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1`,
      [String(req.body.email).toLowerCase()]
    );

    if (!row || !(await comparePassword(req.body.password, row.password_hash))) {
      throw new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const user = { id: row.id, email: row.email, full_name: row.full_name, role: row.role };
    setSessionCookie(res, user);
    res.json({ user });
  }
);

/** POST /api/v1/auth/logout — clears the JWT cookie. */
authRouter.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ signedOut: true });
});

/** GET /api/v1/auth/me — current session (401 when signed out). */
authRouter.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});
