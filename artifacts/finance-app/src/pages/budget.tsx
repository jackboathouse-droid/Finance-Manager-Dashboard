import { useState, useEffect } from "react";
import { format, addMonths, subMonths, parseISO } from "date-fns";
import { useDeleteBudget, Budget } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Target, Trash2, Pencil, ChevronLeft, ChevronRight,
  RefreshCw, ChevronDown, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { BudgetForm } from "@/components/forms/budget-form";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubcategoryRow {
  budget_id: number;
  subcategory_id: number;
  subcategory_name: string;
  budget: number;
  actual: number;
  is_recurring: boolean;
}

interface CategoryRow {
  budget_id: number;
  category_id: number;
  category_name: string;
  budget: number;
  actual: number;
  is_recurring: boolean;
  subcategories: SubcategoryRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function progressColor(pct: number) {
  if (pct >= 100) return "bg-destructive";
  if (pct >= 80) return "bg-amber-500";
  return "bg-primary";
}

function ProgressBar({ budget, actual }: { budget: number; actual: number }) {
  const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
  return (
    <div className="w-full max-w-[180px] h-1.5 bg-secondary rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", progressColor(pct))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function VarianceCell({ budget, actual }: { budget: number; actual: number }) {
  const variance = budget - actual;
  const over = variance < 0;
  return (
    <span className={cn("font-mono font-bold tracking-tight", over ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
      {over ? "-" : "+"}{formatCurrency(Math.abs(variance))}
    </span>
  );
}

// ── Fetch hook for /api/budgets/detailed ──────────────────────────────────────

function useBudgetDetailed(month: string) {
  return useQuery<CategoryRow[]>({
    queryKey: ["/api/budgets/detailed", month],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/detailed?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch detailed budgets");
      return res.json();
    },
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Budgets() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteBudget();

  const { data: rows = [], isLoading } = useBudgetDetailed(month);

  // Auto-expand categories that have subcategories on load
  useEffect(() => {
    const ids = rows
      .filter((r) => r.subcategories.length > 0)
      .map((r) => r.category_id);
    setExpandedCategories(new Set(ids));
  }, [rows]);

  const toggleExpand = (id: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigateMonth = (dir: 1 | -1) => {
    const date = parseISO(`${month}-01`);
    setMonth(format(dir === 1 ? addMonths(date, 1) : subMonths(date, 1), "yyyy-MM"));
  };

  const monthLabel = format(parseISO(`${month}-01`), "MMMM yyyy");

  const openCreate = () => {
    setEditingBudget(null);
    setIsFormOpen(true);
  };

  const openEditFromRow = (partial: Partial<Budget> & { id: number; category_id: number; month: string; budget_amount: number }) => {
    setEditingBudget(partial as Budget);
    setIsFormOpen(true);
  };

  const handleDelete = (budgetId: number, label: string) => {
    if (!confirm(`Delete the budget for "${label}"?`)) return;
    deleteMutation.mutate(
      { id: budgetId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
          queryClient.invalidateQueries({ queryKey: ["/api/budgets/detailed"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/budget-vs-actual"] });
          toast({ title: "Budget deleted" });
        },
      }
    );
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/budgets/detailed"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/budget-vs-actual"] });
  };

  // Summary totals
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Monthly Budget</h1>
          <p className="text-muted-foreground mt-1">Plan expenses and track variance by category.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {/* Month navigation */}
          <div className="flex items-center bg-card border border-border/50 rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => navigateMonth(-1)}
              className="h-10 px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-0 bg-transparent text-sm font-medium text-center focus:outline-none w-[130px] cursor-pointer"
              aria-label="Select month"
            />
            <button
              onClick={() => navigateMonth(1)}
              className="h-10 px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={openCreate} className="flex-1 sm:flex-none shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Set Budget
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Budgeted", value: totalBudget, color: "text-foreground" },
            { label: "Total Spent", value: totalActual, color: totalActual > totalBudget ? "text-destructive" : "text-foreground" },
            {
              label: "Remaining",
              value: Math.abs(totalBudget - totalActual),
              color: totalActual > totalBudget ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
              prefix: totalActual > totalBudget ? "-" : "+",
            },
          ].map((card) => (
            <div key={card.label} className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className={cn("text-xl font-bold font-mono", card.color)}>
                {card.prefix ?? ""}{formatCurrency(card.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Budget table */}
      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_140px_140px_130px_120px] items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Category / Subcategory</span>
          <span className="text-right">Budgeted</span>
          <span className="text-right">Spent</span>
          <span className="text-right">Variance</span>
          <span className="text-center">Actions</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading budgets…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
              <Target className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-muted-foreground font-medium">No budgets set for {monthLabel}</p>
              <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm mx-auto">
                Set spending limits by category. Recurring budgets carry forward automatically each month.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Set your first budget
              </Button>
              <a href="/categories" className="text-xs text-primary hover:underline">
                Manage categories →
              </a>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {rows.map((row) => {
              const isExpanded = expandedCategories.has(row.category_id);
              const hasSubs = row.subcategories.length > 0;
              const catPct = row.budget > 0 ? (row.actual / row.budget) * 100 : 0;

              return (
                <div key={row.category_id}>
                  {/* Category row */}
                  <div className="grid grid-cols-[1fr_140px_140px_130px_120px] items-center gap-2 px-4 py-3.5 group hover:bg-muted/20 transition-colors">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        {hasSubs && (
                          <button
                            onClick={() => toggleExpand(row.category_id)}
                            className="text-muted-foreground hover:text-foreground shrink-0"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRightIcon className="h-4 w-4" />}
                          </button>
                        )}
                        {!hasSubs && <span className="w-4 shrink-0" />}
                        <span className="font-semibold text-sm truncate">{row.category_name}</span>
                        {row.is_recurring && (
                          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px] px-1.5 py-0 h-4">
                            <RefreshCw className="h-2.5 w-2.5" />
                            Recurring
                          </Badge>
                        )}
                      </div>
                      {row.budget > 0 && (
                        <div className="pl-6">
                          <ProgressBar budget={row.budget} actual={row.actual} />
                        </div>
                      )}
                    </div>
                    <div className="text-right font-mono text-sm text-muted-foreground">
                      {row.budget > 0 ? formatCurrency(row.budget) : <span className="text-muted-foreground/40 italic text-xs">no limit</span>}
                    </div>
                    <div className="text-right font-mono text-sm font-medium">{formatCurrency(row.actual)}</div>
                    <div className="text-right text-sm">
                      {row.budget > 0 ? <VarianceCell budget={row.budget} actual={row.actual} /> : "—"}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      {row.budget_id > 0 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => openEditFromRow({ id: row.budget_id, category_id: row.category_id, subcategory_id: null, month, budget_amount: row.budget, is_recurring: row.is_recurring })}
                            title="Edit budget"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDelete(row.budget_id, row.category_name)}
                            title="Delete budget"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Subcategory rows */}
                  {hasSubs && isExpanded && (
                    <div className="bg-muted/10 border-t border-border/20">
                      {row.subcategories.map((sub) => (
                        <div
                          key={sub.subcategory_id}
                          className="grid grid-cols-[1fr_140px_140px_130px_120px] items-center gap-2 px-4 py-2.5 group hover:bg-muted/30 transition-colors border-b border-border/10 last:border-0"
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2 pl-6">
                              <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                              <span className="text-sm text-muted-foreground truncate">{sub.subcategory_name}</span>
                              {sub.is_recurring && (
                                <Badge variant="outline" className="shrink-0 gap-1 text-[10px] px-1 py-0 h-4 border-muted-foreground/30">
                                  <RefreshCw className="h-2.5 w-2.5" />
                                </Badge>
                              )}
                            </div>
                            <div className="pl-14">
                              <ProgressBar budget={sub.budget} actual={sub.actual} />
                            </div>
                          </div>
                          <div className="text-right font-mono text-sm text-muted-foreground">
                            {formatCurrency(sub.budget)}
                          </div>
                          <div className="text-right font-mono text-sm">{formatCurrency(sub.actual)}</div>
                          <div className="text-right text-sm">
                            <VarianceCell budget={sub.budget} actual={sub.actual} />
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => openEditFromRow({ id: sub.budget_id, category_id: row.category_id, subcategory_id: sub.subcategory_id, month, budget_amount: sub.budget, is_recurring: sub.is_recurring })}
                              title="Edit subcategory budget"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDelete(sub.budget_id, sub.subcategory_name)}
                              title="Delete subcategory budget"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? "Edit Budget" : "Set New Budget"}</DialogTitle>
          </DialogHeader>
          <BudgetForm
            budget={editingBudget}
            defaultMonth={month}
            onSuccess={() => {
              setIsFormOpen(false);
              invalidateAll();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
