import crypto from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { Router } from "express";
import multer from "multer";
import { ApiError } from "../errors.js";
import { requireRole } from "../auth.js";
import { MAX_UPLOAD_BYTES, UPLOAD_DIR, UPLOAD_URL_PREFIX } from "../config.js";

export const uploadsRouter = Router();

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || ".bin";
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(
        new ApiError(415, "Only JPG, PNG, WEBP, GIF or PDF files are allowed", "UNSUPPORTED_FILE_TYPE")
      );
    }
    cb(null, true);
  },
});

/**
 * POST /api/v1/uploads — multipart/form-data with a field named `file`.
 * Returns the public URL that can be stored on an event (banner_url).
 */
uploadsRouter.post("/", requireRole("admin", "organizer"), (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) {
      return next(
        new ApiError(400, "No file received — send a multipart field named 'file'", "FILE_REQUIRED")
      );
    }
    res.status(201).json({
      url: `${UPLOAD_URL_PREFIX}/${req.file.filename}`,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  });
});
