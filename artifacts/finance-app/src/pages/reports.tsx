import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetAccounts,
  useGetCategories,
  useGetTransactionPeople,
} from "@workspace/api-client-react";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  TrendingUp,
  TrendingDown,
  Wallet,
  Search,
  User,
  Building2,
  CreditCard,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#4FC3F7", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#14B8A6", "#F97316", "#84CC16",
];

const ALL = "all";
const ALL_LABEL = "Total";

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfitLossData {
  total_income: number;
  total_expenses: number;
  net_profit: number;
  monthly: { month: string; income: number; expenses: number }[];
  by_category: { category: string; amount: number; color: string }[];
}

interface BalanceSheetData {
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  assets: { account: string; type: string; balance: number }[];
  liabilities: { account: string; type: string; balance: number }[];
}

interface SpendingData {
  by_category: { category: string; amount: number; color: string }[];
  by_subcategory: { subcategory: string; category: string; amount: number; color: string }[];
}

interface ReportTransaction {
  id: number;
  date: string;
  description: string;
  account_name: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  amount: number;
  type: string;
  person: string | null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon: Icon,
  positive,
  neutral,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  positive?: boolean;
  neutral?: boolean;
}) {
  const isGood = neutral ? null : positive ? value >= 0 : value <= 0;

  return (
    <Card className="flex-1">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p
          className={cn(
            "text-2xl font-bold",
            neutral
              ? "text-foreground"
              : isGood
              ? "text-emerald-500"
              : "text-red-500"
          )}
        >
          {formatCurrency(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartEmpty() {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground gap-2">
      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
        <Wallet className="h-6 w-6 opacity-30" />
      </div>
      <p className="text-sm font-medium">No data for selected filters</p>
    </div>
  );
}

function PersonFilter({
  people,
  value,
  onChange,
}: {
  people: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1 border border-border/50">
      <User className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
      {[ALL_LABEL, ...people].map((p) => (
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(sixMonthsAgo);
  const [endDate, setEndDate] = useState(today);
  const [categoryId, setCategoryId] = useState(ALL);
  const [accountId, setAccountId] = useState(ALL);
  const [person, setPerson] = useState(ALL_LABEL);
  const [search, setSearch] = useState("");

  const { data: accounts = [] } = useGetAccounts();
  const { data: categories = [] } = useGetCategories();
  const { data: peopleData = [] } = useGetTransactionPeople();

  const personParam = person === ALL_LABEL ? undefined : person;
  const categoryParam = categoryId !== ALL ? categoryId : undefined;
  const accountParam = accountId !== ALL ? accountId : undefined;

  const filterParams = {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    category_id: categoryParam,
    account_id: accountParam,
    person: personParam,
  };

  const { data: plData, isLoading: plLoading } = useQuery<ProfitLossData>({
    queryKey: ["reports/profit-loss", filterParams],
    queryFn: () => apiFetch<ProfitLossData>("/api/reports/profit-loss", filterParams),
  });

  const { data: bsData, isLoading: bsLoading } = useQuery<BalanceSheetData>({
    queryKey: ["reports/balance-sheet", { person: personParam }],
    queryFn: () => apiFetch<BalanceSheetData>("/api/reports/balance-sheet", { person: personParam }),
  });

  const { data: spData, isLoading: spLoading } = useQuery<SpendingData>({
    queryKey: ["reports/spending", filterParams],
    queryFn: () => apiFetch<SpendingData>("/api/reports/spending", filterParams),
  });

  const { data: txData = [], isLoading: txLoading } = useQuery<ReportTransaction[]>({
    queryKey: ["reports/transactions", filterParams],
    queryFn: () => apiFetch<ReportTransaction[]>("/api/reports/transactions", filterParams),
  });

  // Apply global search to the transactions table
  const filteredTx = useMemo(() => {
    if (!search.trim()) return txData;
    const q = search.toLowerCase();
    return txData.filter(
      (t) =>
        t.description?.toLowerCase().includes(q) ||
        t.account_name?.toLowerCase().includes(q) ||
        t.category_name?.toLowerCase().includes(q) ||
        t.subcategory_name?.toLowerCase().includes(q) ||
        t.date?.includes(q) ||
        String(t.amount).includes(q)
    );
  }, [txData, search]);

  // Bar chart data for balance sheet
  const bsBarData = useMemo(() => {
    if (!bsData) return [];
    const items = [
      ...bsData.assets.map((a) => ({ name: a.account, Assets: a.balance, Liabilities: 0 })),
      ...bsData.liabilities.map((l) => ({ name: l.account, Assets: 0, Liabilities: l.balance })),
    ];
    return items;
  }, [bsData]);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "hsl(var(--card))",
      borderColor: "hsl(var(--border))",
      borderRadius: "8px",
      fontSize: "12px",
    },
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explore your financial data through charts, tables, and filters.
        </p>
      </div>

      {/* ── Filter bar ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-[150px] text-sm"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-[150px] text-sm"
              />
            </div>

            {/* Category */}
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Account */}
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Person */}
            {peopleData.length > 0 && (
              <PersonFilter people={peopleData} value={person} onChange={setPerson} />
            )}

            {/* Global search */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 w-[220px] text-sm"
                />
              </div>
              {(startDate !== sixMonthsAgo ||
                endDate !== today ||
                categoryId !== ALL ||
                accountId !== ALL ||
                person !== ALL_LABEL ||
                search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDate(sixMonthsAgo);
                    setEndDate(today);
                    setCategoryId(ALL);
                    setAccountId(ALL);
                    setPerson(ALL_LABEL);
                    setSearch("");
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Profit & Loss                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Profit &amp; Loss
        </h2>

        {/* Metrics */}
        <div className="flex gap-4 mb-4">
          <MetricCard
            title="Total Income"
            value={plData?.total_income ?? 0}
            icon={TrendingUp}
            positive
          />
          <MetricCard
            title="Total Expenses"
            value={plData?.total_expenses ?? 0}
            icon={TrendingDown}
            positive={false}
          />
          <MetricCard
            title="Net Profit"
            value={plData?.net_profit ?? 0}
            icon={Wallet}
            positive
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Line chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Income vs Expenses over time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plLoading ? (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              ) : !plData?.monthly.length ? (
                <ChartEmpty />
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={plData.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip
                        {...tooltipStyle}
                        formatter={(v: number, name: string) => [formatCurrency(v), name]}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                      <Line
                        type="monotone"
                        dataKey="income"
                        name="Income"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="expenses"
                        name="Expenses"
                        stroke="#EF4444"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category breakdown table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expenses by category
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!plData?.by_category.length ? (
                <div className="px-6 pb-4 text-sm text-muted-foreground">No data</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {plData.by_category.slice(0, 8).map((row) => (
                    <div
                      key={row.category}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: row.color }}
                        />
                        <span className="truncate max-w-[120px]">{row.category}</span>
                      </div>
                      <span className="font-medium text-red-500">
                        {formatCurrency(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Balance Sheet                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Balance Sheet
        </h2>

        {/* Metrics */}
        <div className="flex gap-4 mb-4">
          <MetricCard
            title="Total Assets"
            value={bsData?.total_assets ?? 0}
            icon={Building2}
            positive
          />
          <MetricCard
            title="Total Liabilities"
            value={bsData?.total_liabilities ?? 0}
            icon={CreditCard}
            positive={false}
          />
          <MetricCard
            title="Net Worth"
            value={bsData?.net_worth ?? 0}
            icon={Wallet}
            positive
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Assets vs Liabilities by account
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bsLoading ? (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              ) : !bsBarData.length ? (
                <ChartEmpty />
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bsBarData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip
                        {...tooltipStyle}
                        formatter={(v: number, name: string) => [formatCurrency(v), name]}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                      <Bar dataKey="Assets" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Liabilities" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account tables */}
          <div className="flex flex-col gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">
                  Assets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!bsData?.assets.length ? (
                  <div className="px-4 pb-3 text-sm text-muted-foreground">No accounts</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {bsData.assets.map((a) => (
                      <div
                        key={a.account}
                        className="flex items-center justify-between px-4 py-2 text-sm"
                      >
                        <span className="truncate max-w-[120px]">{a.account}</span>
                        <span className="font-medium text-emerald-500">
                          {formatCurrency(a.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-red-500 uppercase tracking-wide">
                  Liabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!bsData?.liabilities.length ? (
                  <div className="px-4 pb-3 text-sm text-muted-foreground">No accounts</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {bsData.liabilities.map((l) => (
                      <div
                        key={l.account}
                        className="flex items-center justify-between px-4 py-2 text-sm"
                      >
                        <span className="truncate max-w-[120px]">{l.account}</span>
                        <span className="font-medium text-red-500">
                          {formatCurrency(l.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Spending Analysis                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-primary" />
          Spending Analysis
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie chart by category */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Spending by category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spLoading ? (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              ) : !spData?.by_category.length ? (
                <ChartEmpty />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={spData.by_category}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="amount"
                        nameKey="category"
                      >
                        {spData.by_category.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        {...tooltipStyle}
                        formatter={(v: number, name: string) => [formatCurrency(v), name]}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                        formatter={(v: string) => (v.length > 18 ? v.slice(0, 16) + "…" : v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar chart by subcategory */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top spending by subcategory
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spLoading ? (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              ) : !spData?.by_subcategory.length ? (
                <ChartEmpty />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={spData.by_subcategory.slice(0, 10)}
                      layout="vertical"
                      barSize={14}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="subcategory"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={90}
                      />
                      <RechartsTooltip
                        {...tooltipStyle}
                        formatter={(v: number) => [formatCurrency(v), "Amount"]}
                      />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {spData.by_subcategory.slice(0, 10).map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Detailed Report Table                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          Detailed Transactions
          {filteredTx.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs font-normal">
              {filteredTx.length}
            </Badge>
          )}
        </h2>

        <Card>
          <CardContent className="p-0">
            {txLoading ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : filteredTx.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                No transactions match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground">
                        Description
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground">
                        Category
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground">
                        Subcategory
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground">
                        Account
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">
                        Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTx.slice(0, 200).map((tx) => (
                      <TableRow key={tx.id} className="border-border/40 hover:bg-muted/30">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {tx.date}
                        </TableCell>
                        <TableCell className="text-sm font-medium max-w-[220px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.category_name ?? <span className="italic opacity-40">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.subcategory_name ?? <span className="italic opacity-40">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.account_name ?? <span className="italic opacity-40">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          <span
                            className={cn(
                              tx.type === "income"
                                ? "text-emerald-500"
                                : tx.type === "expense"
                                ? "text-red-500"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatCurrency(tx.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredTx.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Showing 200 of {filteredTx.length} transactions. Narrow your filters to see more.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
