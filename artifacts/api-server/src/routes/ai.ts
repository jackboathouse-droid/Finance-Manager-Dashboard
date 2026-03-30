import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  transactionsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import OpenAI from "openai";

const router: IRouter = Router();

// ── Lazy OpenAI client — only initialised on first insights request ────────────
// Avoids crashing API startup if env vars are absent (graceful degradation).

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!baseURL || !apiKey) {
      throw new Error("OpenAI integration is not configured. Contact the administrator.");
    }
    _openai = new OpenAI({ apiKey, baseURL });
  }
  return _openai;
}

// ── In-memory rate limiters ────────────────────────────────────────────────────
// Separate maps for insights (10/hour) and categorisation (60/hour).

const insightsRateLimitMap = new Map<number, number[]>();
const categoriseRateLimitMap = new Map<number, number[]>();

function makeRateLimitChecker(map: Map<number, number[]>, maxCalls: number) {
  return function checkRateLimit(userId: number): { allowed: boolean; retryAfterSec?: number } {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;

    const calls = (map.get(userId) ?? []).filter((ts) => now - ts < windowMs);
    if (calls.length >= maxCalls) {
      const oldest = calls[0];
      const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
      return { allowed: false, retryAfterSec };
    }

    calls.push(now);
    map.set(userId, calls);
    return { allowed: true };
  };
}

const checkInsightsRateLimit = makeRateLimitChecker(insightsRateLimitMap, 10);
const checkCategoriseRateLimit = makeRateLimitChecker(categoriseRateLimitMap, 60);

// ── Date range helpers ────────────────────────────────────────────────────────

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

function personClause(person?: string) {
  const trimmed = person?.trim();
  if (!trimmed || trimmed.toLowerCase() === "total") return undefined;
  return sql`LOWER(TRIM(${transactionsTable.person})) = LOWER(TRIM(${trimmed}))`;
}

// ── POST /api/ai/insights ─────────────────────────────────────────────────────

router.post("/ai/insights", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    // Rate limit check
    const rl = checkInsightsRateLimit(userId);
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Rate limit reached. You can refresh insights again in ${Math.ceil((rl.retryAfterSec ?? 3600) / 60)} minutes.`,
        retryAfterSec: rl.retryAfterSec,
      });
    }

    const month = (req.body?.month as string) || currentMonth();
    const startDate = req.body?.start_date as string | undefined;
    const endDate = req.body?.end_date as string | undefined;
    const person = req.body?.person as string | undefined;
    const periodLabel: string = startDate && endDate
      ? `${startDate} to ${endDate}`
      : month;

    const dateClause = dateRangeClause(month, startDate, endDate);
    const pc = personClause(person);
    const budgetMonth = startDate ? startDate.slice(0, 7) : month;

    // ── 1. Summary (income / expenses) ────────────────────────────────────
    const summaryRows = await db
      .select({
        type: transactionsTable.type,
        total: sql<string>`SUM(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.user_id, userId), dateClause, pc))
      .groupBy(transactionsTable.type);

    let totalIncome = 0;
    let totalExpenses = 0;
    for (const row of summaryRows) {
      if (row.type === "income") totalIncome = parseFloat(row.total ?? "0");
      else if (row.type === "expense") totalExpenses = Math.abs(parseFloat(row.total ?? "0"));
    }

    // ── 2. Full actuals by category (all expense categories, not limited) ──
    // Unbounded query so ALL budgeted categories get accurate actuals.
    // Person filter applied so actuals match the currently filtered dashboard view.
    const actualsRows = await db
      .select({
        category_name: categoriesTable.name,
        actual: sql<string>`SUM(ABS(${transactionsTable.amount}))`,
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

    const actualMap: Record<string, number> = {};
    for (const row of actualsRows) {
      if (row.category_name) actualMap[row.category_name] = parseFloat(row.actual ?? "0");
    }

    // Top spending categories (for summary section of prompt)
    const topCategories = actualsRows
      .filter((r) => r.category_name)
      .slice(0, 6)
      .map((r) => ({
        category: r.category_name as string,
        amount: parseFloat(r.actual ?? "0"),
      }));

    // ── 3. Budget vs actual (all budgeted categories with correct actuals) ─
    const budgetRows = await db.execute(sql`
      SELECT c.name AS category_name, SUM(b.budget_amount) AS budget_amount
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ${userId} AND b.month = ${budgetMonth}
      GROUP BY c.name
      ORDER BY c.name
    `);

    const budgetComparison = budgetRows.rows
      .filter((b) => b.category_name)
      .map((b) => {
        const budget = parseFloat(String(b.budget_amount ?? "0"));
        const actual = actualMap[b.category_name as string] ?? 0;
        const pct = budget > 0 ? Math.round((actual / budget) * 100) : null;
        return {
          category: b.category_name as string,
          budget,
          actual,
          pct_used: pct,
          status: budget <= 0 ? "no budget" : actual > budget ? "over" : actual / budget >= 0.9 ? "near limit" : actual / budget >= 0.7 ? "watch" : "on track",
        };
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

    // ── 5. Build prompt payload ────────────────────────────────────────────
    const payload = {
      period: periodLabel,
      net_worth: netWorth,
      income: totalIncome,
      expenses: totalExpenses,
      net_cash_flow: totalIncome - totalExpenses,
      top_spending_categories: topCategories,
      budget_vs_actual: budgetComparison,
    };

    const systemPrompt = `You are a concise, friendly personal finance advisor embedded in the "Bubble" app.
Analyse the user's financial data and return EXACTLY 3 to 5 bullet-point insights.

STRICT RULES:
- Return ONLY a JSON array of strings (e.g. ["Insight one.", "Insight two."]).
- No markdown, no prose, no keys, no text outside the array.
- Each bullet: one sentence, maximum 25 words.
- Every number MUST come directly from the provided data — never invent or estimate figures.
- If a field is 0 or missing, note that fact rather than skipping it.
- Be actionable: where relevant, suggest one concrete next step.
- No markdown bullet characters in the strings, just plain text.
- Tone: clear, encouraging, data-driven. No filler phrases.`;

    const userMessage = `Financial data for ${periodLabel}:\n${JSON.stringify(payload, null, 2)}\n\nReturn 3–5 insight bullets as a JSON array of strings.`;

    // ── 6. Call OpenAI ─────────────────────────────────────────────────────
    let openaiClient: OpenAI;
    try {
      openaiClient = getOpenAI();
    } catch {
      return res.status(503).json({ error: "AI insights are not available right now. Please try again later." });
    }

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? "[]";

    // Parse JSON array — with fallbacks for imperfect model output.
    // Contract: final insights array must have between 3 and 5 items.
    let insights: string[] = [];
    try {
      const parsed = JSON.parse(rawContent);
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
        insights = parsed;
      }
    } catch {
      // Try to extract quoted strings from the raw output
      const matches = rawContent.match(/"([^"]{10,})"/g);
      if (matches) {
        insights = matches.map((m) => m.slice(1, -1));
      }
      // Last resort: split on newlines
      if (insights.length === 0) {
        insights = rawContent
          .split("\n")
          .map((l) => l.replace(/^[-•*\d.]\s*/, "").trim())
          .filter((l) => l.length > 10);
      }
    }

    // Enforce 3–5 item contract: trim above 5, pad below 3 with generic prompts
    insights = insights.slice(0, 5);
    const padding = [
      "Add more transactions to get richer insights for this period.",
      "Track your spending categories to unlock personalised recommendations.",
      "Set up budgets to see how your actuals compare each month.",
    ];
    while (insights.length < 3) {
      insights.push(padding[insights.length] ?? "Keep tracking your finances for better insights.");
    }

    res.json({ insights, period: periodLabel });
  } catch (err: unknown) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate insights. Please try again later." });
  }
});

// ── POST /api/ai/categorise ───────────────────────────────────────────────────
// Suggests the best category for a transaction given description + amount + type.
// Returns { category_id, category_name, confidence } or null on failure/unavailability.

router.post("/ai/categorise", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const rl = checkCategoriseRateLimit(userId);
    if (!rl.allowed) {
      return res.status(429).json({ error: "Rate limit reached.", retryAfterSec: rl.retryAfterSec });
    }

    const { description, amount, type } = req.body as {
      description?: string;
      amount?: number;
      type?: string;
    };

    if (!description || description.trim().length < 2) {
      return res.json(null);
    }

    // Fetch the user's categories (scoped to transaction type if provided)
    const userCategories = await db
      .select({ id: categoriesTable.id, name: categoriesTable.name, type: categoriesTable.type })
      .from(categoriesTable)
      .where(
        type && type !== "transfer"
          ? and(eq(categoriesTable.user_id, userId), eq(categoriesTable.type, type))
          : eq(categoriesTable.user_id, userId)
      );

    if (userCategories.length === 0) return res.json(null);

    // Build a numbered list of categories for the prompt
    const categoryList = userCategories
      .map((c) => `${c.id}: ${c.name}`)
      .join("\n");

    const systemPrompt = `You are a personal finance categorisation engine.
Given a transaction description and optional amount, pick the SINGLE best matching category from the list.
Respond with ONLY a valid JSON object: {"category_id": <number>, "confidence": <"high"|"medium"|"low">}
No explanations, no markdown, no extra text.`;

    const userMessage = `Transaction: "${description.trim()}"${amount !== undefined ? ` | Amount: $${Math.abs(amount)}` : ""}${type ? ` | Type: ${type}` : ""}

Categories:
${categoryList}

Return the best match as JSON.`;

    let openaiClient: OpenAI;
    try {
      openaiClient = getOpenAI();
    } catch {
      return res.json(null);
    }

    let rawContent = "";
    try {
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 64,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });
      rawContent = completion.choices[0]?.message?.content?.trim() ?? "";
    } catch {
      return res.json(null);
    }

    // Parse response
    let parsed: { category_id?: number; confidence?: string } = {};
    try {
      // Strip markdown code fences if present
      const clean = rawContent.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.json(null);
    }

    if (!parsed.category_id || typeof parsed.category_id !== "number") return res.json(null);

    const matched = userCategories.find((c) => c.id === parsed.category_id);
    if (!matched) return res.json(null);

    return res.json({
      category_id: matched.id,
      category_name: matched.name,
      confidence: parsed.confidence ?? "medium",
    });
  } catch (err) {
    req.log.error(err);
    return res.json(null);
  }
});

export default router;
