import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetMonthlyChart, useGetTransactionPeople } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  format,
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isAfter,
  startOfDay,
} from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  User,
  Rocket,
  CalendarDays,
  Calendar,
  PlusCircle,
  Target,
  BarChart3,
  Clock,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CHART_COLORS = [
  "#4FC3F7", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#14B8A6", "#F97316", "#84CC16",
];

const ALL_LABEL = "Total";

// ── Month options ─────────────────────────────────────────────────────────────

function generateMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    options.push({ value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") });
  }
  return options;
}
const monthOptions = generateMonthOptions();

// ── Week helpers ──────────────────────────────────────────────────────────────

function getWeekBounds(weekStart: Date) {
  const start = startOfWeek(weekStart, { weekStartsOn: 1 });
  const end = endOfWeek(weekStart, { weekStartsOn: 1 });
  return {
    start,
    end,
    startStr: format(start, "yyyy-MM-dd"),
    endStr: format(end, "yyyy-MM-dd"),
    label: `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`,
  };
}

// ── Budget status helpers ─────────────────────────────────────────────────────

function budgetStatus(actual: number, budget: number): "safe" | "warn" | "danger" | "over" {
  if (budget <= 0) return "safe";
  const pct = actual / budget;
  if (pct > 1) return "over";
  if (pct >= 0.9) return "danger";
  if (pct >= 0.7) return "warn";
  return "safe";
}

const STATUS_COLORS = {
  safe: { row: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  warn: { row: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  danger: { row: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  over: { row: "text-red-600 dark:text-red-400", bg: "bg-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const STATUS_ICONS = {
  safe: CheckCircle2,
  warn: AlertCircle,
  danger: AlertTriangle,
  over: AlertTriangle,
};

// ── API types ─────────────────────────────────────────────────────────────────

interface SummaryData {
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
}

interface BudgetRow {
  category: string;
  budget: number;
  actual: number;
  variance: number;
  is_weekly?: boolean;
}

interface CategoryRow {
  category: string;
  amount: number;
  color: string;
}

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: string;
  category_name: string | null;
  account_name: string | null;
  person: string | null;
}

// ── Period params + query builder ─────────────────────────────────────────────

type PeriodParams =
  | { mode: "monthly"; month: string; person?: string }
  | { mode: "weekly"; startStr: string; endStr: string; person?: string };

function buildQS(params: PeriodParams): string {
  const qs = new URLSearchParams();
  if (params.person) qs.set("person", params.person);
  if (params.mode === "monthly") {
    qs.set("month", params.month);
  } else {
    qs.set("start_date", params.startStr);
    qs.set("end_date", params.endStr);
  }
  return qs.toString();
}

function useDashboardData(params: PeriodParams) {
  const qs = buildQS(params);

  const summary = useQuery<SummaryData>({
    queryKey: ["dashboard/summary", qs],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dashboard/summary?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
  });

  const categoryData = useQuery<CategoryRow[]>({
    queryKey: ["dashboard/category-chart", qs],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dashboard/category-chart?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load category chart");
      return res.json();
    },
  });

  const budgetData = useQuery<BudgetRow[]>({
    queryKey: ["dashboard/budget-vs-actual", qs],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dashboard/budget-vs-actual?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load budget data");
      return res.json();
    },
  });

  return { summary, categoryData, budgetData };
}

// ── Empty placeholder ─────────────────────────────────────────────────────────

function ChartEmpty({ message, icon: Icon = Wallet }: { message: string; icon?: React.ElementType }) {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground gap-2">
      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
        <Icon className="h-6 w-6 opacity-30" />
      </div>
      <p className="text-sm font-medium text-center px-4">{message}</p>
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ data, nameKey, valueKey }: { data: Record<string, string | number>[]; nameKey: string; valueKey: string }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey={valueKey} nameKey={nameKey}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={0} />
            ))}
          </Pie>
          <RechartsTooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} formatter={(v: string) => v.length > 16 ? v.slice(0, 14) + "…" : v} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Person filter ─────────────────────────────────────────────────────────────

function PersonFilter({ people, value, onChange }: { people: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border/50 flex-wrap">
      <User className="h-3.5 w-3.5 text-muted-foreground ml-1.5 flex-shrink-0" />
      {[ALL_LABEL, ...people].map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            value === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ── View mode toggle ──────────────────────────────────────────────────────────

function ViewModeToggle({ value, onChange }: { value: "monthly" | "weekly"; onChange: (v: "monthly" | "weekly") => void }) {
  return (
    <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border/50">
      {(["monthly", "weekly"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            value === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {mode === "monthly" ? <Calendar className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">{label}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, subLabel, icon: Icon, gradient, iconBg, valueClass,
}: {
  label: string; value: string; subLabel?: string;
  icon: React.ElementType; gradient?: string; iconBg: string; valueClass?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden border-border/50 shadow-sm", gradient)}>
      {gradient && <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />}
      <CardContent className="relative pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2", gradient ? "text-white/70" : "text-muted-foreground")}>
              {label}
            </p>
            <p className={cn("text-2xl font-bold leading-tight truncate", valueClass ?? (gradient ? "text-white" : ""))}>
              {value}
            </p>
            {subLabel && (
              <p className={cn("text-xs mt-1", gradient ? "text-white/60" : "text-muted-foreground")}>
                {subLabel}
              </p>
            )}
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3", iconBg)}>
            <Icon className={cn("h-5 w-5", gradient ? "text-white" : "")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = new Date();
  const currentMonthStr = format(today, "yyyy-MM");

  const [viewMode, setViewMode] = useState<"monthly" | "weekly">("monthly");
  const [month, setMonth] = useState(currentMonthStr);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [person, setPerson] = useState<string>(ALL_LABEL);

  const { data: peopleData = [] } = useGetTransactionPeople();
  const { data: monthlyData } = useGetMonthlyChart({ person: person === ALL_LABEL ? undefined : person });

  const personParam = person === ALL_LABEL ? undefined : person;
  const week = useMemo(() => getWeekBounds(weekStart), [weekStart]);

  const periodParams: PeriodParams = viewMode === "monthly"
    ? { mode: "monthly", month, person: personParam }
    : { mode: "weekly", startStr: week.startStr, endStr: week.endStr, person: personParam };

  const { summary, categoryData, budgetData } = useDashboardData(periodParams);

  // Net worth
  const { data: netWorthData } = useQuery<{ net_worth: number; account_count: number }>({
    queryKey: ["dashboard/net-worth"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dashboard/net-worth`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load net worth");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Recent transactions
  const { data: recentTx = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions/recent", personParam],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: "6" });
      if (personParam) qs.set("person", personParam);
      const res = await fetch(`${BASE}/api/transactions?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load transactions");
      return res.json();
    },
  });

  const selectedMonthLabel = monthOptions.find((m) => m.value === month)?.label ?? format(today, "MMMM yyyy");
  const periodLabel = viewMode === "monthly" ? selectedMonthLabel : week.label;

  const netFlow = summary.data?.net_cash_flow ?? 0;
  const totalExpenses = summary.data?.total_expenses ?? 0;
  const totalIncome = summary.data?.total_income ?? 0;

  // Budget remaining: total budget - total actual
  const totalBudget = (budgetData.data ?? []).reduce((s, r) => s + r.budget, 0);
  const totalActual = (budgetData.data ?? []).reduce((s, r) => s + r.actual, 0);
  const budgetRemaining = totalBudget - totalActual;
  const budgetUsedPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const hasBudgets = (budgetData.data?.length ?? 0) > 0;

  const navigateMonth = (dir: "prev" | "next") => {
    const idx = monthOptions.findIndex((m) => m.value === month);
    if (dir === "prev" && idx > 0) setMonth(monthOptions[idx - 1].value);
    if (dir === "next" && idx < monthOptions.length - 1) setMonth(monthOptions[idx + 1].value);
  };

  const navigateWeek = (dir: "prev" | "next") => {
    setWeekStart((prev) => dir === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  const isNextWeekDisabled = isAfter(addWeeks(weekStart, 1), startOfDay(today));
  const isFirstMonth = monthOptions[0]?.value === month;
  const isLastMonth = monthOptions[monthOptions.length - 1]?.value === month;

  // Insight: top category
  const topCategory = (categoryData.data ?? [])[0];
  const totalCategorySpend = (categoryData.data ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-7 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{periodLabel}{person !== ALL_LABEL ? ` · ${person}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Person filter */}
            {peopleData.length > 0 && (
              <PersonFilter people={peopleData} value={person} onChange={setPerson} />
            )}
            {/* View mode toggle */}
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Period navigation */}
        <div className="flex items-center gap-2">
          {viewMode === "monthly" ? (
            <>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth("prev")} disabled={isFirstMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[160px] h-8 bg-card text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth("next")} disabled={isLastMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="h-8 px-4 flex items-center text-sm font-medium bg-card border border-input rounded-md min-w-[200px] justify-center">
                {week.label}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek("next")} disabled={isNextWeekDisabled}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Section 1: Financial Snapshot ──────────────────────────────── */}
      <div>
        <SectionLabel label="Financial Snapshot" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Net Worth */}
          <KpiCard
            label="Net Worth"
            value={netWorthData ? formatCurrency(netWorthData.net_worth) : "—"}
            subLabel={netWorthData ? `${netWorthData.account_count} account${netWorthData.account_count !== 1 ? "s" : ""}` : undefined}
            icon={Landmark}
            iconBg="bg-primary/10"
            valueClass={cn("text-2xl font-bold", (netWorthData?.net_worth ?? 0) >= 0 ? "text-foreground" : "text-red-500")}
          />
          {/* Period spending */}
          <KpiCard
            label={viewMode === "weekly" ? "Weekly Spend" : "Monthly Spend"}
            value={summary.isLoading ? "—" : formatCurrency(totalExpenses)}
            subLabel={viewMode === "weekly" ? week.label.split("–")[0].trim() + " week" : selectedMonthLabel}
            icon={ArrowDownRight}
            iconBg="bg-red-100 dark:bg-red-900/30"
            valueClass="text-2xl font-bold text-red-600 dark:text-red-400"
          />
          {/* Budget remaining */}
          <KpiCard
            label="Budget Remaining"
            value={!hasBudgets ? "No budgets" : formatCurrency(budgetRemaining)}
            subLabel={hasBudgets ? `${budgetUsedPct.toFixed(0)}% used` : "Set budgets to track"}
            icon={BarChart3}
            iconBg={
              !hasBudgets ? "bg-muted" :
              budgetRemaining < 0 ? "bg-red-100 dark:bg-red-900/30" :
              budgetUsedPct >= 90 ? "bg-orange-100 dark:bg-orange-900/30" :
              budgetUsedPct >= 70 ? "bg-amber-100 dark:bg-amber-900/30" :
              "bg-emerald-100 dark:bg-emerald-900/30"
            }
            valueClass={cn(
              "text-2xl font-bold",
              !hasBudgets ? "text-muted-foreground text-base" :
              budgetRemaining < 0 ? "text-red-600 dark:text-red-400" :
              budgetUsedPct >= 90 ? "text-orange-600 dark:text-orange-400" :
              budgetUsedPct >= 70 ? "text-amber-600 dark:text-amber-400" :
              "text-emerald-600 dark:text-emerald-400"
            )}
          />
          {/* Net cash flow */}
          <Card className={cn("relative overflow-hidden border-border/50 shadow-sm", netFlow >= 0 ? "bg-gradient-to-br from-primary to-cyan-500" : "bg-gradient-to-br from-red-500 to-red-600")}>
            <CardContent className="relative pt-5 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Net Cash Flow</p>
                  <p className="text-2xl font-bold text-white leading-tight">
                    {summary.isLoading ? "—" : formatCurrency(netFlow)}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    {formatCurrency(totalIncome)} in · {formatCurrency(totalExpenses)} out
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 ml-3">
                  {netFlow >= 0 ? <TrendingUp className="h-5 w-5 text-white" /> : <TrendingDown className="h-5 w-5 text-white" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── AI Insights ─────────────────────────────────────────────────── */}
      <AiInsightsCard params={periodParams} person={personParam} />

      {/* ── Section 2: Budget vs Actual ────────────────────────────────── */}
      <div>
        <SectionLabel label="Budget vs Actual" />
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold">Budget vs Actual</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {viewMode === "weekly"
                    ? `${week.label} · comparing against monthly budget targets`
                    : `${selectedMonthLabel}${person !== ALL_LABEL ? ` · ${person}` : ""}`}
                </CardDescription>
              </div>
              {viewMode === "weekly" && (
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">Monthly targets</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {budgetData.data && budgetData.data.length > 0 ? (
              <>
                {/* Bar chart */}
                <div className="h-[260px] w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="28%" barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={55} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                      />
                      <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                      <Bar dataKey="budget" name={viewMode === "weekly" ? "Monthly Budget" : "Budget"} fill="hsl(var(--primary))" fillOpacity={0.2} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name={viewMode === "weekly" ? "Weekly Actual" : "Actual"} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Variance table with colour coding */}
                <div className="border border-border/50 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/50">
                        <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Category</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{viewMode === "weekly" ? "Monthly Budget" : "Budget"}</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{viewMode === "weekly" ? "Weekly Actual" : "Actual"}</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Used %</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetData.data.map((row, i) => {
                        const status = budgetStatus(row.actual, row.budget);
                        const sc = STATUS_COLORS[status];
                        const StatusIcon = STATUS_ICONS[status];
                        const pct = row.budget > 0 ? Math.round((row.actual / row.budget) * 100) : 0;
                        return (
                          <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-3 font-medium">{row.category}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(row.budget)}</td>
                            <td className={cn("px-4 py-3 text-right font-semibold", sc.row)}>{formatCurrency(row.actual)}</td>
                            <td className="px-4 py-3 text-right hidden sm:table-cell">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={cn("h-full rounded-full transition-all", sc.bg)} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5", sc.badge)}>
                                <StatusIcon className="h-3 w-3" />
                                {status === "safe" ? "On Track" : status === "warn" ? "Watch" : status === "danger" ? "Near Limit" : "Over"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No budgets set for {viewMode === "weekly" ? "this week's month" : selectedMonthLabel}</p>
                <p className="text-xs mt-1 opacity-70 mb-4">Add budget targets to track your spending.</p>
                <Link href="/budget">
                  <Button variant="outline" size="sm">Set Budgets</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3: Insights ────────────────────────────────────────── */}
      <div>
        <SectionLabel label="Insights" />
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Spending by category */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Spending by Category</CardTitle>
              <CardDescription className="text-xs">{periodLabel}{person !== ALL_LABEL ? ` · ${person}` : ""}</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.data && categoryData.data.length > 0 ? (
                <>
                  {/* Top category insight */}
                  {topCategory && (
                    <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/15 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Top spending category</p>
                        <p className="text-sm font-bold truncate">{topCategory.category} — {formatCurrency(topCategory.amount)}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                        {totalCategorySpend > 0 ? Math.round((topCategory.amount / totalCategorySpend) * 100) : 0}%
                      </Badge>
                    </div>
                  )}
                  {/* Horizontal bars */}
                  <div className="space-y-2.5">
                    {categoryData.data.slice(0, 6).map((d, i) => {
                      const pct = totalCategorySpend > 0 ? (d.amount / totalCategorySpend) * 100 : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium truncate max-w-[55%]">{d.category}</span>
                            <span className="text-muted-foreground font-semibold">{formatCurrency(d.amount)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <ChartEmpty message={`No expenses this ${viewMode === "weekly" ? "week" : "month"}`} icon={BarChart3} />
              )}
            </CardContent>
          </Card>

          {/* Income vs Expenses 12-month trend */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Income vs Expenses</CardTitle>
              <CardDescription className="text-xs">Trailing 12 months{person !== ALL_LABEL ? ` · ${person}` : ""}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        const [y, m] = val.split("-");
                        return format(new Date(parseInt(y), parseInt(m) - 1), "MMM");
                      }}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={45} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                    <Line type="monotone" dataKey="income" name="Income" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Section 4: Recent Transactions ─────────────────────────────── */}
      <div>
        <SectionLabel label="Recent Transactions" />
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Recent Transactions
              </CardTitle>
              <Link href="/transactions">
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary">View all →</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentTx.length === 0 ? (
              <ChartEmpty message="No transactions yet" icon={Wallet} />
            ) : (
              <div className="divide-y divide-border/40">
                {recentTx.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-3">
                    <div className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
                      tx.type === "income" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"
                    )}>
                      {tx.type === "income"
                        ? <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        : <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDate(tx.date)}
                        {tx.category_name ? ` · ${tx.category_name}` : ""}
                        {tx.account_name ? ` · ${tx.account_name}` : ""}
                      </p>
                    </div>
                    {tx.person && (
                      <Badge variant="secondary" className="text-[10px] hidden sm:flex">{tx.person}</Badge>
                    )}
                    <span className={cn("text-sm font-bold flex-shrink-0", tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 5: Savings Goals ────────────────────────────────────── */}
      <ProjectsSummaryCard />

      {/* ── Section 6: Quick Actions ────────────────────────────────────── */}
      <div>
        <SectionLabel label="Quick Actions" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: "/transactions", icon: PlusCircle, label: "Add Transaction", desc: "Record income or expense", color: "text-primary", bg: "bg-primary/10" },
            { href: "/budget", icon: BarChart3, label: "Set a Budget", desc: "Create monthly spending limits", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
            { href: "/projects", icon: Target, label: "New Savings Goal", desc: "Start tracking a financial goal", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
          ].map(({ href, icon: Icon, label, desc, color, bg }) => (
            <Link key={href} href={href}>
              <Card className="border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all cursor-pointer group h-full">
                <CardContent className="pt-5 pb-5">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", bg)}>
                    <Icon className={cn("h-5 w-5", color)} />
                  </div>
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AI Insights card ───────────────────────────────────────────────────────────

interface InsightsResponse {
  insights: string[];
  period: string;
}

function AiInsightsCard({ params, person }: { params: PeriodParams; person?: string }) {
  const [isOpen, setIsOpen] = useState(true);

  // fetchedParams / fetchedPerson are the LOCKED period+person used for the current query.
  // They start equal to the initial values (auto-fetch on mount).
  // They only change when the user explicitly clicks Refresh.
  // Period/person selector changes do NOT update these (no auto-refresh).
  const [fetchedParams, setFetchedParams] = useState<PeriodParams>(params);
  const [fetchedPerson, setFetchedPerson] = useState<string | undefined>(person);
  const [refreshKey, setRefreshKey] = useState(0);

  const buildBody = useCallback((p: PeriodParams, _person?: string): Record<string, string> => {
    const body: Record<string, string> = p.mode === "monthly"
      ? { month: p.month }
      : { start_date: p.startStr, end_date: p.endStr, month: p.startStr.slice(0, 7) };
    if (_person && _person.toLowerCase() !== "total") body.person = _person;
    return body;
  }, []);

  const { data, isLoading, isFetching, isError, error } = useQuery<InsightsResponse>({
    // fetchedParams/fetchedPerson (not live values) in the key → selector changes don't auto-refetch
    queryKey: ["ai/insights", fetchedParams, fetchedPerson, refreshKey],
    queryFn: async () => {
      const body = buildBody(fetchedParams, fetchedPerson);
      const res = await fetch(`${BASE}/api/ai/insights`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        const json = await res.json();
        throw new Error(json.error ?? "Rate limit reached. Try again later.");
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to generate insights.");
      }
      return res.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleOpen = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  const handleRefresh = useCallback(() => {
    // Lock the current live params+person and bump key to force re-fetch
    setFetchedParams(params);
    setFetchedPerson(person);
    setRefreshKey((k) => k + 1);
  }, [params, person]);

  const errMsg = isError
    ? (error instanceof Error ? error.message : "Something went wrong. Please try again.")
    : null;

  return (
    <div>
      <SectionLabel label="AI Insights" />
      <Card className="border-border/50 shadow-sm overflow-hidden">
        {/* Header — always visible */}
        <div
          className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-muted/30 transition-colors"
          onClick={handleOpen}
          role="button"
          aria-expanded={isOpen}
        >
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">AI Financial Insights</p>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Generating insights…" : data ? `${data.insights.length} insights for ${data.period}` : isError ? "Could not load insights" : "Personalised analysis of your finances"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOpen && (data || isError) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
                Refresh
              </Button>
            )}
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
            />
          </div>
        </div>

        {/* Collapsible body */}
        {isOpen && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-border/40">
            {/* Loading skeleton — shown whenever a request is in flight (initial or refresh) */}
            {isFetching && (
              <div className="pt-4 space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-muted flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {isError && !isFetching && (
              <div className="pt-4 flex flex-col items-center gap-3 text-center">
                <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm">{errMsg}</p>
                {!errMsg?.toLowerCase().includes("rate limit") && (
                  <Button variant="outline" size="sm" onClick={handleRefresh} className="text-xs">
                    Try again
                  </Button>
                )}
              </div>
            )}

            {/* Insights list — hidden while fetching to avoid stale-data flash */}
            {data && !isFetching && !isError && (
              <ul className="pt-4 space-y-3">
                {data.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div
                      className="h-5 w-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: ["#4FC3F7", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"][i % 5] }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-sm leading-relaxed">{insight}</p>
                  </li>
                ))}
              </ul>
            )}

            {/* Powered by note */}
            {(data || isLoading) && (
              <p className="mt-4 text-[11px] text-muted-foreground/50 text-right">
                Powered by AI · Based on your actual transaction data only
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ── Savings Goals mini-summary ─────────────────────────────────────────────────

interface DashProject {
  id: number;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
  progress_pct: number;
}

function ProjectsSummaryCard() {
  const { data: projects = [] } = useQuery<DashProject[]>({
    queryKey: ["projects/summary"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/summary`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (projects.length === 0) return null;

  return (
    <div>
      <SectionLabel label="Savings Goals" />
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" /> Savings Goals
            </CardTitle>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary">View all →</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {projects.map((p) => {
              const status = p.progress_pct >= 100 ? "done" : p.progress_pct >= 75 ? "great" : p.progress_pct >= 40 ? "good" : "start";
              const statusLabel = { done: "Complete!", great: "Almost there", good: "On track", start: "Just started" }[status];
              const statusColor = { done: "text-emerald-600", great: "text-primary", good: "text-amber-600", start: "text-muted-foreground" }[status];
              return (
                <div key={p.id} className="rounded-xl border border-border/50 p-3" style={{ background: p.color + "10" }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm" style={{ backgroundColor: p.color + "25" }}>
                      {p.icon}
                    </div>
                    <span className="text-xs font-semibold truncate flex-1">{p.name}</span>
                    <span className={cn("text-[10px] font-bold", statusColor)}>{p.progress_pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(p.progress_pct, 100)}%`, backgroundColor: p.color }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(p.current_amount)}</span>
                    <span className={cn("font-medium", statusColor)}>{statusLabel}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 text-right">of {formatCurrency(p.target_amount)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
