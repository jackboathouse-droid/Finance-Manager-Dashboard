import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  transactionsTable,
  accountsTable,
  categoriesTable,
  subcategoriesTable,
} from "@workspace/db";
import { eq, and, gte, lte, sql, ne, or } from "drizzle-orm";

const router: IRouter = Router();

const CHART_COLORS = [
  "#4FC3F7", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#14B8A6", "#F97316", "#84CC16",
];

// ── Shared helpers ────────────────────────────────────────────────────────────

function buildDateConditions(start_date?: string, end_date?: string) {
  const conds: any[] = [];
  if (start_date) conds.push(gte(transactionsTable.date, start_date));
  if (end_date) conds.push(lte(transactionsTable.date, end_date));
  return conds;
}

function personClause(person?: string) {
  const trimmed = person?.trim();
  if (!trimmed || trimmed.toLowerCase() === "total") return undefined;
  return sql`LOWER(TRIM(${transactionsTable.person})) = LOWER(TRIM(${trimmed}))`;
}

// ── Profit & Loss ─────────────────────────────────────────────────────────────

router.get("/reports/profit-loss", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { start_date, end_date, category_id, account_id, person } = req.query as Record<string, string>;
    const pc = personClause(person);

    const baseConds: any[] = [
      eq(transactionsTable.user_id, userId),
      ne(transactionsTable.type, "transfer"),
      ...buildDateConditions(start_date, end_date),
    ];
    if (account_id) baseConds.push(eq(transactionsTable.account_id, parseInt(account_id)));
    if (pc) baseConds.push(pc);

    // Monthly breakdown
    const monthlyRaw = await db
      .select({
        month: sql<string>`to_char(${transactionsTable.date}, 'YYYY-MM')`,
        type: transactionsTable.type,
        total: sql<string>`SUM(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(
        category_id
          ? and(...baseConds, eq(transactionsTable.category_id, parseInt(category_id)))
          : and(...baseConds)
      )
      .groupBy(sql`to_char(${transactionsTable.date}, 'YYYY-MM')`, transactionsTable.type)
      .orderBy(sql`to_char(${transactionsTable.date}, 'YYYY-MM')`);

    const monthMap: Record<string, { income: number; expenses: number }> = {};
    let total_income = 0;
    let total_expenses = 0;

    for (const row of monthlyRaw) {
      if (!monthMap[row.month]) monthMap[row.month] = { income: 0, expenses: 0 };
      if (row.type === "income") {
        const val = parseFloat(row.total ?? "0");
        monthMap[row.month].income = val;
        total_income += val;
      } else if (row.type === "expense") {
        const val = Math.abs(parseFloat(row.total ?? "0"));
        monthMap[row.month].expenses = val;
        total_expenses += val;
      }
    }

    const monthly = Object.entries(monthMap).map(([month, v]) => ({ month, ...v }));

    // Category breakdown (expenses only)
    const byCategoryConds: any[] = [
      ...baseConds,
      eq(transactionsTable.type, "expense"),
    ];

    const byCategory = await db
      .select({
        category: categoriesTable.name,
        amount: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .leftJoin(categoriesTable, and(eq(transactionsTable.category_id, categoriesTable.id), eq(categoriesTable.user_id, userId)))
      .where(and(...byCategoryConds))
      .groupBy(categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`);

    res.json({
      total_income,
      total_expenses,
      net_profit: total_income - total_expenses,
      monthly,
      by_category: byCategory
        .filter((r) => r.category)
        .map((r, i) => ({
          category: r.category as string,
          amount: parseFloat(r.amount ?? "0"),
          color: CHART_COLORS[i % CHART_COLORS.length],
        })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate profit & loss report" });
  }
});

// ── Balance Sheet ─────────────────────────────────────────────────────────────

router.get("/reports/balance-sheet", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { person } = req.query as Record<string, string>;
    const pc = personClause(person);

    // Get all accounts for this user
    const accounts = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, userId))
      .orderBy(accountsTable.name);

    // Calculate balance for each account: starting_balance + sum(transactions)
    const balances = await Promise.all(
      accounts.map(async (acc) => {
        const txConds: any[] = [
          eq(transactionsTable.account_id, acc.id),
          eq(transactionsTable.user_id, userId),
        ];
        if (pc) txConds.push(pc);

        const [result] = await db
          .select({ balance: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
          .from(transactionsTable)
          .where(and(...txConds));

        const startingBal = parseFloat((acc as any).starting_balance ?? "0");
        return {
          account: acc.name,
          type: acc.type,
          balance: startingBal + parseFloat(result?.balance ?? "0"),
        };
      })
    );

    const assets = balances.filter((b) => b.type === "bank");
    const liabilities = balances.filter((b) => b.type === "credit_card").map((b) => ({
      ...b,
      balance: Math.abs(b.balance), // show as positive liability amount
    }));

    const total_assets = assets.reduce((s, a) => s + a.balance, 0);
    const total_liabilities = liabilities.reduce((s, l) => s + l.balance, 0);

    res.json({
      total_assets,
      total_liabilities,
      net_worth: total_assets - total_liabilities,
      assets,
      liabilities,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate balance sheet" });
  }
});

// ── Spending Analysis ─────────────────────────────────────────────────────────

router.get("/reports/spending", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { start_date, end_date, category_id, account_id, person } = req.query as Record<string, string>;
    const pc = personClause(person);

    const baseConds: any[] = [
      eq(transactionsTable.user_id, userId),
      eq(transactionsTable.type, "expense"),
      ...buildDateConditions(start_date, end_date),
    ];
    if (category_id) baseConds.push(eq(transactionsTable.category_id, parseInt(category_id)));
    if (account_id) baseConds.push(eq(transactionsTable.account_id, parseInt(account_id)));
    if (pc) baseConds.push(pc);

    // By category
    const byCategory = await db
      .select({
        category: categoriesTable.name,
        amount: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .leftJoin(categoriesTable, and(eq(transactionsTable.category_id, categoriesTable.id), eq(categoriesTable.user_id, userId)))
      .where(and(...baseConds))
      .groupBy(categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`);

    // By subcategory
    const bySubcategory = await db
      .select({
        subcategory: subcategoriesTable.name,
        category: categoriesTable.name,
        amount: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .leftJoin(subcategoriesTable, and(eq(transactionsTable.subcategory_id, subcategoriesTable.id), eq(subcategoriesTable.user_id, userId)))
      .leftJoin(categoriesTable, and(eq(transactionsTable.category_id, categoriesTable.id), eq(categoriesTable.user_id, userId)))
      .where(and(...baseConds, sql`${transactionsTable.subcategory_id} IS NOT NULL`))
      .groupBy(subcategoriesTable.name, categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`)
      .limit(15);

    res.json({
      by_category: byCategory
        .filter((r) => r.category)
        .map((r, i) => ({
          category: r.category as string,
          amount: parseFloat(r.amount ?? "0"),
          color: CHART_COLORS[i % CHART_COLORS.length],
        })),
      by_subcategory: bySubcategory
        .filter((r) => r.subcategory)
        .map((r, i) => ({
          subcategory: r.subcategory as string,
          category: r.category ?? "Uncategorised",
          amount: parseFloat(r.amount ?? "0"),
          color: CHART_COLORS[i % CHART_COLORS.length],
        })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate spending report" });
  }
});

// ── Report transactions (date-range aware) ─────────────────────────────────────

router.get("/reports/transactions", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { start_date, end_date, category_id, account_id, person } = req.query as Record<string, string>;
    const pc = personClause(person);

    const conds: any[] = [
      eq(transactionsTable.user_id, userId),
      ...buildDateConditions(start_date, end_date),
    ];
    if (category_id) conds.push(eq(transactionsTable.category_id, parseInt(category_id)));
    if (account_id) conds.push(eq(transactionsTable.account_id, parseInt(account_id)));
    if (pc) conds.push(pc);

    const results = await db
      .select({
        id: transactionsTable.id,
        date: transactionsTable.date,
        description: transactionsTable.description,
        account_id: transactionsTable.account_id,
        category_id: transactionsTable.category_id,
        subcategory_id: transactionsTable.subcategory_id,
        amount: transactionsTable.amount,
        person: transactionsTable.person,
        type: transactionsTable.type,
        account_name: accountsTable.name,
        category_name: categoriesTable.name,
        subcategory_name: subcategoriesTable.name,
      })
      .from(transactionsTable)
      .leftJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
      .leftJoin(categoriesTable, and(eq(transactionsTable.category_id, categoriesTable.id), eq(categoriesTable.user_id, userId)))
      .leftJoin(subcategoriesTable, and(eq(transactionsTable.subcategory_id, subcategoriesTable.id), eq(subcategoriesTable.user_id, userId)))
      .where(and(...conds))
      .orderBy(sql`${transactionsTable.date} DESC`)
      .limit(500);

    res.json(results.map((r) => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch report transactions" });
  }
});

export default router;
