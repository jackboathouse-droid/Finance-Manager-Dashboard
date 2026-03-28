import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  transactionsTable,
  categoriesTable,
  budgetsTable,
  accountsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// ── In-memory rate limiter: max 10 calls per user per hour ────────────────────

const rateLimitMap = new Map<number, number[]>();

function checkRateLimit(userId: number): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxCalls = 10;

  const calls = (rateLimitMap.get(userId) ?? []).filter((ts) => now - ts < windowMs);
  if (calls.length >= maxCalls) {
    const oldest = calls[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  calls.push(now);
  rateLimitMap.set(userId, calls);
  return { allowed: true };
}

// ── Helpers (mirror dashboard.ts) ────────────────────────────────────────────

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dateRangeClause(month: string, startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return sql`${transactionsTable.date} >= ${startDate}::date AND ${transactionsTable.date} <= ${endDate}::date`;
  }
  return sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`;
}

// ── POST /api/ai/insights ─────────────────────────────────────────────────────

router.post("/ai/insights", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    // Rate limit
    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Rate limit reached. You can refresh insights again in ${Math.ceil((rl.retryAfterSec ?? 3600) / 60)} minutes.`,
        retryAfterSec: rl.retryAfterSec,
      });
    }

    const month = (req.body?.month as string) || currentMonth();
    const startDate = req.body?.start_date as string | undefined;
    const endDate = req.body?.end_date as string | undefined;
    const periodLabel: string = startDate && endDate
      ? `${startDate} to ${endDate}`
      : month;

    const dateClause = dateRangeClause(month, startDate, endDate);
    const budgetMonth = startDate ? startDate.slice(0, 7) : month;

    // ── 1. Summary (income / expenses) ────────────────────────────────────
    const summaryRows = await db
      .select({
        type: transactionsTable.type,
        total: sql<string>`SUM(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.user_id, userId), dateClause))
      .groupBy(transactionsTable.type);

    let totalIncome = 0;
    let totalExpenses = 0;
    for (const row of summaryRows) {
      if (row.type === "income") totalIncome = parseFloat(row.total ?? "0");
      else if (row.type === "expense") totalExpenses = Math.abs(parseFloat(row.total ?? "0"));
    }
    const netCashFlow = totalIncome - totalExpenses;

    // ── 2. Top spending categories ─────────────────────────────────────────
    const categoryRows = await db
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
          eq(transactionsTable.type, "expense")
        )
      )
      .groupBy(categoriesTable.name)
      .orderBy(sql`SUM(ABS(${transactionsTable.amount})) DESC`)
      .limit(8);

    const topCategories = categoryRows
      .filter((r) => r.category)
      .map((r) => ({
        category: r.category as string,
        amount: parseFloat(r.amount ?? "0"),
      }));

    // ── 3. Budget vs actual ────────────────────────────────────────────────
    const budgetRows = await db.execute(sql`
      SELECT c.name AS category_name, SUM(b.budget_amount) AS budget_amount
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ${userId} AND b.month = ${budgetMonth}
      GROUP BY c.name
      ORDER BY c.name
    `);

    const actualMap: Record<string, number> = {};
    for (const cat of topCategories) actualMap[cat.category] = cat.amount;

    const budgetComparison = budgetRows.rows
      .filter((b) => b.category_name)
      .map((b) => {
        const budget = parseFloat(String(b.budget_amount ?? "0"));
        const actual = actualMap[b.category_name as string] ?? 0;
        const pct = budget > 0 ? Math.round((actual / budget) * 100) : null;
        return { category: b.category_name as string, budget, actual, pct_used: pct };
      });

    // ── 4. Net worth ───────────────────────────────────────────────────────
    const nwResult = await db.execute(sql`
      SELECT COALESCE(SUM(a.starting_balance::numeric + COALESCE(tx.tx_total, 0)), 0) AS net_worth
      FROM accounts a
      LEFT JOIN (
        SELECT account_id, SUM(amount) AS tx_total
        FROM transactions WHERE user_id = ${userId}
        GROUP BY account_id
      ) tx ON a.id = tx.account_id
      WHERE a.user_id = ${userId}
    `);
    const netWorth = parseFloat(String(nwResult.rows[0]?.net_worth ?? "0"));

    // ── 5. Transaction count ───────────────────────────────────────────────
    const txCountResult = await db.execute(sql`
      SELECT COUNT(*) AS tx_count FROM transactions
      WHERE user_id = ${userId} AND ${dateClause}
    `);
    const txCount = parseInt(String(txCountResult.rows[0]?.tx_count ?? "0"));

    // ── 6. Build prompt payload ────────────────────────────────────────────
    const payload = {
      period: periodLabel,
      net_worth: netWorth,
      income: totalIncome,
      expenses: totalExpenses,
      net_cash_flow: netCashFlow,
      transaction_count: txCount,
      top_spending_categories: topCategories.slice(0, 6),
      budget_vs_actual: budgetComparison,
    };

    const systemPrompt = `You are a concise, friendly personal finance advisor embedded in the "Bubble" personal finance app. 
Your job is to analyse the user's financial data for a specific period and return EXACTLY 3 to 5 bullet-point insights.

STRICT RULES:
- Return ONLY a JSON array of strings, each string being one insight bullet (no markdown, no prose, no keys, no explanation outside the array).
- Each bullet must be a single sentence, maximum 25 words.
- Every number you mention MUST come directly from the data provided — do NOT invent, estimate, or round figures beyond what is given.
- If a data field is 0 or empty (e.g. no budget set, no income), note that fact concisely rather than skipping it.
- Be actionable: where relevant, suggest one concrete next step (e.g. "consider setting a budget for X", "you are on track for Y").
- Do NOT use markdown bullet characters, just plain text strings in the JSON array.
- Do NOT add a trailing period to insights that already end with a value or percentage.
- Tone: clear, encouraging, data-driven. No fluff, no filler phrases like "Great job!" or "Keep it up!".

Example output format (do not copy content, only the format):
["Insight one here.", "Insight two here.", "Insight three here."]`;

    const userMessage = `Here is my financial data for the period ${periodLabel}:\n${JSON.stringify(payload, null, 2)}\n\nPlease return 3–5 actionable insight bullets as a JSON array of strings.`;

    // ── 7. Call OpenAI ─────────────────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? "[]";

    // Parse and validate the JSON array of strings
    let insights: string[] = [];
    try {
      const parsed = JSON.parse(rawContent);
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
        insights = parsed.slice(0, 5);
      } else {
        // Fallback: extract quoted strings from the response
        const matches = rawContent.match(/"([^"]+)"/g);
        if (matches) {
          insights = matches.map((m) => m.replace(/^"|"$/g, "")).slice(0, 5);
        }
      }
    } catch {
      // Last resort: split on newlines and clean up
      insights = rawContent
        .split("\n")
        .map((l) => l.replace(/^[-•*\d.]\s*/, "").trim())
        .filter((l) => l.length > 10)
        .slice(0, 5);
    }

    if (insights.length === 0) {
      insights = ["No insights could be generated for this period. Try adding more transactions."];
    }

    res.json({ insights, period: periodLabel });
  } catch (err: unknown) {
    req.log.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to generate insights. Please try again later.", detail: message });
  }
});

export default router;
