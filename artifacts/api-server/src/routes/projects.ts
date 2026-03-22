import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  projectContributionsTable,
  transactionsTable,
  accountsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

// ── Sample projects for new users ─────────────────────────────────────────────

const SAMPLE_PROJECTS = [
  { name: "Holiday Fund", description: "Saving for the perfect getaway", icon: "plane", color: "#4FC3F7", target_amount: "5000", current_amount: "850" },
  { name: "House Deposit", description: "Working toward owning a home", icon: "home", color: "#10B981", target_amount: "50000", current_amount: "12400" },
  { name: "Business Project", description: "Funding my next venture", icon: "briefcase", color: "#8B5CF6", target_amount: "15000", current_amount: "3200" },
  { name: "New Car", description: "Saving for a reliable set of wheels", icon: "car", color: "#F59E0B", target_amount: "20000", current_amount: "5100" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Authentication required." }); return null; }
  return userId;
}

function calcMilestone(prevAmount: number, newAmount: number, target: number): number | null {
  if (target <= 0) return null;
  const prevPct = Math.floor((prevAmount / target) * 10) * 10;
  const newPct  = Math.floor((newAmount  / target) * 10) * 10;
  if (newPct > prevPct && newPct <= 100) return newPct;
  return null;
}

function toProject(p: any) {
  const cur = parseFloat(p.current_amount);
  const tgt = parseFloat(p.target_amount);
  return {
    ...p,
    target_amount: tgt,
    current_amount: cur,
    progress_pct: tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0,
  };
}

/** Create a transfer transaction that debits an account.
 *  Returns the created transaction id. */
async function createTransferTx(
  userId: number,
  accountId: number,
  amount: number,
  description: string
): Promise<number> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const [tx] = await db
    .insert(transactionsTable)
    .values({
      date: today,
      description,
      account_id: accountId,
      amount: String(-Math.abs(amount)), // always outflow
      person: "",
      type: "transfer",
      user_id: userId,
      category_id: null as any,
      subcategory_id: null as any,
    })
    .returning();
  return tx.id;
}

// ── List projects ─────────────────────────────────────────────────────────────

router.get("/projects", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    let projects = await db
      .select().from(projectsTable)
      .where(eq(projectsTable.user_id, userId))
      .orderBy(projectsTable.created_at);

    if (projects.length === 0) {
      const seeded = await db.insert(projectsTable).values(
        SAMPLE_PROJECTS.map((p) => ({
          ...p,
          user_id: userId,
          milestone_notified: Math.floor(
            (parseFloat(p.current_amount) / parseFloat(p.target_amount)) * 10
          ) * 10,
        }))
      ).returning();
      projects = seeded;
    }

    res.json(projects.map(toProject));
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

    const { name, description, icon, color, target_amount, deadline, starting_balance, account_id } = req.body as {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      target_amount?: number;
      deadline?: string;
      starting_balance?: number;
      account_id?: number;
    };

    if (!name?.trim()) return res.status(400).json({ error: "Project name is required." });
    if (!target_amount || target_amount <= 0) return res.status(400).json({ error: "Target amount must be greater than zero." });

    const initAmount = Math.max(0, starting_balance ?? 0);
    const milestoneNotified = initAmount > 0
      ? Math.floor((initAmount / target_amount) * 10) * 10
      : 0;

    const [project] = await db.insert(projectsTable).values({
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || "piggy-bank",
      color: color || "#4FC3F7",
      target_amount: String(target_amount),
      current_amount: String(initAmount),
      deadline: deadline || null,
      status: initAmount >= target_amount ? "completed" : "active",
      milestone_notified: milestoneNotified,
    }).returning();

    // If a starting balance and source account are provided, create a transfer transaction
    let transactionId: number | null = null;
    if (initAmount > 0 && account_id) {
      // Verify the account belongs to this user
      const [acc] = await db.select({ id: accountsTable.id }).from(accountsTable)
        .where(and(eq(accountsTable.id, account_id), eq(accountsTable.user_id, userId)));
      if (acc) {
        transactionId = await createTransferTx(userId, account_id, initAmount, `Initial funding: ${project.name}`);
        await db.insert(projectContributionsTable).values({
          project_id: project.id,
          user_id: userId,
          amount: String(initAmount),
          note: "Starting balance",
          account_id,
          transaction_id: transactionId,
        });
      }
    }

    req.log.info({ userId, projectId: project.id, initAmount }, "Project created");

    const milestone = milestoneNotified > 0 ? milestoneNotified : null;
    res.status(201).json({
      ...toProject(project),
      milestone,
      completed: initAmount >= target_amount,
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
      name?: string; description?: string; icon?: string; color?: string;
      target_amount?: number; deadline?: string; status?: string;
    };

    const [existing] = await db.select().from(projectsTable)
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

    const [updated] = await db.update(projectsTable).set(updates)
      .where(eq(projectsTable.id, id)).returning();

    res.json(toProject(updated));
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
    const [existing] = await db.select({ id: projectsTable.id }).from(projectsTable)
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
    const { amount, note, account_id } = req.body as {
      amount?: number;
      note?: string;
      account_id?: number;
    };

    if (!amount || amount <= 0) return res.status(400).json({ error: "Amount must be greater than zero." });

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.user_id, userId)));
    if (!project) return res.status(404).json({ error: "Project not found." });
    if (project.status === "paused") return res.status(400).json({ error: "Cannot add funds to a paused project." });

    const prevAmount = parseFloat(project.current_amount);
    const target    = parseFloat(project.target_amount);
    const newAmount = Math.min(prevAmount + amount, target);

    // Milestone and completion detection
    const milestone         = calcMilestone(prevAmount, newAmount, target);
    const newMilestoneNotif = milestone !== null
      ? Math.max(project.milestone_notified, milestone)
      : project.milestone_notified;
    const newStatus = newAmount >= target ? "completed" : project.status;

    // Create ledger transaction if a source account is given
    let transactionId: number | null = null;
    if (account_id) {
      const [acc] = await db.select({ id: accountsTable.id }).from(accountsTable)
        .where(and(eq(accountsTable.id, account_id), eq(accountsTable.user_id, userId)));
      if (!acc) return res.status(400).json({ error: "Account not found." });
      transactionId = await createTransferTx(userId, account_id, amount, `Contribution: ${project.name}`);
    }

    // Record contribution
    const [contribution] = await db.insert(projectContributionsTable).values({
      project_id: id,
      user_id: userId,
      amount: String(amount),
      note: note?.trim() || null,
      account_id: account_id ?? null,
      transaction_id: transactionId,
    }).returning();

    // Update project
    const [updated] = await db.update(projectsTable).set({
      current_amount: String(newAmount),
      status: newStatus,
      milestone_notified: newMilestoneNotif,
    }).where(eq(projectsTable.id, id)).returning();

    req.log.info({ userId, projectId: id, amount, milestone, accountId: account_id }, "Contribution added");

    res.status(201).json({
      contribution: { ...contribution, amount: parseFloat(contribution.amount) },
      project: toProject(updated),
      milestone,
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
    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.user_id, userId)));
    if (!project) return res.status(404).json({ error: "Project not found." });

    const contributions = await db.select({
      id: projectContributionsTable.id,
      project_id: projectContributionsTable.project_id,
      amount: projectContributionsTable.amount,
      note: projectContributionsTable.note,
      account_id: projectContributionsTable.account_id,
      account_name: accountsTable.name,
      contributed_at: projectContributionsTable.contributed_at,
    })
      .from(projectContributionsTable)
      .leftJoin(accountsTable, eq(projectContributionsTable.account_id, accountsTable.id))
      .where(eq(projectContributionsTable.project_id, id))
      .orderBy(desc(projectContributionsTable.contributed_at));

    res.json(contributions.map((c) => ({ ...c, amount: parseFloat(c.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contributions." });
  }
});

// ── Dashboard summary ─────────────────────────────────────────────────────────

router.get("/projects/summary", async (req, res) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const projects = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.user_id, userId), eq(projectsTable.status, "active")))
      .orderBy(projectsTable.created_at)
      .limit(4);

    res.json(projects.map(toProject));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch project summary." });
  }
});

export default router;
