import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { subcategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
        .where(eq(subcategoriesTable.category_id, categoryId))
        .orderBy(subcategoriesTable.name);
      return res.json(results);
    }
    const results = await db.select().from(subcategoriesTable).orderBy(subcategoriesTable.name);
    res.json(results);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch subcategories" });
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
    const [subcategory] = await db
      .insert(subcategoriesTable)
      .values({ name, category_id, type })
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
    const [subcategory] = await db
      .update(subcategoriesTable)
      .set({ name, category_id, type })
      .where(eq(subcategoriesTable.id, id))
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
    await db.delete(subcategoriesTable).where(eq(subcategoriesTable.id, id));
    res.json({ message: "Subcategory deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete subcategory" });
  }
});

export default router;
