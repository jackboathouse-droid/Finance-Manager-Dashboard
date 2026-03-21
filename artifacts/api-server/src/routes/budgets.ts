import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { budgetsTable, categoriesTable, subcategoriesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/budgets", async (req, res) => {
  try {
    const { month } = req.query as Record<string, string>;

    let baseQuery = db
      .select({
        id: budgetsTable.id,
        category_id: budgetsTable.category_id,
        subcategory_id: budgetsTable.subcategory_id,
        month: budgetsTable.month,
        budget_amount: budgetsTable.budget_amount,
        category_name: categoriesTable.name,
        subcategory_name: subcategoriesTable.name,
      })
      .from(budgetsTable)
      .leftJoin(categoriesTable, eq(budgetsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(budgetsTable.subcategory_id, subcategoriesTable.id));

    if (month) {
      const results = await db
        .select({
          id: budgetsTable.id,
          category_id: budgetsTable.category_id,
          subcategory_id: budgetsTable.subcategory_id,
          month: budgetsTable.month,
          budget_amount: budgetsTable.budget_amount,
          category_name: categoriesTable.name,
          subcategory_name: subcategoriesTable.name,
        })
        .from(budgetsTable)
        .leftJoin(categoriesTable, eq(budgetsTable.category_id, categoriesTable.id))
        .leftJoin(subcategoriesTable, eq(budgetsTable.subcategory_id, subcategoriesTable.id))
        .where(eq(budgetsTable.month, month));
      return res.json(results.map((r) => ({ ...r, budget_amount: parseFloat(r.budget_amount) })));
    }

    const results = await baseQuery;
    res.json(results.map((r) => ({ ...r, budget_amount: parseFloat(r.budget_amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

router.post("/budgets", async (req, res) => {
  try {
    const body = req.body as {
      category_id: number;
      subcategory_id?: number | null;
      month: string;
      budget_amount: number;
    };

    const [budget] = await db
      .insert(budgetsTable)
      .values({
        category_id: body.category_id,
        subcategory_id: body.subcategory_id ?? null,
        month: body.month,
        budget_amount: String(body.budget_amount),
      })
      .returning();

    const [enriched] = await db
      .select({
        id: budgetsTable.id,
        category_id: budgetsTable.category_id,
        subcategory_id: budgetsTable.subcategory_id,
        month: budgetsTable.month,
        budget_amount: budgetsTable.budget_amount,
        category_name: categoriesTable.name,
        subcategory_name: subcategoriesTable.name,
      })
      .from(budgetsTable)
      .leftJoin(categoriesTable, eq(budgetsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(budgetsTable.subcategory_id, subcategoriesTable.id))
      .where(eq(budgetsTable.id, budget.id));

    res.status(201).json({ ...enriched, budget_amount: parseFloat(enriched!.budget_amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create budget" });
  }
});

router.put("/budgets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body as {
      category_id: number;
      subcategory_id?: number | null;
      month: string;
      budget_amount: number;
    };

    await db
      .update(budgetsTable)
      .set({
        category_id: body.category_id,
        subcategory_id: body.subcategory_id ?? null,
        month: body.month,
        budget_amount: String(body.budget_amount),
      })
      .where(eq(budgetsTable.id, id));

    const [enriched] = await db
      .select({
        id: budgetsTable.id,
        category_id: budgetsTable.category_id,
        subcategory_id: budgetsTable.subcategory_id,
        month: budgetsTable.month,
        budget_amount: budgetsTable.budget_amount,
        category_name: categoriesTable.name,
        subcategory_name: subcategoriesTable.name,
      })
      .from(budgetsTable)
      .leftJoin(categoriesTable, eq(budgetsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(budgetsTable.subcategory_id, subcategoriesTable.id))
      .where(eq(budgetsTable.id, id));

    if (!enriched) return res.status(404).json({ error: "Budget not found" });
    res.json({ ...enriched, budget_amount: parseFloat(enriched.budget_amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update budget" });
  }
});

router.delete("/budgets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(budgetsTable).where(eq(budgetsTable.id, id));
    res.json({ message: "Budget deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

export default router;
