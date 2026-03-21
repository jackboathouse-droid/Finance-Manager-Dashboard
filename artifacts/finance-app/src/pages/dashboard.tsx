import { useState } from "react";
import { 
  useGetDashboardSummary, 
  useGetMonthlyChart, 
  useGetCategoryChart, 
  useGetBudgetVsActual 
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";

export default function Dashboard() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [month] = useState(currentMonth);

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ month });
  const { data: monthlyData } = useGetMonthlyChart();
  const { data: categoryData } = useGetCategoryChart({ month });
  const { data: budgetData } = useGetBudgetVsActual({ month });

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (loadingSummary) {
    return <div className="flex h-full items-center justify-center p-8">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview for {format(new Date(), 'MMMM yyyy')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(summary?.total_income || 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(summary?.total_expenses || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary border-primary-border shadow-md text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Net Cash Flow</CardTitle>
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.net_cash_flow || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Income" stroke="hsl(var(--success))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData && categoryData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="amount"
                      nameKey="category"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground text-sm">
                <img src={`${import.meta.env.BASE_URL}images/empty-state.png`} alt="Empty" className="w-24 h-24 mb-4 opacity-50" />
                <p>No expenses this month</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Budget vs Actual</CardTitle>
        </CardHeader>
        <CardContent>
          {budgetData && budgetData.length > 0 ? (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                  />
                  <Legend />
                  <Bar dataKey="budget" name="Budget" fill="hsl(var(--primary)/0.3)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual Spending" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <p>No budgets set for this month.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
