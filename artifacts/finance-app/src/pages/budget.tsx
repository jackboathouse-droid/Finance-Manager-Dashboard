import { useState } from "react";
import { format } from "date-fns";
import { 
  useGetBudgetVsActual, 
  useGetBudgets,
  useDeleteBudget,
  Budget 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Target, Trash2 } from "lucide-react";
import { BudgetForm } from "@/components/forms/budget-form";

export default function Budgets() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [month, setMonth] = useState(currentMonth);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: budgetVsActual, isLoading: loadingView } = useGetBudgetVsActual({ month });
  const { data: rawBudgets } = useGetBudgets({ month });
  const deleteMutation = useDeleteBudget();

  const handleEdit = (categoryName: string) => {
    // Find the raw budget entry to edit
    const budget = rawBudgets?.find(b => b.category_name === categoryName);
    if (budget) {
      setEditingBudget(budget);
      setIsFormOpen(true);
    }
  };

  const handleDelete = (categoryName: string) => {
    const budget = rawBudgets?.find(b => b.category_name === categoryName);
    if (budget && confirm("Delete this budget?")) {
      deleteMutation.mutate({ id: budget.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/budget-vs-actual"] });
          toast({ title: "Budget deleted" });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Monthly Budget</h1>
          <p className="text-muted-foreground mt-1">Plan your expenses and track your variance.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none flex items-center bg-card border border-border/50 rounded-lg px-3 overflow-hidden shadow-sm h-10">
            <Label htmlFor="month-picker" className="sr-only">Month</Label>
            <Input
              id="month-picker"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 px-0 w-[130px]"
            />
          </div>
          <Button onClick={() => { setEditingBudget(null); setIsFormOpen(true); }} className="flex-1 sm:flex-none shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Set Budget
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Budget Limit</TableHead>
              <TableHead className="text-right">Actual Spent</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="w-[120px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingView ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Loading budgets...</TableCell>
              </TableRow>
            ) : budgetVsActual?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center">
                    <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">No budgets set for {month}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              budgetVsActual?.map((item) => {
                const isOverBudget = item.variance < 0;
                // Variance logic in backend: variance = budget - actual (if actual is pos number representing spending)
                // Assuming backend normalizes "actual" to positive spending for comparison
                const percentage = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;
                
                return (
                  <TableRow key={item.category} className="group hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{item.category}</span>
                        {/* Simple progress bar */}
                        <div className="w-full max-w-[200px] h-1.5 bg-secondary rounded-full mt-2 overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all", isOverBudget ? "bg-destructive" : "bg-primary")}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(item.budget)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-foreground">
                      {formatCurrency(item.actual)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-bold tracking-tight",
                      isOverBudget ? "text-destructive" : "text-success"
                    )}>
                      {isOverBudget ? '-' : '+'}{formatCurrency(Math.abs(item.variance))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => handleEdit(item.category)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDelete(item.category)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? "Edit Budget" : "Set New Budget"}</DialogTitle>
          </DialogHeader>
          <BudgetForm 
            budget={editingBudget} 
            defaultMonth={month}
            onSuccess={() => setIsFormOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
