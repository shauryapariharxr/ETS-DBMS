import express from "express";
import cors from "cors";
import cron from "node-cron";
import {
  AUTO_MIGRATE,
  AUTO_SEED,
  CORS_ALLOW_ANY,
  CORS_ORIGINS,
  NODE_ENV,
  PORT,
  UPLOAD_DIR,
  UPLOAD_URL_PREFIX,
} from "./config.js";
import { pool, q } from "./db.js";
import { ApiError, errorHandler, notFoundHandler } from "./errors.js";
import { optionalUser } from "./auth.js";
import { sweepExpired } from "./services/booking.js";
import { ensureDatabaseSchema } from "./setup.js";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";
import { venuesRouter } from "./routes/venues.js";
import { bookingsRouter, holdsRouter, ticketsRouter } from "./routes/booking.js";
import { scansRouter } from "./routes/scans.js";
import { uploadsRouter } from "./routes/uploads.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// ---- CORS: allowlist of frontend origins, credentials enabled for the JWT cookie ----
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || CORS_ALLOW_ANY || CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(
        new ApiError(403, `Origin ${origin} is not allowed by the CORS policy`, "CORS_BLOCKED")
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// ---- Request log ----
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

// ---- Session (JWT cookie or Bearer token) available to every route ----
app.use(optionalUser);

// ---- Uploaded files (event banners, documents) ----
app.use(UPLOAD_URL_PREFIX, express.static(UPLOAD_DIR, { maxAge: "1h" }));

app.get("/", (_req, res) => {
  res.json({
    service: "StagePass API",
    stack: "Node.js + Express.js + PostgreSQL",
    health: "/api/v1/health",
    base: "/api/v1",
  });
});

app.get("/api/v1/health", async (_req, res) => {
  await q("SELECT 1");
  res.json({
    status: "ok",
    database: "connected",
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/events", eventsRouter);
app.use("/api/v1/venues", venuesRouter);
app.use("/api/v1/holds", holdsRouter);
app.use("/api/v1/bookings", bookingsRouter);
app.use("/api/v1/tickets", ticketsRouter);
app.use("/api/v1/scans", scansRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/admin", adminRouter);

app.use(notFoundHandler); // 404 for unknown routes
app.use(errorHandler); // central error handler (must be last)

async function start() {
  // ---- Fresh-deployment bootstrap: create tables (and demo data) before serving ----
  if (AUTO_MIGRATE || AUTO_SEED) {
    try {
      await ensureDatabaseSchema();
    } catch (error) {
      // Fail the boot visibly instead of serving 500s against a missing schema.
      console.error(`[setup] automatic database setup failed: ${error.message}`);
      process.exit(1);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`[stagepass-api] Express listening on http://localhost:${PORT} (${NODE_ENV})`);
  });

  // ---- Rule 9: release expired seat holds every 30 seconds ----
  cron.schedule("*/30 * * * * *", async () => {
    try {
      const result = await sweepExpired();
      if (result.holds || result.pendings) {
        console.log(`[sweeper] released ${result.holds} hold(s), cancelled ${result.pendings} stale ticket(s)`);
      }
    } catch (error) {
      console.error("[sweeper]", error.message);
    }
  });
  console.log("[stagepass-api] hold sweeper scheduled every 30s");

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      console.log(`\n[stagepass-api] ${signal} received — shutting down`);
      server.close(() => {
        pool.end().finally(() => process.exit(0));
      });
    });
  }
}

start();
