export function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({ error: messages.join("; ") });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ error: `Invalid ${err.kind} id: ${err.value}` });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
}

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}