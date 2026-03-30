import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable, accountsTable, transactionsTable, budgetsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

router.get("/onboarding/status", requireAuth, async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

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

  const completed = steps.account && steps.transaction && steps.budget;

  if (completed) {
    await db
      .update(userSettingsTable)
      .set({ onboarding_completed: true })
      .where(eq(userSettingsTable.user_id, userId));
  }

  res.json({ steps, completed });
});

export default router;
