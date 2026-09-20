import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, companyId: user.companyId },
    config.jwtSecret,
    { expiresIn: config.jwtExpires }
  );
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const { User } = req.app.locals.models;
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.active) {
      return res.status(401).json({ error: "Account disabled or removed" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function can(cap) {
  return (req, res, next) => {
    const ok =
      req.user.role === "admin"
        ? true
        : (req.app.locals.roleCaps[req.user.role] || []).includes(cap);
    if (!ok) {
      return res
        .status(403)
        .json({ error: `Requires capability: ${cap}` });
    }
    next();
  };
}