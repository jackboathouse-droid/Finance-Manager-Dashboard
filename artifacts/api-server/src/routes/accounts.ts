import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accountsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";

const FREE_ACCOUNT_LIMIT = 2;

const router: IRouter = Router();

/** Compute balance = starting_balance + sum(transactions) */
const balanceExpr = (accountId: number, userId: number) =>
  db
    .select({
      txSum: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.account_id, accountId),
        eq(transactionsTable.user_id, userId)
      )
    );

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
        const [result] = await balanceExpr(account.id, userId);
        const txSum = parseFloat(result?.txSum ?? "0");
        const startingBal = parseFloat(account.starting_balance ?? "0");
        return {
          ...account,
          starting_balance: startingBal,
          balance: startingBal + txSum,
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

    const [user] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
    const plan = user?.plan ?? "free";

    if (plan === "free") {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(accountsTable)
        .where(eq(accountsTable.user_id, userId));
      if (Number(cnt) >= FREE_ACCOUNT_LIMIT) {
        return res.status(402).json({
          error: "Free plan limit reached.",
          limit: FREE_ACCOUNT_LIMIT,
          upgrade: true,
        });
      }
    }

    const { name, type, person, starting_balance } = req.body as {
      name: string;
      type: string;
      person: string;
      starting_balance?: number;
    };

    const startingBal = typeof starting_balance === "number" ? starting_balance : 0;

    const [account] = await db
      .insert(accountsTable)
      .values({ name, type, person, user_id: userId, starting_balance: String(startingBal) })
      .returning();

    res.status(201).json({
      ...account,
      starting_balance: startingBal,
      balance: startingBal,
    });
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

    const [result] = await balanceExpr(id, userId);
    const txSum = parseFloat(result?.txSum ?? "0");
    const startingBal = parseFloat(account.starting_balance ?? "0");

    res.json({ ...account, starting_balance: startingBal, balance: startingBal + txSum });
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
    const { name, type, person, starting_balance } = req.body as {
      name: string;
      type: string;
      person: string;
      starting_balance?: number;
    };

    const updateData: Record<string, unknown> = { name, type, person };
    if (typeof starting_balance === "number") {
      updateData.starting_balance = String(starting_balance);
    }

    const [account] = await db
      .update(accountsTable)
      .set(updateData)
      .where(and(eq(accountsTable.id, id), eq(accountsTable.user_id, userId)))
      .returning();

    if (!account) return res.status(404).json({ error: "Account not found" });

    const [result] = await balanceExpr(id, userId);
    const txSum = parseFloat(result?.txSum ?? "0");
    const startingBal = parseFloat(account.starting_balance ?? "0");

    res.json({ ...account, starting_balance: startingBal, balance: startingBal + txSum });
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
