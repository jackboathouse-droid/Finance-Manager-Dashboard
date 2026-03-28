import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json(categories);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { name, type } = req.body as { name: string; type: string };
    const [category] = await db.insert(categoriesTable).values({ name, type }).returning();
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
      .where(eq(categoriesTable.id, id))
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
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ message: "Category deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
