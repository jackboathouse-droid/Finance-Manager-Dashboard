import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  transactionsTable,
  categoriesTable,
  subcategoriesTable,
  budgetsTable,
  accountsTable,
  usersTable,
  userSettingsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { Logger } from "pino";
import {
  sendMail,
  buildBudgetAlertEmail,
  buildWeeklyDigestEmail,
  type WeeklyDigestData,
} from "../lib/mailer";
import { getFrontendBase } from "../lib/google-auth";

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

    // Trigger weekly digest lazily on summary load (non-blocking)
    maybeSendWeeklyDigest(userId, req.log).catch(() => {});
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

    // Fire budget alert email lazily (non-blocking, no weekly mode)
    if (!startDate && !endDate) {
      maybeSendBudgetAlert(userId, budgetMonth, chartData, req.log).catch(() => {});
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch budget vs actual" });
  }
});

// ── Email trigger helpers ─────────────────────────────────────────────────────

/** Fire-and-forget budget alert email if conditions are met */
async function maybeSendBudgetAlert(
  userId: number,
  month: string,
  chartData: Array<{ category: string; budget: number; actual: number }>,
  logger: Logger
): Promise<void> {
  try {
    const [settings] = await db
      .select({
        budget_alerts: userSettingsTable.budget_alerts,
        last_budget_alert_sent: userSettingsTable.last_budget_alert_sent,
      })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.user_id, userId));

    if (!settings?.budget_alerts) return;

    // Throttle: only send once per 24 hours per user
    if (settings.last_budget_alert_sent) {
      const hoursSince =
        (Date.now() - new Date(settings.last_budget_alert_sent).getTime()) / 3_600_000;
      if (hoursSince < 24) return;
    }

    const alerts = chartData
      .filter((r) => r.budget > 0 && r.actual / r.budget >= 0.9)
      .map((r) => ({ category: r.category, budget: r.budget, actual: r.actual, pct: (r.actual / r.budget) * 100 }));

    if (alerts.length === 0) return;

    const [user] = await db
      .select({ email: usersTable.email, full_name: usersTable.full_name })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) return;

    const email = buildBudgetAlertEmail(user.full_name, month, alerts, getFrontendBase());
    const sent = await sendMail({ to: user.email, ...email }, logger);

    if (sent) {
      await db.execute(sql`
        UPDATE user_settings SET last_budget_alert_sent = NOW() WHERE user_id = ${userId}
      `);
    }
  } catch (err) {
    logger.error({ err }, "maybeSendBudgetAlert failed");
  }
}

/** Fire-and-forget weekly digest email if conditions are met */
async function maybeSendWeeklyDigest(
  userId: number,
  logger: Logger
): Promise<void> {
  try {
    const [settings] = await db
      .select({
        weekly_summary: userSettingsTable.weekly_summary,
        last_weekly_digest_sent: userSettingsTable.last_weekly_digest_sent,
      })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.user_id, userId));

    if (!settings?.weekly_summary) return;

    // Throttle: only send if >6 days since last digest
    if (settings.last_weekly_digest_sent) {
      const daysSince =
        (Date.now() - new Date(settings.last_weekly_digest_sent).getTime()) / 86_400_000;
      if (daysSince < 6) return;
    }

    // Previous week: Mon–Sun
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysSinceMonday = (dayOfWeek + 6) % 7; // days since last Mon
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysSinceMonday - 7);
    lastMonday.setHours(0, 0, 0, 0);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    const startStr = lastMonday.toISOString().split("T")[0];
    const endStr = lastSunday.toISOString().split("T")[0];
    const weekLabel = `${lastMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${lastSunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    const results = await db
      .select({
        type: transactionsTable.type,
        total: sql<string>`SUM(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          sql`${transactionsTable.date} >= ${startStr}::date AND ${transactionsTable.date} <= ${endStr}::date`
        )
      )
      .groupBy(transactionsTable.type);

    let totalIncome = 0;
    let totalExpenses = 0;
    for (const r of results) {
      if (r.type === "income") totalIncome = parseFloat(r.total ?? "0");
      else if (r.type === "expense") totalExpenses = Math.abs(parseFloat(r.total ?? "0"));
    }

    // Top category by spending
    const topRows = await db
      .select({
        category: categoriesTable.name,
        amount: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
      })
      .from(transactionsTable)
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .where(
        and(
          eq(transactionsTable.user_id, userId),
          eq(transactionsTable.type, "expense"),
          sql`${transactionsTable.date} >= ${startStr}::date AND ${transactionsTable.date} <= ${endStr}::date`
        )
      )
      .groupBy(categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`)
      .limit(1);

    const digestData: WeeklyDigestData = {
      weekLabel,
      totalIncome,
      totalExpenses,
      netCashFlow: totalIncome - totalExpenses,
      topCategory: topRows[0]?.category ?? null,
      topCategoryAmount: topRows[0] ? parseFloat(topRows[0].amount ?? "0") : 0,
    };

    const [user] = await db
      .select({ email: usersTable.email, full_name: usersTable.full_name })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) return;

    const email = buildWeeklyDigestEmail(user.full_name, digestData, getFrontendBase());
    const sent = await sendMail({ to: user.email, ...email }, logger);

    if (sent) {
      await db.execute(sql`
        UPDATE user_settings SET last_weekly_digest_sent = NOW() WHERE user_id = ${userId}
      `);
    }
  } catch (err) {
    logger.error({ err }, "maybeSendWeeklyDigest failed");
  }
}

// ── Net worth ─────────────────────────────────────────────────────────────────
// Consolidated figure: account balances + manual assets - manual liabilities

router.get("/dashboard/net-worth", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(a.starting_balance::numeric + COALESCE(tx.tx_total, 0)), 0) AS accounts_balance,
        COUNT(a.id) AS account_count
      FROM accounts a
      LEFT JOIN (
        SELECT account_id, SUM(amount) AS tx_total
        FROM transactions
        WHERE user_id = ${userId}
        GROUP BY account_id
      ) tx ON a.id = tx.account_id
      WHERE a.user_id = ${userId}
    `);

    const manualResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'asset' THEN value::numeric ELSE 0 END), 0) AS total_assets,
        COALESCE(SUM(CASE WHEN type = 'liability' THEN value::numeric ELSE 0 END), 0) AS total_liabilities,
        COUNT(*) AS item_count
      FROM manual_assets
      WHERE user_id = ${userId}
    `);

    const row = result.rows[0] ?? { accounts_balance: "0", account_count: "0" };
    const mRow = manualResult.rows[0] ?? { total_assets: "0", total_liabilities: "0", item_count: "0" };

    const accountsBalance = parseFloat(String(row.accounts_balance ?? "0"));
    const totalAssets = parseFloat(String(mRow.total_assets ?? "0"));
    const totalLiabilities = parseFloat(String(mRow.total_liabilities ?? "0"));
    const itemCount = parseInt(String(mRow.item_count ?? "0"));

    res.json({
      net_worth: accountsBalance + totalAssets - totalLiabilities,
      account_count: parseInt(String(row.account_count ?? "0")),
      manual_assets: totalAssets,
      manual_liabilities: totalLiabilities,
      manual_item_count: itemCount,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch net worth" });
  }
});

export default router;
