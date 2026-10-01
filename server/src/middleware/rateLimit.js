// Sliding-window rate limiter with an in-memory store.
// Best-effort protection: works per process (fine for local/self-hosted and
// as an extra layer on serverless, where each instance has its own counter).

const DEFAULT_MAX_KEYS = 10000;

export function rateLimit({
  windowMs = 60_000,
  max = 120,
  message = "Too many requests. Please wait a moment and try again.",
  keyGenerator,
} = {}) {
  const hits = new Map();
  let lastSweep = Date.now();

  const sweep = (now) => {
    for (const [key, entry] of hits) {
      if (entry.reset <= now) hits.delete(key);
    }
    lastSweep = now;
  };

  return (req, res, next) => {
    if (process.env.NODE_ENV === "test") return next();

    const now = Date.now();
    if (now - lastSweep >= windowMs || hits.size > DEFAULT_MAX_KEYS) sweep(now);

    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = keyGenerator ? keyGenerator(req, ip) : ip;

    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const retryAfterSec = Math.max(1, Math.ceil((entry.reset - now) / 1000));
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.reset / 1000)));

    if (entry.count > max) {
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Credential-endpoint limiter: stricter, and keyed by IP + submitted email so
// one noisy account cannot lock an entire office behind a shared NAT.
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  message: "Too many authentication attempts. Please wait a minute before trying again.",
  keyGenerator: (req, ip) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `${ip}|${email}`;
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  message: "Rate limit exceeded. Please slow down and retry shortly.",
});
