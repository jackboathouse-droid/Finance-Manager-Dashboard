import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { manualAssetsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

function validateAsset(body: Record<string, unknown>): { name: string; type: "asset" | "liability"; category: string; value: number } | null {
  const { name, type, category, value } = body;
  if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) return null;
  if (type !== "asset" && type !== "liability") return null;
  const cat = typeof category === "string" ? category.slice(0, 60) : "";
  const val = typeof value === "number" && isFinite(value) && value >= 0 ? value : null;
  if (val === null) return null;
  return { name: name.trim(), type: type as "asset" | "liability", category: cat, value: val };
}

// ── GET /assets ───────────────────────────────────────────────────────────────

router.get("/assets", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const items = await db
      .select()
      .from(manualAssetsTable)
      .where(eq(manualAssetsTable.user_id, userId))
      .orderBy(manualAssetsTable.type, manualAssetsTable.name);

    res.json(items);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch assets." });
  }
});

// ── POST /assets ──────────────────────────────────────────────────────────────

router.post("/assets", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const validated = validateAsset(req.body as Record<string, unknown>);
    if (!validated) return res.status(400).json({ error: "Invalid data. name, type (asset|liability), and value (≥0) are required." });

    const { name, type, category, value } = validated;

    const [created] = await db
      .insert(manualAssetsTable)
      .values({ user_id: userId, name, type, category, value: String(value) })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create asset." });
  }
});

// ── PUT /assets/:id ───────────────────────────────────────────────────────────

router.put("/assets/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id." });

    const validated = validateAsset(req.body as Record<string, unknown>);
    if (!validated) return res.status(400).json({ error: "Invalid data. name, type (asset|liability), and value (≥0) are required." });

    const { name, type, category, value } = validated;

    const [updated] = await db
      .update(manualAssetsTable)
      .set({ name, type, category, value: String(value) })
      .where(and(eq(manualAssetsTable.id, id), eq(manualAssetsTable.user_id, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Asset not found." });

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update asset." });
  }
});

// ── DELETE /assets/:id ────────────────────────────────────────────────────────

router.delete("/assets/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id." });

    const [deleted] = await db
      .delete(manualAssetsTable)
      .where(and(eq(manualAssetsTable.id, id), eq(manualAssetsTable.user_id, userId)))
      .returning({ id: manualAssetsTable.id });

    if (!deleted) return res.status(404).json({ error: "Asset not found." });

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete asset." });
  }
});

// ── GET /assets/summary ───────────────────────────────────────────────────────

router.get("/assets/summary", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'asset' THEN value::numeric ELSE 0 END), 0) AS total_assets,
        COALESCE(SUM(CASE WHEN type = 'liability' THEN value::numeric ELSE 0 END), 0) AS total_liabilities,
        COUNT(*) AS item_count
      FROM manual_assets
      WHERE user_id = ${userId}
    `);

    const row = result.rows[0] ?? { total_assets: "0", total_liabilities: "0", item_count: "0" };
    res.json({
      total_assets: parseFloat(String(row.total_assets)),
      total_liabilities: parseFloat(String(row.total_liabilities)),
      net: parseFloat(String(row.total_assets)) - parseFloat(String(row.total_liabilities)),
      item_count: parseInt(String(row.item_count)),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch asset summary." });
  }
});

export default router;
