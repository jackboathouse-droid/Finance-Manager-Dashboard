import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, subcategoriesTable, transactionsTable } from "@workspace/db";
import { eq, and, sql, or } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const categories = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.user_id, userId))
      .orderBy(categoriesTable.name);
    res.json(categories);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/categories/transaction-counts", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const counts = await db
      .select({
        category_id: transactionsTable.category_id,
        count: sql<string>`COUNT(*)`,
      })
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, userId))
      .groupBy(transactionsTable.category_id);

    const result: Record<number, number> = {};
    for (const row of counts) {
      if (row.category_id != null) {
        result[row.category_id] = parseInt(row.count ?? "0");
      }
    }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch transaction counts" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { name, type } = req.body as { name: string; type: string };
    const [category] = await db
      .insert(categoriesTable)
      .values({ name, type, user_id: userId })
      .returning();
    res.status(201).json(category);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    const { name, type } = req.body as { name: string; type: string };
    const [category] = await db
      .update(categoriesTable)
      .set({ name, type })
      .where(and(eq(categoriesTable.id, id), eq(categoriesTable.user_id, userId)))
      .returning();
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);

    // Check for linked transactions (direct category OR via subcategory under this category)
    const subIds = await db
      .select({ id: subcategoriesTable.id })
      .from(subcategoriesTable)
      .where(and(eq(subcategoriesTable.category_id, id), eq(subcategoriesTable.user_id, userId)));

    const subIdList = subIds.map((r) => r.id);

    const [txCountRow] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          subIdList.length > 0
            ? or(
                eq(transactionsTable.category_id, id),
                sql`${transactionsTable.subcategory_id} = ANY(ARRAY[${sql.join(subIdList.map((sid) => sql`${sid}`), sql`, `)}]::int[])`
              )
            : eq(transactionsTable.category_id, id)
        )
      );

    const txCount = parseInt(txCountRow?.count ?? "0");
    if (txCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${txCount} transaction${txCount !== 1 ? "s" : ""} are linked to this category or its subcategories.`,
        transaction_count: txCount,
      });
    }

    await db
      .delete(categoriesTable)
      .where(and(eq(categoriesTable.id, id), eq(categoriesTable.user_id, userId)));
    res.json({ message: "Category deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
