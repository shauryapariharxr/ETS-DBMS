import { validationResult } from "express-validator";

/** Turns express-validator results into a single 422 JSON response. */
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array({ onlyFirstError: false });
  const first = errors[0];
  return res.status(422).json({
    error: first?.msg || "Invalid input",
    code: "VALIDATION",
    field: first?.path,
    errors: errors.map((e) => ({ field: e.path, message: e.msg })),
  });
}
