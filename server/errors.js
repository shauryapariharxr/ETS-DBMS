/** Anything thrown as ApiError reaches the client with its status code intact. */
export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Unknown route → JSON 404 (registered after all routers). */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: `No route for ${req.method} ${req.originalUrl}`,
    code: "NOT_FOUND",
  });
}

const PG_ERRORS = {
  "23505": [409, "That record already exists", "DUPLICATE"],
  "23503": [409, "A related record is missing or still referenced", "FK_CONFLICT"],
  "23514": [422, "A database constraint rejected this value", "CHECK_VIOLATION"],
  "23502": [422, "A required field was missing", "NOT_NULL"],
  "22P02": [400, "Invalid value format", "INVALID_FORMAT"],
  "22007": [400, "Invalid date or time value", "INVALID_DATE"],
};

/** Central error handler — the last middleware registered in index.js. */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON", code: "INVALID_JSON" });
  }

  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is larger than the 4 MB limit"
        : `Upload rejected: ${err.message}`;
    return res.status(400).json({ error: message, code: err.code });
  }

  const mapped = err?.code ? PG_ERRORS[err.code] : null;
  if (mapped) {
    return res.status(mapped[0]).json({ error: mapped[1], code: mapped[2] });
  }

  console.error("[api:error]", err);
  return res.status(500).json({ error: "Internal server error", code: "INTERNAL" });
}
