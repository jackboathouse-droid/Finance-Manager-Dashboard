import { useState } from "react";
import {
  useGetDashboardSummary,
  useGetMonthlyChart,
  useGetCategoryChart,
  useGetSubcategoryChart,
  useGetBudgetVsActual,
  useGetTransactionPeople,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format, subMonths } from "date-fns";
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
    <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1 border border-border/50">
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);
  const [person, setPerson] = useState<string>(ALL_LABEL);

  // Fetch distinct person names from the database to drive the filter buttons
  const { data: peopleData = [] } = useGetTransactionPeople();

  // When a person is selected, reset to ALL_LABEL if they disappear from the list
  // Normalise — when "Total" pass undefined so the backend returns all
  const personParam =
    person === ALL_LABEL ? undefined : person || undefined;

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    month,
    person: personParam,
  });
  const { data: monthlyData } = useGetMonthlyChart({ person: personParam });
  const { data: categoryData } = useGetCategoryChart({ month, person: personParam });
  const { data: subcategoryData } = useGetSubcategoryChart({ month, person: personParam });
  const { data: budgetData } = useGetBudgetVsActual({ month, person: personParam });

  const selectedMonthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? format(new Date(), "MMMM yyyy");

  const netFlow = summary?.net_cash_flow ?? 0;
  const isPositive = netFlow >= 0;

  const navigateMonth = (dir: "prev" | "next") => {
    const idx = monthOptions.findIndex((m) => m.value === month);
    if (dir === "prev" && idx > 0) setMonth(monthOptions[idx - 1].value);
    if (dir === "next" && idx < monthOptions.length - 1) setMonth(monthOptions[idx + 1].value);
  };

  // Map subcategory data to nameKey expected by DonutChart
  const subcategoryChartData = (subcategoryData ?? []).map((d) => ({
    name: d.subcategory,
    category: d.category,
    amount: d.amount,
    color: d.color,
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your financial overview</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Person filter — driven by distinct person values in the database */}
          <PersonFilter people={peopleData} value={person} onChange={setPerson} />

          {/* Month picker */}
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
                  Total Income
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {loadingSummary ? "—" : formatCurrency(summary?.total_income ?? 0)}
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
                  Total Expenses
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {loadingSummary ? "—" : formatCurrency(summary?.total_expenses ?? 0)}
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
              : "bg-gradient-to-br from-slate-700 to-slate-800"
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
                  {selectedMonthLabel}
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

      {/* ── Income vs Expenses line chart ───────────────────────────────── */}
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
              {selectedMonthLabel}{person !== ALL_LABEL ? ` · ${person}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData && categoryData.length > 0 ? (
              <DonutChart
                data={categoryData.map((d) => ({ ...d, name: d.category }))}
                nameKey="name"
                valueKey="amount"
              />
            ) : (
              <ChartEmpty message="No expenses this month" />
            )}
          </CardContent>
        </Card>

        {/* Subcategory donut */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Spending by Subcategory</CardTitle>
            <CardDescription className="text-xs">
              {selectedMonthLabel}{person !== ALL_LABEL ? ` · ${person}` : ""}
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
              <ChartEmpty message="No subcategory data this month" />
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
                {selectedMonthLabel}{person !== ALL_LABEL ? ` · ${person}` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {budgetData && budgetData.length > 0 ? (
            <>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={budgetData}
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
                      name="Budget"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="actual"
                      name="Actual"
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
                        Budget
                      </th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Actual
                      </th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Variance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetData.map((row, i) => {
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
              <p className="text-sm font-medium">No budgets set for {selectedMonthLabel}</p>
              <p className="text-xs mt-1 opacity-70">
                Go to the Budget page to add budget targets.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
