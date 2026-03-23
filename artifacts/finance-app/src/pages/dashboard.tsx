import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetMonthlyChart,
  useGetTransactionPeople,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

const ALL_LABEL = "Total";

function generateMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    options.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy"),
    });
  }
  return options;
}

const monthOptions = generateMonthOptions();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekBounds(weekStart: Date) {
  const start = startOfWeek(weekStart, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(weekStart, { weekStartsOn: 1 });     // Sunday
  return {
    start,
    end,
    startStr: format(start, "yyyy-MM-dd"),
    endStr: format(end, "yyyy-MM-dd"),
    label: `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`,
  };
}

// ── Empty state placeholder ───────────────────────────────────────────────────

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground gap-2">
      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
        <Wallet className="h-6 w-6 opacity-30" />
      </div>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// ── Shared donut chart ────────────────────────────────────────────────────────

function DonutChart({
  data,
  nameKey,
  valueKey,
}: {
  data: Array<Record<string, string | number>>;
  nameKey: string;
  valueKey: string;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
            dataKey={valueKey}
            nameKey={nameKey}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={0}
              />
            ))}
          </Pie>
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            formatter={(value: string) =>
              value.length > 18 ? value.slice(0, 16) + "…" : value
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Person filter pill ────────────────────────────────────────────────────────

function PersonFilter({
  people,
  value,
  onChange,
}: {
  people: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [ALL_LABEL, ...people];
  return (
    <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1 border border-border/50 flex-wrap">
      <User className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
      {options.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
            value === p
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ── View mode toggle ──────────────────────────────────────────────────────────

function ViewModeToggle({
  value,
  onChange,
}: {
  value: "monthly" | "weekly";
  onChange: (v: "monthly" | "weekly") => void;
}) {
  return (
    <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border/50">
      {(["monthly", "weekly"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
            value === mode
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {mode === "monthly" ? (
            <Calendar className="h-3 w-3" />
          ) : (
            <CalendarDays className="h-3 w-3" />
          )}
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ── Custom hook — period-aware dashboard data ─────────────────────────────────

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

  const summary = useQuery({
    queryKey: ["dashboard/summary", qs],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dashboard/summary?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json() as Promise<{ total_income: number; total_expenses: number; net_cash_flow: number }>;
    },
  });

  const categoryData = useQuery({
    queryKey: ["dashboard/category-chart", qs],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dashboard/category-chart?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load category chart");
      return res.json() as Promise<Array<{ category: string; amount: number; color: string }>>;
    },
  });

  const subcategoryData = useQuery({
    queryKey: ["dashboard/subcategory-chart", qs],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dashboard/subcategory-chart?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subcategory chart");
      return res.json() as Promise<Array<{ subcategory: string; category: string; amount: number; color: string }>>;
    },
  });

  const budgetData = useQuery({
    queryKey: ["dashboard/budget-vs-actual", qs],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dashboard/budget-vs-actual?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load budget data");
      return res.json() as Promise<Array<{ category: string; budget: number; actual: number; variance: number; is_weekly?: boolean }>>;
    },
  });

  return { summary, categoryData, subcategoryData, budgetData };
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
  const { data: monthlyData } = useGetMonthlyChart({
    person: person === ALL_LABEL ? undefined : person,
  });

  const personParam = person === ALL_LABEL ? undefined : person;
  const week = useMemo(() => getWeekBounds(weekStart), [weekStart]);

  const periodParams: PeriodParams =
    viewMode === "monthly"
      ? { mode: "monthly", month, person: personParam }
      : { mode: "weekly", startStr: week.startStr, endStr: week.endStr, person: personParam };

  const { summary, categoryData, subcategoryData, budgetData } = useDashboardData(periodParams);

  const selectedMonthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? format(today, "MMMM yyyy");
  const periodLabel = viewMode === "monthly" ? selectedMonthLabel : week.label;

  const netFlow = summary.data?.net_cash_flow ?? 0;
  const isPositive = netFlow >= 0;

  const navigateMonth = (dir: "prev" | "next") => {
    const idx = monthOptions.findIndex((m) => m.value === month);
    if (dir === "prev" && idx > 0) setMonth(monthOptions[idx - 1].value);
    if (dir === "next" && idx < monthOptions.length - 1) setMonth(monthOptions[idx + 1].value);
  };

  const navigateWeek = (dir: "prev" | "next") => {
    setWeekStart((prev) =>
      dir === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const isNextWeekDisabled = isAfter(addWeeks(weekStart, 1), startOfDay(today));

  const subcategoryChartData = (subcategoryData.data ?? []).map((d) => ({
    name: d.subcategory,
    category: d.category,
    amount: d.amount,
    color: d.color,
  }));

  const loadingSummary = summary.isLoading;

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your financial overview</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          {/* Person filter */}
          <PersonFilter people={peopleData} value={person} onChange={setPerson} />

          {/* View mode toggle */}
          <ViewModeToggle value={viewMode} onChange={(v) => setViewMode(v)} />

          {/* Period navigation */}
          {viewMode === "monthly" ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => navigateMonth("prev")}
                disabled={monthOptions[0]?.value === month}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[160px] h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => navigateMonth("next")}
                disabled={monthOptions[monthOptions.length - 1]?.value === month}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => navigateWeek("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="h-9 px-3 flex items-center text-sm font-medium bg-card border border-input rounded-md min-w-[190px] justify-center">
                {week.label}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => navigateWeek("next")}
                disabled={isNextWeekDisabled}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Income */}
        <Card className="relative overflow-hidden border-border/50 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/20" />
          <CardContent className="relative pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {viewMode === "weekly" ? "Weekly Income" : "Total Income"}
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {loadingSummary ? "—" : formatCurrency(summary.data?.total_income ?? 0)}
                </p>
                {person !== ALL_LABEL && (
                  <p className="text-xs text-muted-foreground mt-1">{person} only</p>
                )}
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="relative overflow-hidden border-border/50 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-red-50/60 to-transparent dark:from-red-950/20" />
          <CardContent className="relative pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {viewMode === "weekly" ? "Weekly Expenses" : "Total Expenses"}
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {loadingSummary ? "—" : formatCurrency(summary.data?.total_expenses ?? 0)}
                </p>
                {person !== ALL_LABEL && (
                  <p className="text-xs text-muted-foreground mt-1">{person} only</p>
                )}
              </div>
              <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <ArrowDownRight className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net */}
        <Card
          className={cn(
            "relative overflow-hidden border-border/50 shadow-sm",
            isPositive
              ? "bg-gradient-to-br from-primary to-cyan-500"
              : "bg-gradient-to-br from-red-500 to-red-600"
          )}
        >
          <CardContent className="relative pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                  Net Cash Flow
                </p>
                <p className="text-2xl font-bold text-white">
                  {loadingSummary ? "—" : formatCurrency(netFlow)}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {periodLabel}
                  {person !== ALL_LABEL ? ` · ${person}` : ""}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                {isPositive ? (
                  <TrendingUp className="h-5 w-5 text-white" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-white" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Income vs Expenses line chart (always trailing 12 months) ──── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Income vs Expenses</CardTitle>
              <CardDescription className="text-xs">
                Trailing 12 months{person !== ALL_LABEL ? ` · ${person}` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData}
                margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
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
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                  width={45}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name.charAt(0).toUpperCase() + name.slice(1),
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Category + Subcategory charts side-by-side ──────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Category donut */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Spending by Category</CardTitle>
            <CardDescription className="text-xs">
              {periodLabel}{person !== ALL_LABEL ? ` · ${person}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.data && categoryData.data.length > 0 ? (
              <DonutChart
                data={categoryData.data.map((d) => ({ ...d, name: d.category }))}
                nameKey="name"
                valueKey="amount"
              />
            ) : (
              <ChartEmpty message={`No expenses this ${viewMode === "weekly" ? "week" : "month"}`} />
            )}
          </CardContent>
        </Card>

        {/* Subcategory donut */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Spending by Subcategory</CardTitle>
            <CardDescription className="text-xs">
              {periodLabel}{person !== ALL_LABEL ? ` · ${person}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subcategoryChartData.length > 0 ? (
              <DonutChart
                data={subcategoryChartData}
                nameKey="name"
                valueKey="amount"
              />
            ) : (
              <ChartEmpty message={`No subcategory data this ${viewMode === "weekly" ? "week" : "month"}`} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Budget vs Actual ────────────────────────────────────────────── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Budget vs Actual</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {viewMode === "weekly"
                  ? `${week.label} · Monthly budget targets`
                  : `${selectedMonthLabel}${person !== ALL_LABEL ? ` · ${person}` : ""}`}
              </CardDescription>
            </div>
            {viewMode === "weekly" && (
              <span className="text-[10px] text-muted-foreground bg-muted/60 border border-border/40 rounded-md px-2 py-1">
                Budget = monthly target
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {budgetData.data && budgetData.data.length > 0 ? (
            <>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={budgetData.data}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    barCategoryGap="30%"
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="category"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `$${val}`}
                      width={55}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    />
                    <Legend
                      iconType="square"
                      iconSize={10}
                      wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                    />
                    <Bar
                      dataKey="budget"
                      name={viewMode === "weekly" ? "Monthly Budget" : "Budget"}
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="actual"
                      name={viewMode === "weekly" ? "Weekly Actual" : "Actual"}
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Variance table */}
              <div className="mt-4 border border-border/50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/50">
                      <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Category
                      </th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        {viewMode === "weekly" ? "Monthly Budget" : "Budget"}
                      </th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        {viewMode === "weekly" ? "Weekly Actual" : "Actual"}
                      </th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Variance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetData.data.map((row, i) => {
                      const under = row.variance >= 0;
                      return (
                        <tr
                          key={i}
                          className="border-b border-border/30 last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-4 py-2.5 font-medium">{row.category}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">
                            {formatCurrency(row.budget)}
                          </td>
                          <td className="px-4 py-2.5 text-right">{formatCurrency(row.actual)}</td>
                          <td
                            className={cn(
                              "px-4 py-2.5 text-right font-semibold",
                              under ? "text-emerald-600" : "text-red-500"
                            )}
                          >
                            {under ? "+" : ""}
                            {formatCurrency(row.variance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <Wallet className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">
                No budgets set for {viewMode === "weekly" ? week.label.split("–")[0].trim() + "'s month" : selectedMonthLabel}
              </p>
              <p className="text-xs mt-1 opacity-70">
                Go to the Budget page to add budget targets.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Savings Goals summary ──────────────────────────────────────────── */}
      <ProjectsSummaryCard />
    </div>
  );
}

// ── Savings Goals mini-card for dashboard ─────────────────────────────────────

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
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              Savings Goals
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Active goals progress</CardDescription>
          </div>
          <a
            href="/projects"
            className="text-xs text-primary font-medium hover:underline underline-offset-4"
          >
            View all →
          </a>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-border/50 p-3"
              style={{ background: p.color + "10" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: p.color + "25" }}
                >
                  <span className="text-xs" style={{ color: p.color }}>
                    {p.progress_pct}%
                  </span>
                </div>
                <span className="text-xs font-semibold truncate">{p.name}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${p.progress_pct}%`, backgroundColor: p.color }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(p.current_amount)}</span>
                <span>{formatCurrency(p.target_amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
