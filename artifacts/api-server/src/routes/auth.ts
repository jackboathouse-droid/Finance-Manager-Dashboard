import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  accountsTable,
  transactionsTable,
  budgetsTable,
  manualAssetsTable,
  categoriesTable,
  subcategoriesTable,
  peopleTable,
  projectsTable,
  userSettingsTable,
} from "@workspace/db";
import { eq, count, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import * as nodemailer from "nodemailer";
import passport from "../lib/google-auth";
import { googleOAuthEnabled, getFrontendBase } from "../lib/google-auth";
import { sendMail, buildWelcomeEmail } from "../lib/mailer";

const router: IRouter = Router();

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MINUTES = 60;

/** Read from env; 0 means no cap. Defaults to 0 (no cap) if unset. */
function getMaxUsers(): number {
  const val = parseInt(process.env.MAX_USERS ?? "0");
  return isNaN(val) ? 0 : val;
}

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
    username: string;
    email?: string;
    fullName?: string;
    userId?: number;
    role?: string;
    profilePicture?: string;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setUserSession(
  req: Request,
  user: { id: number; email: string; full_name: string; role: string; profile_picture_url?: string | null }
) {
  req.session.authenticated = true;
  req.session.username = user.email;
  req.session.email = user.email;
  req.session.fullName = user.full_name;
  req.session.userId = user.id;
  req.session.role = user.role;
  if (user.profile_picture_url) {
    req.session.profilePicture = user.profile_picture_url;
  }
}

/** Normalize login identifier to lowercase email */
function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Build a nodemailer transporter from env vars (returns null if unconfigured) */
function buildMailTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
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

    const maxUsers = getMaxUsers();
    if (maxUsers > 0) {
      const [{ total }] = await db.select({ total: count() }).from(usersTable);
      if (total >= maxUsers) {
        return res.status(403).json({
          error: "User limit reached. No new registrations are being accepted at this time.",
        });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await db
      .select({ id: usersTable.id, auth_provider: usersTable.auth_provider })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (existing) {
      if (existing.auth_provider === "google") {
        return res.status(400).json({
          error: "This email is linked to a Google account. Please sign in with Google.",
        });
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
        role: "user",
      })
      .returning();

    setUserSession(req, newUser);
    req.log.info({ userId: newUser.id, email: newUser.email }, "New user registered");

    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    // Send welcome email (non-blocking — don't fail registration if email fails)
    const frontendBase = getFrontendBase();
    const welcome = buildWelcomeEmail(newUser.full_name, frontendBase);
    sendMail({ to: newUser.email, ...welcome }, req.log).catch(() => {});

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
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = normalizeLoginId(username);

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (!user) {
      req.log.warn({ email: normalizedEmail }, "Login attempt: user not found");
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        error: 'This account uses Google Sign-In. Please click "Continue with Google".',
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      req.log.warn({ email: normalizedEmail }, "Login attempt: incorrect password");
      return res.status(401).json({ error: "Invalid email or password." });
    }

    setUserSession(req, user);
    req.log.info({ userId: user.id, email: user.email, role: user.role }, "User logged in");

    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    return res.json({ success: true, username: user.email });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ── Forgot password ───────────────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email?.trim()) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Always return success to avoid user enumeration
    const GENERIC_MSG = "If an account with that email exists, a reset link has been sent. Please check your inbox.";

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, full_name: usersTable.full_name, auth_provider: usersTable.auth_provider })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (!user) {
      return res.json({ message: GENERIC_MSG });
    }

    if (user.auth_provider === "google") {
      return res.json({ message: GENERIC_MSG });
    }

    // Invalidate any existing unexpired tokens for this user
    await db.execute(
      sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ${user.id} AND used_at IS NULL AND expires_at > NOW()`
    );

    // Create a new token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await db.execute(
      sql`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (${user.id}, ${token}, ${expiresAt.toISOString()})`
    );

    const frontendBase = getFrontendBase();
    const resetUrl = `${frontendBase}/reset-password?token=${token}`;

    req.log.info({ userId: user.id, resetUrl }, "Password reset token created");

    // Try to send email
    const transporter = buildMailTransporter();
    if (transporter) {
      const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER;
      await transporter.sendMail({
        from: `"Bubble Finance" <${fromAddr}>`,
        to: user.email,
        subject: "Reset your Bubble password",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="color: #1C3A5E; margin-bottom: 8px;">Reset your password</h2>
            <p style="color: #64748b;">Hi ${user.full_name},</p>
            <p style="color: #64748b;">We received a request to reset the password for your Bubble account. Click the button below to choose a new password. This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>
            <a href="${resetUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 28px; background: #4FC3F7; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset password</a>
            <p style="color: #94a3b8; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">Bubble Finance · Your personal finance companion</p>
          </div>
        `,
        text: `Reset your Bubble password\n\nHi ${user.full_name},\n\nClick the link below to reset your password (expires in ${RESET_TOKEN_TTL_MINUTES} min):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
      });
      return res.json({ message: GENERIC_MSG });
    }

    // Demo/dev mode: return the reset URL so the app still works without SMTP
    req.log.warn("SMTP not configured — returning reset URL in response (dev mode)");
    return res.json({
      message: GENERIC_MSG,
      _dev_reset_url: resetUrl,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to process request. Please try again." });
  }
});

// ── Reset password ────────────────────────────────────────────────────────────

router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };

    if (!token?.trim()) {
      return res.status(400).json({ error: "Reset token is missing." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    // Validate token
    const rows = await db.execute<{
      id: number;
      user_id: number;
      expires_at: string;
      used_at: string | null;
    }>(
      sql`SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ${token.trim()} LIMIT 1`
    );

    const row = (rows as any).rows?.[0] ?? rows[0];

    if (!row) {
      return res.status(400).json({ error: "This reset link is invalid. Please request a new one." });
    }
    if (row.used_at) {
      return res.status(400).json({ error: "This reset link has already been used. Please request a new one." });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: "This reset link has expired. Please request a new one." });
    }

    // Hash and update password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.execute(sql`UPDATE users SET password_hash = ${password_hash} WHERE id = ${row.user_id}`);

    // Mark token used
    await db.execute(sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${row.id}`);

    req.log.info({ userId: row.user_id }, "Password reset successful");

    return res.json({ success: true, message: "Your password has been reset successfully. Please log in." });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

// ── Validate reset token (GET — for page load check) ─────────────────────────

router.get("/auth/reset-password/validate", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ valid: false, error: "Token missing." });

    const rows = await db.execute<{ id: number; used_at: string | null; expires_at: string }>(
      sql`SELECT id, used_at, expires_at FROM password_reset_tokens WHERE token = ${token} LIMIT 1`
    );
    const row = (rows as any).rows?.[0] ?? rows[0];

    if (!row) return res.json({ valid: false, error: "Invalid reset link." });
    if (row.used_at) return res.json({ valid: false, error: "This link has already been used." });
    if (new Date(row.expires_at) < new Date()) return res.json({ valid: false, error: "This link has expired." });

    return res.json({ valid: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ valid: false, error: "Server error." });
  }
});

// ── Google OAuth — initiate ───────────────────────────────────────────────────

router.get("/auth/google", (req: Request, res: Response, next: NextFunction) => {
  if (!googleOAuthEnabled) {
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

      setUserSession(req, user);

      req.session.save((saveErr) => {
        if (saveErr) {
          req.log.error({ saveErr }, "Session save error after Google OAuth");
          return res.redirect(`${frontendBase}/login?error=session_error`);
        }
        req.log.info({ userId: user.id, email: user.email }, "Google OAuth login");
        return res.redirect(`${frontendBase}/`);
      });
    }
  )(req, res, next);
});

// ── Google OAuth — status ─────────────────────────────────────────────────────

router.get("/auth/google/status", (_req, res) => {
  res.json({ enabled: googleOAuthEnabled });
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post("/auth/logout", (req, res) => {
  const userId = req.session?.userId;
  req.session.destroy(() => {
    if (userId) req.log.info({ userId }, "User logged out");
    res.json({ message: "Logged out successfully." });
  });
});

// ── Change Password ───────────────────────────────────────────────────────────

router.post("/auth/change-password", async (req, res) => {
  if (!req.session?.authenticated || !req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "current_password and new_password are required" });
  }
  if (typeof new_password !== "string" || new_password.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.password_hash) {
      return res.status(400).json({
        error: "Password change is not available for accounts that signed in with Google",
      });
    }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await db
      .update(usersTable)
      .set({ password_hash: newHash } as any)
      .where(eq(usersTable.id, req.session.userId));

    res.json({ message: "Password updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ── Delete Account (Right to Erasure) ────────────────────────────────────────

router.delete("/auth/account", async (req, res) => {
  if (!req.session?.authenticated || !req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = req.session.userId;
  const { password } = req.body as { password?: string };

  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, password_hash: usersTable.password_hash })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Email/password users must supply their current password as confirmation
    if (user.password_hash) {
      if (!password) {
        return res.status(400).json({ error: "Password is required to delete your account." });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(400).json({ error: "Password is incorrect." });
      }
    }

    // Delete all user-owned data atomically in FK dependency order
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM password_reset_tokens WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM project_contributions WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM transactions WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM budgets WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM manual_assets WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM projects WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM accounts WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM user_settings WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM people WHERE user_id = ${userId}`);
      // Remove all sessions for this user from the session store
      await tx.execute(
        sql`DELETE FROM user_sessions WHERE (sess::jsonb->>'userId')::int = ${userId}`
      );
      await tx.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    });

    req.log.info({ userId, email: user.email }, "Account deleted");

    // Destroy the current session so the response doesn't reference a deleted user
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      return res.json({ success: true, message: "Your account and all data have been permanently deleted." });
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
});

// ── Export Data (Right of Access) ─────────────────────────────────────────────

router.get("/auth/export", async (req, res) => {
  if (!req.session?.authenticated || !req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = req.session.userId;

  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, full_name: usersTable.full_name, created_at: usersTable.created_at })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const accounts = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, userId));

    const transactions = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, userId));

    const budgets = await db
      .select()
      .from(budgetsTable)
      .where(sql`${budgetsTable.user_id} = ${userId}`);

    const manualAssets = await db
      .select()
      .from(manualAssetsTable)
      .where(eq(manualAssetsTable.user_id, userId));

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.user_id, userId));

    const people = await db
      .select()
      .from(peopleTable)
      .where(eq(peopleTable.user_id, userId));

    const [userSettings] = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.user_id, userId));

    // Categories and subcategories used in this user's transactions/budgets
    const usedCategoryIds = [
      ...new Set(
        [...transactions, ...budgets]
          .map((r) => r.category_id)
          .filter((id): id is number => id != null)
      ),
    ];

    const usedSubcategoryIds = [
      ...new Set(
        [...transactions, ...budgets]
          .map((r) => r.subcategory_id)
          .filter((id): id is number => id != null)
      ),
    ];

    const categoriesUsed =
      usedCategoryIds.length > 0
        ? await db.select().from(categoriesTable).where(inArray(categoriesTable.id, usedCategoryIds))
        : [];

    const subcategoriesUsed =
      usedSubcategoryIds.length > 0
        ? await db.select().from(subcategoriesTable).where(inArray(subcategoriesTable.id, usedSubcategoryIds))
        : [];

    const exportData = {
      exported_at: new Date().toISOString(),
      user: { id: user?.id, email: user?.email, full_name: user?.full_name, created_at: user?.created_at },
      user_settings: userSettings ?? null,
      accounts,
      transactions,
      budgets,
      manual_assets: manualAssets,
      projects,
      people,
      categories_used: categoriesUsed,
      subcategories_used: subcategoriesUsed,
    };

    const filename = `bubble-data-export-${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    req.log.info({ userId }, "User data exported");
    return res.json(exportData);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to export data. Please try again." });
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────

router.get("/auth/me", (req, res) => {
  if (req.session?.authenticated) {
    res.json({
      username: req.session.username,
      authenticated: true,
      fullName: req.session.fullName,
      email: req.session.email,
      role: req.session.role,
      profilePicture: req.session.profilePicture,
    });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

export default router;
