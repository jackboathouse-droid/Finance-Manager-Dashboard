import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

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
