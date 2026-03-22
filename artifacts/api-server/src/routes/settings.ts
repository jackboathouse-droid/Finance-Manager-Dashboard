import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): number | null {
  if (!req.session?.authenticated || !req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.session.userId;
}

const VALID_CURRENCIES = ["USD", "GBP", "EUR", "CAD"] as const;
const VALID_DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;

// ── GET /settings ─────────────────────────────────────────────────────────────
// Returns the current user's settings, creating defaults if none exist yet.
// Mounted at /api, so this handles GET /api/settings.
router.get("/settings", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const rows = await db.execute(
      sql`SELECT * FROM user_settings WHERE user_id = ${userId}`
    );

    if (rows.rows.length === 0) {
      // Insert defaults
      const inserted = await db.execute(sql`
        INSERT INTO user_settings (user_id)
        VALUES (${userId})
        RETURNING *
      `);
      return res.json(inserted.rows[0]);
    }

    res.json(rows.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ── PUT /settings ─────────────────────────────────────────────────────────────
// Updates one or more setting fields for the current user.
// Mounted at /api, so this handles PUT /api/settings.
router.put("/settings", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const {
    currency,
    date_format,
    budget_alerts,
    milestone_alerts,
    weekly_summary,
    recurring_budgets,
    rollover_budget,
  } = req.body;

  // Validate enum fields when provided
  if (currency !== undefined && !VALID_CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: `Invalid currency. Allowed: ${VALID_CURRENCIES.join(", ")}` });
  }
  if (date_format !== undefined && !VALID_DATE_FORMATS.includes(date_format)) {
    return res.status(400).json({ error: `Invalid date format. Allowed: ${VALID_DATE_FORMATS.join(", ")}` });
  }

  try {
    // Upsert: create row with defaults first if it doesn't exist
    await db.execute(sql`
      INSERT INTO user_settings (user_id) VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `);

    // Build partial update — only touch fields that were sent
    const updates: string[] = [];
    if (currency !== undefined) updates.push(`currency = '${currency}'`);
    if (date_format !== undefined) updates.push(`date_format = '${date_format}'`);
    if (budget_alerts !== undefined) updates.push(`budget_alerts = ${!!budget_alerts}`);
    if (milestone_alerts !== undefined) updates.push(`milestone_alerts = ${!!milestone_alerts}`);
    if (weekly_summary !== undefined) updates.push(`weekly_summary = ${!!weekly_summary}`);
    if (recurring_budgets !== undefined) updates.push(`recurring_budgets = ${!!recurring_budgets}`);
    if (rollover_budget !== undefined) updates.push(`rollover_budget = ${!!rollover_budget}`);

    if (updates.length === 0) {
      const rows = await db.execute(sql`SELECT * FROM user_settings WHERE user_id = ${userId}`);
      return res.json(rows.rows[0]);
    }

    updates.push(`updated_at = NOW()`);
    const updateClause = updates.join(", ");

    const result = await db.execute(
      sql.raw(`UPDATE user_settings SET ${updateClause} WHERE user_id = ${userId} RETURNING *`)
    );

    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
