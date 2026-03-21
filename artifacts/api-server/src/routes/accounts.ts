import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accountsTable, transactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/accounts", async (req, res) => {
  try {
    const accounts = await db.select().from(accountsTable).orderBy(accountsTable.name);
    const accountsWithBalance = await Promise.all(
      accounts.map(async (account) => {
        const result = await db
          .select({ balance: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
          .from(transactionsTable)
          .where(eq(transactionsTable.account_id, account.id));
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
    const { name, type, person } = req.body as { name: string; type: string; person: string };
    const [account] = await db.insert(accountsTable).values({ name, type, person }).returning();
    res.status(201).json({ ...account, balance: 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.get("/accounts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
    if (!account) return res.status(404).json({ error: "Account not found" });
    const result = await db
      .select({ balance: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(eq(transactionsTable.account_id, id));
    res.json({ ...account, balance: parseFloat(result[0]?.balance ?? "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

router.put("/accounts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, type, person } = req.body as { name: string; type: string; person: string };
    const [account] = await db
      .update(accountsTable)
      .set({ name, type, person })
      .where(eq(accountsTable.id, id))
      .returning();
    if (!account) return res.status(404).json({ error: "Account not found" });
    const result = await db
      .select({ balance: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(eq(transactionsTable.account_id, id));
    res.json({ ...account, balance: parseFloat(result[0]?.balance ?? "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

router.delete("/accounts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(accountsTable).where(eq(accountsTable.id, id));
    res.json({ message: "Account deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
