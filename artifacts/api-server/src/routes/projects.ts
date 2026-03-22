import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectContributionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Sample projects seeded for new users ─────────────────────────────────────

const SAMPLE_PROJECTS = [
  {
    name: "Holiday Fund",
    description: "Saving for the perfect getaway",
    icon: "plane",
    color: "#4FC3F7",
    target_amount: "5000",
    current_amount: "850",
  },
  {
    name: "House Deposit",
    description: "Working toward owning a home",
    icon: "home",
    color: "#10B981",
    target_amount: "50000",
    current_amount: "12400",
  },
  {
    name: "Business Project",
    description: "Funding my next venture",
    icon: "briefcase",
    color: "#8B5CF6",
    target_amount: "15000",
    current_amount: "3200",
  },
  {
    name: "New Car",
    description: "Saving for a reliable set of wheels",
    icon: "car",
    color: "#F59E0B",
    target_amount: "20000",
    current_amount: "5100",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcMilestone(prevAmount: number, newAmount: number, target: number): number | null {
  if (target <= 0) return null;
  const prevPct = Math.floor((prevAmount / target) * 10) * 10;
  const newPct = Math.floor((newAmount / target) * 10) * 10;
  if (newPct > prevPct && newPct <= 100) return newPct;
  return null;
}

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }
  return userId;
}

// ── List projects ─────────────────────────────────────────────────────────────

router.get("/projects", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    let projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.user_id, userId))
      .orderBy(projectsTable.created_at);

    // Auto-seed sample projects for new users
    if (projects.length === 0) {
      const seeded = await db
        .insert(projectsTable)
        .values(
          SAMPLE_PROJECTS.map((p) => ({
            ...p,
            user_id: userId,
            milestone_notified: Math.floor(
              (parseFloat(p.current_amount) / parseFloat(p.target_amount)) * 10
            ) * 10,
          }))
        )
        .returning();
      projects = seeded;
    }

    res.json(
      projects.map((p) => ({
        ...p,
        target_amount: parseFloat(p.target_amount),
        current_amount: parseFloat(p.current_amount),
        progress_pct: Math.min(
          100,
          Math.round((parseFloat(p.current_amount) / parseFloat(p.target_amount)) * 100)
        ),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch projects." });
  }
});

// ── Create project ────────────────────────────────────────────────────────────

router.post("/projects", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { name, description, icon, color, target_amount, deadline } = req.body as {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      target_amount?: number;
      deadline?: string;
    };

    if (!name?.trim()) return res.status(400).json({ error: "Project name is required." });
    if (!target_amount || target_amount <= 0)
      return res.status(400).json({ error: "Target amount must be greater than zero." });

    const [project] = await db
      .insert(projectsTable)
      .values({
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || "piggy-bank",
        color: color || "#4FC3F7",
        target_amount: String(target_amount),
        current_amount: "0",
        deadline: deadline || null,
        milestone_notified: 0,
      })
      .returning();

    req.log.info({ userId, projectId: project.id }, "Project created");

    res.status(201).json({
      ...project,
      target_amount: parseFloat(project.target_amount),
      current_amount: parseFloat(project.current_amount),
      progress_pct: 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create project." });
  }
});

// ── Update project ────────────────────────────────────────────────────────────

router.put("/projects/:id", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const id = parseInt(req.params.id);
    const { name, description, icon, color, target_amount, deadline, status } = req.body as {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      target_amount?: number;
      deadline?: string;
      status?: string;
    };

    const [existing] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.user_id, userId)));

    if (!existing) return res.status(404).json({ error: "Project not found." });

    const updates: Partial<typeof projectsTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (target_amount !== undefined) updates.target_amount = String(target_amount);
    if (deadline !== undefined) updates.deadline = deadline || null;
    if (status !== undefined) updates.status = status;

    const [updated] = await db
      .update(projectsTable)
      .set(updates)
      .where(eq(projectsTable.id, id))
      .returning();

    const cur = parseFloat(updated.current_amount);
    const tgt = parseFloat(updated.target_amount);

    res.json({
      ...updated,
      target_amount: tgt,
      current_amount: cur,
      progress_pct: tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update project." });
  }
});

// ── Delete project ────────────────────────────────────────────────────────────

router.delete("/projects/:id", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const id = parseInt(req.params.id);

    const [existing] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.user_id, userId)));

    if (!existing) return res.status(404).json({ error: "Project not found." });

    await db.delete(projectsTable).where(eq(projectsTable.id, id));

    res.json({ message: "Project deleted." });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete project." });
  }
});

// ── Add contribution ──────────────────────────────────────────────────────────

router.post("/projects/:id/contributions", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const id = parseInt(req.params.id);
    const { amount, note } = req.body as { amount?: number; note?: string };

    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Amount must be greater than zero." });

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.user_id, userId)));

    if (!project) return res.status(404).json({ error: "Project not found." });
    if (project.status === "paused")
      return res.status(400).json({ error: "Cannot add funds to a paused project." });

    const prevAmount = parseFloat(project.current_amount);
    const target = parseFloat(project.target_amount);
    const newAmount = Math.min(prevAmount + amount, target);

    // Check for milestone crossing
    const milestone = calcMilestone(prevAmount, newAmount, target);
    const newMilestoneNotified =
      milestone !== null
        ? Math.max(project.milestone_notified, milestone)
        : project.milestone_notified;

    // Auto-complete if fully funded
    const newStatus = newAmount >= target ? "completed" : project.status;

    const [contribution] = await db
      .insert(projectContributionsTable)
      .values({
        project_id: id,
        user_id: userId,
        amount: String(amount),
        note: note?.trim() || null,
      })
      .returning();

    const [updated] = await db
      .update(projectsTable)
      .set({
        current_amount: String(newAmount),
        status: newStatus,
        milestone_notified: newMilestoneNotified,
      })
      .where(eq(projectsTable.id, id))
      .returning();

    req.log.info({ userId, projectId: id, amount, milestone }, "Contribution added");

    res.status(201).json({
      contribution: {
        ...contribution,
        amount: parseFloat(contribution.amount),
      },
      project: {
        ...updated,
        target_amount: parseFloat(updated.target_amount),
        current_amount: parseFloat(updated.current_amount),
        progress_pct: Math.min(100, Math.round((newAmount / target) * 100)),
      },
      milestone, // null or 10–100
      completed: newStatus === "completed" && project.status !== "completed",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to add contribution." });
  }
});

// ── Contribution history ──────────────────────────────────────────────────────

router.get("/projects/:id/contributions", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const id = parseInt(req.params.id);

    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.user_id, userId)));

    if (!project) return res.status(404).json({ error: "Project not found." });

    const contributions = await db
      .select()
      .from(projectContributionsTable)
      .where(eq(projectContributionsTable.project_id, id))
      .orderBy(desc(projectContributionsTable.contributed_at));

    res.json(
      contributions.map((c) => ({
        ...c,
        amount: parseFloat(c.amount),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contributions." });
  }
});

// ── Dashboard summary (active projects only) ──────────────────────────────────

router.get("/projects/summary", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const projects = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.user_id, userId), eq(projectsTable.status, "active")))
      .orderBy(projectsTable.created_at)
      .limit(4);

    res.json(
      projects.map((p) => {
        const cur = parseFloat(p.current_amount);
        const tgt = parseFloat(p.target_amount);
        return {
          ...p,
          target_amount: tgt,
          current_amount: cur,
          progress_pct: tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0,
        };
      })
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch project summary." });
  }
});

export default router;
