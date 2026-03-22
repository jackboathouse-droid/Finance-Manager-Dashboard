import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const SALT_ROUNDS = 12;

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
    username: string;
    email?: string;
    fullName?: string;
    userId?: number;
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
    };

    if (!fullName?.trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }
    if (!email?.trim()) {
      return res.status(400).json({ error: "Email address is required." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (existing) {
      return res.status(400).json({ error: "An account with that email already exists." });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const [newUser] = await db
      .insert(usersTable)
      .values({ full_name: fullName.trim(), email: normalizedEmail, password_hash })
      .returning();

    req.session.authenticated = true;
    req.session.username = normalizedEmail;
    req.session.email = normalizedEmail;
    req.session.fullName = newUser.full_name;
    req.session.userId = newUser.id;

    return res.status(201).json({ success: true, username: normalizedEmail });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create account. Please try again." });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      return res.status(401).json({ error: "Credentials are required." });
    }

    // Legacy hardcoded admin account (kept for backward compatibility)
    if (username === "admin" && password === "admin") {
      req.session.authenticated = true;
      req.session.username = "admin";
      req.session.fullName = "Admin";
      return res.json({ success: true, username: "admin" });
    }

    // Email-based DB account — the "username" field accepts an email address
    const normalizedEmail = username.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    req.session.authenticated = true;
    req.session.username = user.email;
    req.session.email = user.email;
    req.session.fullName = user.full_name;
    req.session.userId = user.id;

    return res.json({ success: true, username: user.email });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// ── Me ────────────────────────────────────────────────────────────────────────

router.get("/auth/me", (req, res) => {
  if (req.session?.authenticated) {
    res.json({
      username: req.session.username,
      authenticated: true,
      fullName: req.session.fullName,
      email: req.session.email,
    });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

export default router;
