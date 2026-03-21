import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Budget,
  useCreateBudget,
  useUpdateBudget,
  useGetCategories,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

const formSchema = z.object({
  category_id: z.coerce.number().min(1, "Category is required"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM"),
  budget_amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
});

type FormValues = z.infer<typeof formSchema>;

export function BudgetForm({
  budget,
  defaultMonth,
  onSuccess,
}: {
  budget?: Budget | null;
  defaultMonth?: string;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const { data: categories } = useGetCategories();
  
  const expenseCategories = categories?.filter(c => c.type === "expense") || [];

  const currentMonth = format(new Date(), 'yyyy-MM');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category_id: budget?.category_id || 0,
      month: budget?.month || defaultMonth || currentMonth,
      budget_amount: budget?.budget_amount || 0,
    },
  });

  const onSubmit = (values: FormValues) => {
    if (budget) {
      updateMutation.mutate(
        { id: budget.id, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/budget-vs-actual"] });
            toast({ title: "Budget updated" });
            onSuccess();
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/budget-vs-actual"] });
            toast({ title: "Budget created" });
            onSuccess();
          },
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="month">Month (YYYY-MM)</Label>
        <Input 
          id="month" 
          placeholder="2024-01" 
          {...form.register("month")} 
        />
        {form.formState.errors.month && (
          <p className="text-sm text-destructive">{form.formState.errors.month.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category_id">Expense Category</Label>
        <Select
          value={form.watch("category_id")?.toString()}
          onValueChange={(val) => form.setValue("category_id", parseInt(val))}
        >
          <SelectTrigger id="category_id">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {expenseCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.category_id && (
          <p className="text-sm text-destructive">{form.formState.errors.category_id.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="budget_amount">Budget Amount ($)</Label>
        <Input 
          id="budget_amount" 
          type="number" 
          step="0.01" 
          {...form.register("budget_amount")} 
        />
        {form.formState.errors.budget_amount && (
          <p className="text-sm text-destructive">{form.formState.errors.budget_amount.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSuccess}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Budget"}
        </Button>
      </div>
    </form>
  );
}
