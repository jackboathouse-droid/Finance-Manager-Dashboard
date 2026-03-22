import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Budget,
  useCreateBudget,
  useUpdateBudget,
  useGetCategories,
  useGetSubcategories,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";

const formSchema = z.object({
  category_id: z.coerce.number().min(1, "Category is required"),
  subcategory_id: z.coerce.number().nullable().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM"),
  budget_amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  is_recurring: z.boolean().default(false),
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
  const expenseCategories = categories?.filter((c) => c.type === "expense") || [];

  const currentMonth = format(new Date(), "yyyy-MM");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category_id: budget?.category_id || 0,
      subcategory_id: budget?.subcategory_id ?? null,
      month: budget?.month || defaultMonth || currentMonth,
      budget_amount: budget?.budget_amount || 0,
      is_recurring: budget?.is_recurring ?? false,
    },
  });

  const selectedCategoryId = form.watch("category_id");

  const { data: allSubcategories } = useGetSubcategories();
  const subcategories =
    allSubcategories?.filter((s) => s.category_id === selectedCategoryId) || [];

  // Reset subcategory when category changes
  useEffect(() => {
    form.setValue("subcategory_id", null);
  }, [selectedCategoryId]);

  const onSubmit = (values: FormValues) => {
    const payload = {
      category_id: values.category_id,
      subcategory_id: values.subcategory_id ?? undefined,
      month: values.month,
      budget_amount: values.budget_amount,
      is_recurring: values.is_recurring,
    };

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/budget-vs-actual"] });
    };

    if (budget) {
      updateMutation.mutate(
        { id: budget.id, data: payload },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Budget updated" });
            onSuccess();
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Budget created" });
            onSuccess();
          },
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isRecurring = form.watch("is_recurring");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Month */}
      <div className="space-y-2">
        <Label htmlFor="month">Month</Label>
        <Input
          id="month"
          type="month"
          {...form.register("month")}
          className="w-full"
        />
        {form.formState.errors.month && (
          <p className="text-sm text-destructive">{form.formState.errors.month.message}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category_id">Category</Label>
        <Select
          value={form.watch("category_id")?.toString() || ""}
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

      {/* Subcategory — only shown when category has subcategories */}
      {subcategories.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="subcategory_id">Subcategory <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Select
            value={form.watch("subcategory_id")?.toString() || "none"}
            onValueChange={(val) =>
              form.setValue("subcategory_id", val === "none" ? null : parseInt(val))
            }
          >
            <SelectTrigger id="subcategory_id">
              <SelectValue placeholder="All subcategories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— All subcategories —</SelectItem>
              {subcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id.toString()}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="budget_amount">Budget Amount ($)</Label>
        <Input
          id="budget_amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          {...form.register("budget_amount")}
        />
        {form.formState.errors.budget_amount && (
          <p className="text-sm text-destructive">{form.formState.errors.budget_amount.message}</p>
        )}
      </div>

      {/* Recurring toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="is_recurring" className="cursor-pointer font-medium">
              Recurring
            </Label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            Automatically apply this budget to future months
          </p>
        </div>
        <Switch
          id="is_recurring"
          checked={isRecurring}
          onCheckedChange={(val) => form.setValue("is_recurring", val)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onSuccess} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : budget ? "Update Budget" : "Save Budget"}
        </Button>
      </div>
    </form>
  );
}
