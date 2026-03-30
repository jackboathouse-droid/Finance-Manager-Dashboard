import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { budgetsTable, categoriesTable, subcategoriesTable, transactionsTable } from "@workspace/db";
import { eq, and, sql, lt, or } from "drizzle-orm";
import { categoryBelongsToUser, subcategoryBelongsToUser } from "../lib/validate-ownership";

const router: IRouter = Router();

const BUDGET_SELECT = {
  id: budgetsTable.id,
  category_id: budgetsTable.category_id,
  subcategory_id: budgetsTable.subcategory_id,
  month: budgetsTable.month,
  budget_amount: budgetsTable.budget_amount,
  is_recurring: budgetsTable.is_recurring,
  category_name: categoriesTable.name,
  subcategory_name: subcategoriesTable.name,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toFloat(val: string | number | null | undefined): number {
  return parseFloat(String(val ?? "0")) || 0;
}

/**
 * Auto-seed recurring budgets into `month` if none exist yet.
 * Copies the most recent recurring budget per (category, subcategory) pair.
 */
async function seedRecurring(userId: number, month: string) {
  const existing = await db
    .select({ id: budgetsTable.id })
    .from(budgetsTable)
    .where(and(eq(budgetsTable.user_id, userId), eq(budgetsTable.month, month)))
    .limit(1);

  if (existing.length > 0) return;

  const recurring = await db
    .select()
    .from(budgetsTable)
    .where(
      and(
        eq(budgetsTable.user_id, userId),
        eq(budgetsTable.is_recurring, true),
        lt(budgetsTable.month, month)
      )
    )
    .orderBy(sql`${budgetsTable.month} DESC`);

  const seen = new Set<string>();
  const toInsert: typeof recurring = [];
  for (const r of recurring) {
    const key = `${r.category_id}:${r.subcategory_id ?? "null"}`;
    if (!seen.has(key)) {
      seen.add(key);
      toInsert.push(r);
    }
  }

  if (toInsert.length === 0) return;

  await db.insert(budgetsTable).values(
    toInsert.map((r) => ({
      category_id: r.category_id,
      subcategory_id: r.subcategory_id,
      month,
      budget_amount: r.budget_amount,
      is_recurring: true,
      user_id: userId,
    }))
  );
}

// ── GET /budgets ───────────────────────────────────────────────────────────────

router.get("/budgets", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { month } = req.query as Record<string, string>;

    if (month) await seedRecurring(userId, month);

    const conditions = [eq(budgetsTable.user_id, userId)];
    if (month) conditions.push(eq(budgetsTable.month, month));

    const results = await db
      .select(BUDGET_SELECT)
      .from(budgetsTable)
      .leftJoin(categoriesTable, and(eq(budgetsTable.category_id, categoriesTable.id), eq(categoriesTable.user_id, userId)))
      .leftJoin(subcategoriesTable, and(eq(budgetsTable.subcategory_id, subcategoriesTable.id), eq(subcategoriesTable.user_id, userId)))
      .where(and(...conditions));

    res.json(results.map((r) => ({ ...r, budget_amount: toFloat(r.budget_amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

// ── GET /budgets/detailed ─────────────────────────────────────────────────────
// Returns hierarchical budget + actual spending for the given month.

router.get("/budgets/detailed", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

    await seedRecurring(userId, month);

    const budgets = await db
      .select(BUDGET_SELECT)
      .from(budgetsTable)
      .leftJoin(categoriesTable, and(eq(budgetsTable.category_id, categoriesTable.id), eq(categoriesTable.user_id, userId)))
      .leftJoin(subcategoriesTable, and(eq(budgetsTable.subcategory_id, subcategoriesTable.id), eq(subcategoriesTable.user_id, userId)))
      .where(and(eq(budgetsTable.user_id, userId), eq(budgetsTable.month, month)));

    // Actual spending per category
    const catActuals = await db
      .select({
        category_id: transactionsTable.category_id,
        actual: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`,
          eq(transactionsTable.type, "expense")
        )
      )
      .groupBy(transactionsTable.category_id);

    // Actual spending per subcategory
    const subActuals = await db
      .select({
        subcategory_id: transactionsTable.subcategory_id,
        actual: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`,
          eq(transactionsTable.type, "expense"),
          sql`${transactionsTable.subcategory_id} IS NOT NULL`
        )
      )
      .groupBy(transactionsTable.subcategory_id);

    const catActualMap: Record<number, number> = {};
    for (const r of catActuals) {
      if (r.category_id) catActualMap[r.category_id] = toFloat(r.actual);
    }
    const subActualMap: Record<number, number> = {};
    for (const r of subActuals) {
      if (r.subcategory_id) subActualMap[r.subcategory_id] = toFloat(r.actual);
    }

    // Group into hierarchy
    const categoryMap: Record<
      number,
      {
        budget_id: number;
        category_id: number;
        category_name: string;
        budget: number;
        actual: number;
        is_recurring: boolean;
        subcategories: {
          budget_id: number;
          subcategory_id: number;
          subcategory_name: string;
          budget: number;
          actual: number;
          is_recurring: boolean;
        }[];
      }
    > = {};

    for (const b of budgets) {
      if (!b.category_id) continue;
      if (!categoryMap[b.category_id]) {
        categoryMap[b.category_id] = {
          budget_id: b.subcategory_id ? -1 : b.id,
          category_id: b.category_id,
          category_name: b.category_name ?? "Unknown",
          budget: 0,
          actual: catActualMap[b.category_id] ?? 0,
          is_recurring: false,
          subcategories: [],
        };
      }

      if (!b.subcategory_id) {
        categoryMap[b.category_id].budget_id = b.id;
        categoryMap[b.category_id].budget = toFloat(b.budget_amount);
        categoryMap[b.category_id].is_recurring = b.is_recurring ?? false;
      } else {
        categoryMap[b.category_id].subcategories.push({
          budget_id: b.id,
          subcategory_id: b.subcategory_id,
          subcategory_name: b.subcategory_name ?? "Unknown",
          budget: toFloat(b.budget_amount),
          actual: subActualMap[b.subcategory_id] ?? 0,
          is_recurring: b.is_recurring ?? false,
        });
      }
    }

    res.json(Object.values(categoryMap));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch detailed budgets" });
  }
});

// ── POST /budgets ──────────────────────────────────────────────────────────────

router.post("/budgets", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const body = req.body as {
      category_id: number;
      subcategory_id?: number | null;
      month: string;
      budget_amount: number;
      is_recurring?: boolean;
    };

    // Validate category/subcategory ownership
    if (!(await categoryBelongsToUser(body.category_id, userId))) {
      return res.status(403).json({ error: "Invalid category." });
    }
    if (!(await subcategoryBelongsToUser(body.subcategory_id, userId))) {
      return res.status(403).json({ error: "Invalid subcategory." });
    }

    const [budget] = await db
      .insert(budgetsTable)
      .values({
        category_id: body.category_id,
        subcategory_id: body.subcategory_id ?? null,
        month: body.month,
        budget_amount: String(body.budget_amount),
        is_recurring: body.is_recurring ?? false,
        user_id: userId,
      })
      .returning();

    const [enriched] = await db
      .select(BUDGET_SELECT)
      .from(budgetsTable)
      .leftJoin(categoriesTable, and(eq(budgetsTable.category_id, categoriesTable.id), eq(categoriesTable.user_id, userId)))
      .leftJoin(subcategoriesTable, and(eq(budgetsTable.subcategory_id, subcategoriesTable.id), eq(subcategoriesTable.user_id, userId)))
      .where(and(eq(budgetsTable.id, budget.id), eq(budgetsTable.user_id, userId)));

    res.status(201).json({ ...enriched, budget_amount: toFloat(enriched!.budget_amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create budget" });
  }
});

// ── PUT /budgets/:id ───────────────────────────────────────────────────────────

router.put("/budgets/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    const body = req.body as {
      category_id: number;
      subcategory_id?: number | null;
      month: string;
      budget_amount: number;
      is_recurring?: boolean;
    };

    // Validate category/subcategory ownership
    if (!(await categoryBelongsToUser(body.category_id, userId))) {
      return res.status(403).json({ error: "Invalid category." });
    }
    if (!(await subcategoryBelongsToUser(body.subcategory_id, userId))) {
      return res.status(403).json({ error: "Invalid subcategory." });
    }

    await db
      .update(budgetsTable)
      .set({
        category_id: body.category_id,
        subcategory_id: body.subcategory_id ?? null,
        month: body.month,
        budget_amount: String(body.budget_amount),
        is_recurring: body.is_recurring ?? false,
      })
      .where(and(eq(budgetsTable.id, id), eq(budgetsTable.user_id, userId)));

    const [enriched] = await db
      .select(BUDGET_SELECT)
      .from(budgetsTable)
      .leftJoin(categoriesTable, and(eq(budgetsTable.category_id, categoriesTable.id), eq(categoriesTable.user_id, userId)))
      .leftJoin(subcategoriesTable, and(eq(budgetsTable.subcategory_id, subcategoriesTable.id), eq(subcategoriesTable.user_id, userId)))
      .where(and(eq(budgetsTable.id, id), eq(budgetsTable.user_id, userId)));

    if (!enriched) return res.status(404).json({ error: "Budget not found" });
    res.json({ ...enriched, budget_amount: toFloat(enriched.budget_amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update budget" });
  }
});

// ── DELETE /budgets/:id ────────────────────────────────────────────────────────

router.delete("/budgets/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    await db
      .delete(budgetsTable)
      .where(and(eq(budgetsTable.id, id), eq(budgetsTable.user_id, userId)));
    res.json({ message: "Budget deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

export default router;
