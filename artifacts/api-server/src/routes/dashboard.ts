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

/** Build an optional person filter clause — case-insensitive, whitespace-trimmed */
function personClause(person?: string) {
  const trimmed = person?.trim();
  if (!trimmed || trimmed.toLowerCase() === "total") return undefined;
  return sql`LOWER(TRIM(${transactionsTable.person})) = LOWER(TRIM(${trimmed}))`;
}

// ── Summary ───────────────────────────────────────────────────────────────────

router.get("/dashboard/summary", async (req, res) => {
  try {
    const month = (req.query.month as string) || currentMonth();
    const person = req.query.person as string | undefined;
    const pc = personClause(person);

    const results = await db
      .select({
        type: transactionsTable.type,
        total: sql<string>`SUM(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(
        and(
          sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`,
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

    res.json({
      total_income,
      total_expenses,
      net_cash_flow: total_income - total_expenses,
      month,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

// ── Monthly chart ─────────────────────────────────────────────────────────────

router.get("/dashboard/monthly-chart", async (req, res) => {
  try {
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
      if (!monthMap[row.month]) {
        monthMap[row.month] = { income: 0, expenses: 0 };
      }
      if (row.type === "income") {
        monthMap[row.month].income = parseFloat(row.total ?? "0");
      } else if (row.type === "expense") {
        monthMap[row.month].expenses = Math.abs(parseFloat(row.total ?? "0"));
      }
    }

    const chartData = Object.entries(monthMap).map(([month, values]) => ({
      month,
      ...values,
    }));

    res.json(chartData);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch monthly chart" });
  }
});

// ── Category chart ────────────────────────────────────────────────────────────

router.get("/dashboard/category-chart", async (req, res) => {
  try {
    const month = (req.query.month as string) || currentMonth();
    const person = req.query.person as string | undefined;
    const pc = personClause(person);

    const results = await db
      .select({
        category: categoriesTable.name,
        amount: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .where(
        and(
          sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`,
          eq(transactionsTable.type, "expense"),
          pc
        )
      )
      .groupBy(categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`);

    const chartData = results
      .filter((r) => r.category)
      .map((r, idx) => ({
        category: r.category as string,
        amount: parseFloat(r.amount ?? "0"),
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }));

    res.json(chartData);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch category chart" });
  }
});

// ── Subcategory chart ─────────────────────────────────────────────────────────

router.get("/dashboard/subcategory-chart", async (req, res) => {
  try {
    const month = (req.query.month as string) || currentMonth();
    const person = req.query.person as string | undefined;
    const pc = personClause(person);

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
          sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`,
          eq(transactionsTable.type, "expense"),
          sql`${transactionsTable.subcategory_id} IS NOT NULL`,
          pc
        )
      )
      .groupBy(subcategoriesTable.name, categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`);

    const chartData = results
      .filter((r) => r.subcategory)
      .map((r, idx) => ({
        subcategory: r.subcategory as string,
        category: r.category ?? "Uncategorised",
        amount: parseFloat(r.amount ?? "0"),
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }));

    res.json(chartData);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch subcategory chart" });
  }
});

// ── Budget vs actual ──────────────────────────────────────────────────────────

router.get("/dashboard/budget-vs-actual", async (req, res) => {
  try {
    const month = (req.query.month as string) || currentMonth();
    const person = req.query.person as string | undefined;
    const pc = personClause(person);

    const budgets = await db
      .select({
        category_id: budgetsTable.category_id,
        category_name: categoriesTable.name,
        budget_amount: budgetsTable.budget_amount,
      })
      .from(budgetsTable)
      .leftJoin(categoriesTable, eq(budgetsTable.category_id, categoriesTable.id))
      .where(
        and(
          eq(budgetsTable.month, month),
          sql`${budgetsTable.subcategory_id} IS NULL`
        )
      );

    const actuals = await db
      .select({
        category_id: transactionsTable.category_id,
        actual: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .where(
        and(
          sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`,
          eq(transactionsTable.type, "expense"),
          pc
        )
      )
      .groupBy(transactionsTable.category_id);

    const actualMap: Record<number, number> = {};
    for (const row of actuals) {
      if (row.category_id) {
        actualMap[row.category_id] = parseFloat(row.actual ?? "0");
      }
    }

    const chartData = budgets
      .filter((b) => b.category_name)
      .map((b) => {
        const budget = parseFloat(b.budget_amount ?? "0");
        const actual = actualMap[b.category_id] ?? 0;
        return {
          category: b.category_name as string,
          budget,
          actual,
          variance: budget - actual,
        };
      });

    res.json(chartData);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch budget vs actual" });
  }
});

export default router;
