import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  transactionsTable,
  categoriesTable,
  subcategoriesTable,
  budgetsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

const CHART_COLORS = [
  "#4FC3F7",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#84CC16",
];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Case-insensitive, whitespace-trimmed person filter */
function personClause(person?: string) {
  const trimmed = person?.trim();
  if (!trimmed || trimmed.toLowerCase() === "total") return undefined;
  return sql`LOWER(TRIM(${transactionsTable.person})) = LOWER(TRIM(${trimmed}))`;
}

/**
 * Build a date range clause.
 * When start_date/end_date are provided they take priority over month.
 * start_date and end_date must be ISO date strings (YYYY-MM-DD).
 */
function dateRangeClause(month: string, startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return sql`${transactionsTable.date} >= ${startDate}::date AND ${transactionsTable.date} <= ${endDate}::date`;
  }
  return sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`;
}

// ── Summary ───────────────────────────────────────────────────────────────────

router.get("/dashboard/summary", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const month = (req.query.month as string) || currentMonth();
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const person = req.query.person as string | undefined;
    const pc = personClause(person);
    const dateClause = dateRangeClause(month, startDate, endDate);

    const results = await db
      .select({
        type: transactionsTable.type,
        total: sql<string>`SUM(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          dateClause,
          pc
        )
      )
      .groupBy(transactionsTable.type);

    let total_income = 0;
    let total_expenses = 0;

    for (const row of results) {
      if (row.type === "income") {
        total_income = parseFloat(row.total ?? "0");
      } else if (row.type === "expense") {
        total_expenses = Math.abs(parseFloat(row.total ?? "0"));
      }
    }

    res.json({ total_income, total_expenses, net_cash_flow: total_income - total_expenses, month });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

// ── Monthly chart ─────────────────────────────────────────────────────────────

router.get("/dashboard/monthly-chart", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const person = req.query.person as string | undefined;
    const pc = personClause(person);

    const results = await db
      .select({
        month: sql<string>`to_char(${transactionsTable.date}, 'YYYY-MM')`,
        type: transactionsTable.type,
        total: sql<string>`SUM(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          sql`${transactionsTable.date} >= NOW() - INTERVAL '12 months'`,
          pc
        )
      )
      .groupBy(
        sql`to_char(${transactionsTable.date}, 'YYYY-MM')`,
        transactionsTable.type
      )
      .orderBy(sql`to_char(${transactionsTable.date}, 'YYYY-MM')`);

    const monthMap: Record<string, { income: number; expenses: number }> = {};
    for (const row of results) {
      if (!monthMap[row.month]) monthMap[row.month] = { income: 0, expenses: 0 };
      if (row.type === "income") monthMap[row.month].income = parseFloat(row.total ?? "0");
      else if (row.type === "expense")
        monthMap[row.month].expenses = Math.abs(parseFloat(row.total ?? "0"));
    }

    res.json(Object.entries(monthMap).map(([month, values]) => ({ month, ...values })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch monthly chart" });
  }
});

// ── Category chart ────────────────────────────────────────────────────────────

router.get("/dashboard/category-chart", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const month = (req.query.month as string) || currentMonth();
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const person = req.query.person as string | undefined;
    const pc = personClause(person);
    const dateClause = dateRangeClause(month, startDate, endDate);

    const results = await db
      .select({
        category: categoriesTable.name,
        amount: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          dateClause,
          eq(transactionsTable.type, "expense"),
          pc
        )
      )
      .groupBy(categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`);

    res.json(
      results
        .filter((r) => r.category)
        .map((r, idx) => ({
          category: r.category as string,
          amount: parseFloat(r.amount ?? "0"),
          color: CHART_COLORS[idx % CHART_COLORS.length],
        }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch category chart" });
  }
});

// ── Subcategory chart ─────────────────────────────────────────────────────────

router.get("/dashboard/subcategory-chart", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const month = (req.query.month as string) || currentMonth();
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const person = req.query.person as string | undefined;
    const pc = personClause(person);
    const dateClause = dateRangeClause(month, startDate, endDate);

    const results = await db
      .select({
        subcategory: subcategoriesTable.name,
        category: categoriesTable.name,
        amount: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .leftJoin(subcategoriesTable, eq(transactionsTable.subcategory_id, subcategoriesTable.id))
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          dateClause,
          eq(transactionsTable.type, "expense"),
          sql`${transactionsTable.subcategory_id} IS NOT NULL`,
          pc
        )
      )
      .groupBy(subcategoriesTable.name, categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`);

    res.json(
      results
        .filter((r) => r.subcategory)
        .map((r, idx) => ({
          subcategory: r.subcategory as string,
          category: r.category ?? "Uncategorised",
          amount: parseFloat(r.amount ?? "0"),
          color: CHART_COLORS[idx % CHART_COLORS.length],
        }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch subcategory chart" });
  }
});

// ── Budget vs actual ──────────────────────────────────────────────────────────
// FIX: Sum ALL budget entries per category (both category-level and subcategory-level),
// so that users who budget at the subcategory level are correctly represented.
// When start_date/end_date are provided (weekly mode), the budget is still the full monthly
// budget for the month that contains start_date; only actuals are filtered by the date range.

router.get("/dashboard/budget-vs-actual", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const month = (req.query.month as string) || currentMonth();
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const person = req.query.person as string | undefined;
    const pc = personClause(person);

    // For weekly mode: derive the budget month from start_date
    const budgetMonth = startDate
      ? startDate.slice(0, 7) // "YYYY-MM" from "YYYY-MM-DD"
      : month;

    // Actual spending date clause (weekly uses date range; monthly uses month string)
    const dateClause = dateRangeClause(month, startDate, endDate);

    // Fetch all budget entries for this user+month, grouped by category
    // This correctly sums both category-level AND subcategory-level budget entries
    const budgets = await db.execute(sql`
      SELECT
        c.id   AS category_id,
        c.name AS category_name,
        SUM(b.budget_amount) AS budget_amount
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ${userId}
        AND b.month = ${budgetMonth}
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

    if (budgets.rows.length === 0) {
      return res.json([]);
    }

    // Fetch actual expenses, grouped by category, for the selected period
    const actuals = await db
      .select({
        category_id: transactionsTable.category_id,
        actual: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          dateClause,
          eq(transactionsTable.type, "expense"),
          pc
        )
      )
      .groupBy(transactionsTable.category_id);

    const actualMap: Record<number, number> = {};
    for (const row of actuals) {
      if (row.category_id) actualMap[row.category_id] = parseFloat(row.actual ?? "0");
    }

    const chartData = budgets.rows
      .filter((b) => b.category_name)
      .map((b) => {
        const budget = parseFloat(String(b.budget_amount ?? "0"));
        const actual = actualMap[b.category_id as number] ?? 0;
        return {
          category: b.category_name as string,
          budget,
          actual,
          variance: budget - actual,
          is_weekly: !!(startDate && endDate),
        };
      });

    res.json(chartData);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch budget vs actual" });
  }
});

export default router;
