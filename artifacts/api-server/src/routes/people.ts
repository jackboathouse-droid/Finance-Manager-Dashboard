import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): number | null {
  if (!req.session?.authenticated || !req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.session.userId;
}

// ── GET /people ───────────────────────────────────────────────────────────────
router.get("/people", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const rows = await db.execute(
      sql`SELECT id, name, created_at FROM people WHERE user_id = ${userId} ORDER BY name ASC`
    );
    res.json(rows.rows);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to fetch people" });
  }
});

// ── POST /people ──────────────────────────────────────────────────────────────
router.post("/people", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const name = (req.body.name as string | undefined)?.trim();
  if (!name) return res.status(400).json({ error: "name is required" });

  try {
    const rows = await db.execute(
      sql`INSERT INTO people (name, user_id) VALUES (${name}, ${userId})
          ON CONFLICT (name, user_id) DO NOTHING
          RETURNING id, name, created_at`
    );
    if (rows.rows.length === 0) {
      // Name already existed — return the existing row
      const existing = await db.execute(
        sql`SELECT id, name, created_at FROM people WHERE name = ${name} AND user_id = ${userId}`
      );
      return res.json(existing.rows[0]);
    }
    res.status(201).json(rows.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create person" });
  }
});

// ── DELETE /people/:id ────────────────────────────────────────────────────────
router.delete("/people/:id", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const result = await db.execute(
      sql`DELETE FROM people WHERE id = ${id} AND user_id = ${userId} RETURNING id`
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Person not found" });
    }
    res.json({ message: "Person deleted", id });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete person" });
  }
});

export default router;
