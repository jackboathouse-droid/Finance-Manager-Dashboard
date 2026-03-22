import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import passport from "../lib/google-auth";
import { googleOAuthEnabled, getFrontendBase } from "../lib/google-auth";

const router: IRouter = Router();

const SALT_ROUNDS = 12;

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
    username: string;
    email?: string;
    fullName?: string;
    userId?: number;
    profilePicture?: string;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setUserSession(req: Request, user: { id: number; email: string; full_name: string; profile_picture_url?: string | null }) {
  req.session.authenticated = true;
  req.session.username = user.email;
  req.session.email = user.email;
  req.session.fullName = user.full_name;
  req.session.userId = user.id;
  if (user.profile_picture_url) {
    req.session.profilePicture = user.profile_picture_url;
  }
}

// ── Register (email + password) ───────────────────────────────────────────────

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
      .select({ id: usersTable.id, auth_provider: usersTable.auth_provider })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (existing) {
      if (existing.auth_provider === "google") {
        return res.status(400).json({ error: "This email is linked to a Google account. Please sign in with Google." });
      }
      return res.status(400).json({ error: "An account with that email already exists." });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const [newUser] = await db
      .insert(usersTable)
      .values({
        full_name: fullName.trim(),
        email: normalizedEmail,
        password_hash,
        auth_provider: "email",
      })
      .returning();

    setUserSession(req, newUser);

    return res.status(201).json({ success: true, username: normalizedEmail });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create account. Please try again." });
  }
});

// ── Login (email/password) ────────────────────────────────────────────────────

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

    const normalizedEmail = username.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // User signed up with Google — they have no password
    if (!user.password_hash) {
      return res.status(401).json({ error: "This account uses Google Sign-In. Please click \"Continue with Google\"." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    setUserSession(req, user);

    return res.json({ success: true, username: user.email });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ── Google OAuth — initiate ───────────────────────────────────────────────────

router.get("/auth/google", (req: Request, res: Response, next: NextFunction) => {
  if (!googleOAuthEnabled) {
    // Redirect back to login with a clear error message
    return res.redirect(`${getFrontendBase()}/login?error=google_not_configured`);
  }
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })(req, res, next);
});

// ── Google OAuth — callback ───────────────────────────────────────────────────

router.get("/auth/google/callback", (req: Request, res: Response, next: NextFunction) => {
  const frontendBase = getFrontendBase();

  passport.authenticate(
    "google",
    { session: false, failureRedirect: `${frontendBase}/login?error=google_failed` },
    (err: Error | null, user: typeof usersTable.$inferSelect | false) => {
      if (err || !user) {
        req.log.error({ err }, "Google OAuth callback error");
        return res.redirect(`${frontendBase}/login?error=google_failed`);
      }

      // Establish our own session
      setUserSession(req, user);

      // Save session explicitly before redirecting so the cookie is set
      req.session.save((saveErr) => {
        if (saveErr) {
          req.log.error({ saveErr }, "Session save error after Google OAuth");
          return res.redirect(`${frontendBase}/login?error=session_error`);
        }
        return res.redirect(`${frontendBase}/`);
      });
    }
  )(req, res, next);
});

// ── Google OAuth — status (for UI) ───────────────────────────────────────────

router.get("/auth/google/status", (_req, res) => {
  res.json({ enabled: googleOAuthEnabled });
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
      profilePicture: req.session.profilePicture,
    });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

export default router;
