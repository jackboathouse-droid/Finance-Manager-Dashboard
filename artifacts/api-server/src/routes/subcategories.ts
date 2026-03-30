import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { subcategoriesTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { categoryBelongsToUser } from "../lib/validate-ownership";

const router: IRouter = Router();

router.get("/subcategories", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const categoryId = req.query.category_id ? parseInt(req.query.category_id as string) : null;
    if (categoryId) {
      const results = await db
        .select()
        .from(subcategoriesTable)
        .where(
          and(
            eq(subcategoriesTable.category_id, categoryId),
            eq(subcategoriesTable.user_id, userId)
          )
        )
        .orderBy(subcategoriesTable.name);
      return res.json(results);
    }
    const results = await db
      .select()
      .from(subcategoriesTable)
      .where(eq(subcategoriesTable.user_id, userId))
      .orderBy(subcategoriesTable.name);
    res.json(results);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch subcategories" });
  }
});

router.get("/subcategories/transaction-counts", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const counts = await db
      .select({
        subcategory_id: transactionsTable.subcategory_id,
        count: sql<string>`COUNT(*)`,
      })
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, userId))
      .groupBy(transactionsTable.subcategory_id);

    const result: Record<number, number> = {};
    for (const row of counts) {
      if (row.subcategory_id != null) {
        result[row.subcategory_id] = parseInt(row.count ?? "0");
      }
    }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch transaction counts" });
  }
});

router.post("/subcategories", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { name, category_id, type } = req.body as {
      name: string;
      category_id: number;
      type: string;
    };

    // Ensure parent category belongs to this user
    if (!(await categoryBelongsToUser(category_id, userId))) {
      return res.status(403).json({ error: "Invalid parent category." });
    }

    const [subcategory] = await db
      .insert(subcategoriesTable)
      .values({ name, category_id, type, user_id: userId })
      .returning();
    res.status(201).json(subcategory);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create subcategory" });
  }
});

router.put("/subcategories/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    const { name, category_id, type } = req.body as {
      name: string;
      category_id: number;
      type: string;
    };

    // Ensure parent category belongs to this user
    if (!(await categoryBelongsToUser(category_id, userId))) {
      return res.status(403).json({ error: "Invalid parent category." });
    }

    const [subcategory] = await db
      .update(subcategoriesTable)
      .set({ name, category_id, type })
      .where(and(eq(subcategoriesTable.id, id), eq(subcategoriesTable.user_id, userId)))
      .returning();
    if (!subcategory) return res.status(404).json({ error: "Subcategory not found" });
    res.json(subcategory);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update subcategory" });
  }
});

router.delete("/subcategories/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);

    // Block deletion if any transactions reference this subcategory
    const [txCountRow] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(transactionsTable)
      .where(
        and(eq(transactionsTable.user_id, userId), eq(transactionsTable.subcategory_id, id))
      );

    const txCount = parseInt(txCountRow?.count ?? "0");
    if (txCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${txCount} transaction${txCount !== 1 ? "s" : ""} are linked to this subcategory.`,
        transaction_count: txCount,
      });
    }

    await db
      .delete(subcategoriesTable)
      .where(and(eq(subcategoriesTable.id, id), eq(subcategoriesTable.user_id, userId)));
    res.json({ message: "Subcategory deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete subcategory" });
  }
});

export default router;
