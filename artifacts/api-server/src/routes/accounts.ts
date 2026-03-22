import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accountsTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/accounts", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const accounts = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, userId))
      .orderBy(accountsTable.name);

    const accountsWithBalance = await Promise.all(
      accounts.map(async (account) => {
        const result = await db
          .select({ balance: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.account_id, account.id),
              eq(transactionsTable.user_id, userId)
            )
          );
        return {
          ...account,
          balance: parseFloat(result[0]?.balance ?? "0"),
        };
      })
    );
    res.json(accountsWithBalance);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

router.post("/accounts", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { name, type, person } = req.body as { name: string; type: string; person: string };
    const [account] = await db
      .insert(accountsTable)
      .values({ name, type, person, user_id: userId })
      .returning();
    res.status(201).json({ ...account, balance: 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.get("/accounts/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    const [account] = await db
      .select()
      .from(accountsTable)
      .where(and(eq(accountsTable.id, id), eq(accountsTable.user_id, userId)));

    if (!account) return res.status(404).json({ error: "Account not found" });

    const result = await db
      .select({ balance: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.account_id, id),
          eq(transactionsTable.user_id, userId)
        )
      );
    res.json({ ...account, balance: parseFloat(result[0]?.balance ?? "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

router.put("/accounts/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    const { name, type, person } = req.body as { name: string; type: string; person: string };

    const [account] = await db
      .update(accountsTable)
      .set({ name, type, person })
      .where(and(eq(accountsTable.id, id), eq(accountsTable.user_id, userId)))
      .returning();

    if (!account) return res.status(404).json({ error: "Account not found" });

    const result = await db
      .select({ balance: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.account_id, id),
          eq(transactionsTable.user_id, userId)
        )
      );
    res.json({ ...account, balance: parseFloat(result[0]?.balance ?? "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

router.delete("/accounts/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    await db
      .delete(accountsTable)
      .where(and(eq(accountsTable.id, id), eq(accountsTable.user_id, userId)));
    res.json({ message: "Account deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
