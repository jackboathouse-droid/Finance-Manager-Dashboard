import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable, accountsTable, transactionsTable, budgetsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

router.get("/onboarding/status", requireAuth, async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const [existingSettings] = await db
    .select({ onboarding_completed: userSettingsTable.onboarding_completed })
    .from(userSettingsTable)
    .where(eq(userSettingsTable.user_id, userId));

  if (existingSettings?.onboarding_completed) {
    return res.json({
      steps: { account: true, transaction: true, budget: true },
      completed: true,
    });
  }

  const [accountCount, transactionCount, budgetCount] = await Promise.all([
    db.select({ c: count() }).from(accountsTable).where(eq(accountsTable.user_id, userId)),
    db.select({ c: count() }).from(transactionsTable).where(eq(transactionsTable.user_id, userId)),
    db.select({ c: count() }).from(budgetsTable).where(eq(budgetsTable.user_id, userId)),
  ]);

  const steps = {
    account: Number(accountCount[0]?.c ?? 0) > 0,
    transaction: Number(transactionCount[0]?.c ?? 0) > 0,
    budget: Number(budgetCount[0]?.c ?? 0) > 0,
  };

  const allDone = steps.account && steps.transaction && steps.budget;

  if (allDone) {
    await db
      .insert(userSettingsTable)
      .values({ user_id: userId, onboarding_completed: true })
      .onConflictDoUpdate({
        target: userSettingsTable.user_id,
        set: { onboarding_completed: true },
      });
  }

  res.json({ steps, completed: allDone });
});

export default router;
