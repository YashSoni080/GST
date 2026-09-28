import { Router } from "express";
import bcrypt from "bcryptjs";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { User, Company } = req.app.locals.models;
    const { name, email, password, companyName } = req.body;
    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
      return res.status(422).json({ error: "Name, email and password are required" });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(422).json({ error: "Invalid email format" });
    }
    if (password.length < 6) {
      return res.status(422).json({ error: "Password must be at least 6 characters" });
    }
    const exists = await User.findOne({ email: cleanEmail });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    let companyId = req.body.companyId;
    if (!companyId) {
      const company = await Company.create({ name: typeof companyName === "string" && companyName.trim() ? companyName.trim() : "My Company" });
      companyId = company._id;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: cleanEmail, passwordHash, companyId, role: "admin" });
    const token = signToken(user);
    res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (err) { next(err); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { User, Company } = req.app.locals.models;
    const { email, password } = req.body;
    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
      return res.status(422).json({ error: "Email and password are required" });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    user.lastLoginAt = new Date();
    await user.save();
    const company = await Company.findById(user.companyId).lean();
    const token = signToken(user);
    res.json({ token, user: { ...user.toSafeJSON(), company } });
  } catch (err) { next(err); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { Company } = req.app.locals.models;
    const company = await Company.findById(req.user.companyId).lean();
    const safeUser = { ...req.user };
    delete safeUser.passwordHash;
    res.json({ ...safeUser, company });
  } catch (err) { next(err); }
});

export default router;
