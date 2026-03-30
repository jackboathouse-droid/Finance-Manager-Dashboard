import { useEffect, useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Transaction,
  useCreateTransaction,
  useUpdateTransaction,
  useGetAccounts,
  useGetCategories,
  useGetSubcategories,
  useCreateCategory,
  useCreateSubcategory,
  CreateTransactionRequestType,
  Category,
  Subcategory,
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
import { CreatableCombobox, ComboboxOption } from "@/components/ui/creatable-combobox";
import { PeopleSelect } from "@/components/ui/people-select";
import { cn } from "@/lib/utils";
import { Sparkles, X } from "lucide-react";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  account_id: z.coerce.number().min(1, "Account is required"),
  category_id: z.coerce.number().optional().nullable(),
  subcategory_id: z.coerce.number().optional().nullable(),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  person: z.string().min(1, "Person/Payee is required"),
  type: z.enum(["income", "expense", "transfer"]),
});

type FormValues = z.infer<typeof formSchema>;

interface AiSuggestion {
  category_id: number;
  category_name: string;
  confidence: "high" | "medium" | "low";
}

export function TransactionForm({
  transaction,
  onSuccess,
}: {
  transaction?: Transaction | null;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const createCategoryMutation = useCreateCategory();
  const createSubcategoryMutation = useCreateSubcategory();

  const { data: accounts } = useGetAccounts();
  const { data: categories = [] as Category[] } = useGetCategories();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: transaction?.date || new Date().toISOString().split("T")[0],
      description: transaction?.description || "",
      account_id: transaction?.account_id || 0,
      category_id: transaction?.category_id || null,
      subcategory_id: transaction?.subcategory_id || null,
      amount: transaction ? Math.abs(transaction.amount) : undefined,
      person: transaction?.person || "",
      type: (transaction?.type as "income" | "expense" | "transfer") || "expense",
    },
  });

  const selectedCategoryId = form.watch("category_id");
  const type = form.watch("type");
  const description = form.watch("description");

  const { data: subcategories = [] as Subcategory[] } = useGetSubcategories(
    { category_id: selectedCategoryId ?? undefined },
    { query: { enabled: !!selectedCategoryId && selectedCategoryId > 0 } }
  );

  // ── AI suggestion state ───────────────────────────────────────────────────
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedDescRef = useRef<string>("");

  // Dismiss suggestion when user manually picks a category
  const handleCategorySelect = useCallback((val: string) => {
    form.setValue("category_id", parseInt(val));
    setAiSuggestion(null);
  }, [form]);

  // Fetch AI suggestion with 600ms debounce
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const trimmed = (description ?? "").trim();

    if (trimmed.length < 3 || type === "transfer") {
      setAiSuggestion(null);
      return;
    }

    // Don't re-fetch the same description
    if (trimmed === lastFetchedDescRef.current) return;

    debounceTimerRef.current = setTimeout(async () => {
      lastFetchedDescRef.current = trimmed;
      setAiLoading(true);
      try {
        const response = await fetch("/api/ai/categorise", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: trimmed, type }),
        });
        if (!response.ok) { setAiSuggestion(null); return; }
        const data: AiSuggestion | null = await response.json();
        setAiSuggestion(data);
      } catch {
        setAiSuggestion(null);
      } finally {
        setAiLoading(false);
      }
    }, 600);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [description, type]);

  // Reset suggestion when type changes (also resets category)
  useEffect(() => {
    setAiSuggestion(null);
    lastFetchedDescRef.current = "";
  }, [type]);

  // Accept AI suggestion
  const acceptAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return;
    form.setValue("category_id", aiSuggestion.category_id);
    setAiSuggestion(null);
  }, [aiSuggestion, form]);

  // Reset subcategory when category changes
  useEffect(() => {
    form.setValue("subcategory_id", null);
  }, [selectedCategoryId]);

  // Reset category + subcategory when type changes
  useEffect(() => {
    form.setValue("category_id", null);
    form.setValue("subcategory_id", null);
  }, [type]);

  // Only show categories matching the current transaction type
  const filteredCategories = categories.filter((c) =>
    type === "transfer" ? false : c.type === type
  );

  // Convert to combobox options
  const categoryOptions: ComboboxOption[] = filteredCategories.map((c) => ({
    value: c.id.toString(),
    label: c.name,
  }));

  const subcategoryOptions: ComboboxOption[] = subcategories.map((s) => ({
    value: s.id.toString(),
    label: s.name,
  }));

  // ── Inline category creation ──────────────────────────────────────────────
  const handleCreateCategory = useCallback(
    (name: string): Promise<ComboboxOption> => {
      return new Promise((resolve, reject) => {
        createCategoryMutation.mutate(
          { data: { name: name.trim(), type: type as "income" | "expense" } },
          {
            onSuccess: (newCat) => {
              queryClient.setQueryData<Category[]>(
                ["/api/categories"],
                (prev = []) => [...prev, newCat]
              );
              toast({ title: `Category "${newCat.name}" created` });
              resolve({ value: newCat.id.toString(), label: newCat.name });
            },
            onError: () => {
              toast({ title: "Failed to create category", variant: "destructive" });
              reject(new Error("Failed to create category"));
            },
          }
        );
      });
    },
    [createCategoryMutation, queryClient, toast, type]
  );

  // ── Inline subcategory creation ───────────────────────────────────────────
  const handleCreateSubcategory = useCallback(
    (name: string): Promise<ComboboxOption> => {
      if (!selectedCategoryId) return Promise.reject(new Error("No category selected"));

      return new Promise((resolve, reject) => {
        createSubcategoryMutation.mutate(
          {
            data: {
              name: name.trim(),
              category_id: selectedCategoryId,
              type: type as "income" | "expense",
            },
          },
          {
            onSuccess: (newSub) => {
              queryClient.setQueryData<Subcategory[]>(
                ["/api/subcategories", { category_id: selectedCategoryId }],
                (prev = []) => [...prev, newSub]
              );
              queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
              toast({ title: `Subcategory "${newSub.name}" created` });
              resolve({ value: newSub.id.toString(), label: newSub.name });
            },
            onError: () => {
              toast({ title: "Failed to create subcategory", variant: "destructive" });
              reject(new Error("Failed to create subcategory"));
            },
          }
        );
      });
    },
    [createSubcategoryMutation, queryClient, toast, type, selectedCategoryId]
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = (values: FormValues) => {
    let finalAmount = Math.abs(values.amount);
    if (values.type === "expense") finalAmount = -finalAmount;

    const payload = {
      ...values,
      amount: finalAmount,
      type: values.type as CreateTransactionRequestType,
      category_id: values.category_id || null,
      subcategory_id: values.subcategory_id || null,
    };

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    };

    if (transaction) {
      updateMutation.mutate(
        { id: transaction.id, data: payload },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Transaction updated" });
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
            toast({ title: "Transaction created" });
            onSuccess();
          },
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {/* ── Type toggle ───────────────────────────────────────────────── */}
      <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
        {(["expense", "income", "transfer"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => form.setValue("type", t)}
            className={cn(
              "flex-1 py-2.5 capitalize transition-colors",
              form.watch("type") === t
                ? t === "expense"
                  ? "bg-red-500 text-white"
                  : t === "income"
                    ? "bg-emerald-500 text-white"
                    : "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Date + Amount ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Date
          </Label>
          <Input id="date" type="date" className="h-10" {...form.register("date")} />
          {form.formState.errors.date && (
            <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Amount
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="h-10 pl-7"
              {...form.register("amount")}
            />
          </div>
          {form.formState.errors.amount && (
            <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
          )}
        </div>
      </div>

      {/* ── Description ───────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Description
        </Label>
        <Input
          id="description"
          placeholder="e.g. Grocery run at Whole Foods"
          className="h-10"
          {...form.register("description")}
        />
        {form.formState.errors.description && (
          <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
        )}
      </div>

      {/* ── Account + Person ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="account" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Account
          </Label>
          <Select
            value={form.watch("account_id")?.toString() || ""}
            onValueChange={(val) => form.setValue("account_id", parseInt(val))}
          >
            <SelectTrigger id="account" className="h-10">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((acc) => (
                <SelectItem key={acc.id} value={acc.id.toString()}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.account_id && (
            <p className="text-xs text-destructive">{form.formState.errors.account_id.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Person
          </Label>
          <PeopleSelect
            value={form.watch("person")}
            onChange={(name) => form.setValue("person", name, { shouldValidate: true })}
          />
          {form.formState.errors.person && (
            <p className="text-xs text-destructive">{form.formState.errors.person.message}</p>
          )}
        </div>
      </div>

      {/* ── Category + Subcategory (hidden for transfers) ─────────────── */}
      {type !== "transfer" && (
        <div className="space-y-3">
          {/* Category */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Category
              </Label>
              <span className="text-[10px] text-muted-foreground/60 italic">
                Type to search or create new
              </span>
            </div>
            <CreatableCombobox
              value={form.watch("category_id")?.toString() ?? ""}
              options={categoryOptions}
              placeholder="Select or create category…"
              searchPlaceholder="Search categories…"
              emptyText="No categories yet"
              onSelect={handleCategorySelect}
              onCreate={handleCreateCategory}
            />

            {/* AI suggestion badge */}
            {aiLoading && !aiSuggestion && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                <Sparkles className="h-3 w-3 text-[#4FC3F7]" />
                <span>AI is thinking…</span>
              </div>
            )}
            {aiSuggestion && !form.watch("category_id") && (
              <div className="flex items-center gap-2 rounded-md bg-[#4FC3F7]/10 border border-[#4FC3F7]/30 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#4FC3F7] flex-shrink-0" />
                <span className="text-xs text-foreground flex-1">
                  <span className="text-muted-foreground">AI suggests: </span>
                  <strong>{aiSuggestion.category_name}</strong>
                  {aiSuggestion.confidence === "low" && (
                    <span className="text-muted-foreground ml-1">(low confidence)</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={acceptAiSuggestion}
                  className="text-xs font-medium text-[#4FC3F7] hover:text-[#29B6F6] transition-colors"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setAiSuggestion(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Dismiss suggestion"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Subcategory */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Subcategory
              </Label>
              {selectedCategoryId && (
                <span className="text-[10px] text-muted-foreground/60 italic">
                  Type to search or create new
                </span>
              )}
            </div>
            <CreatableCombobox
              value={form.watch("subcategory_id")?.toString() ?? ""}
              options={subcategoryOptions}
              placeholder={
                !selectedCategoryId
                  ? "Pick a category first"
                  : subcategoryOptions.length
                    ? "Select or create subcategory…"
                    : "Type to create a subcategory…"
              }
              searchPlaceholder="Search subcategories…"
              emptyText="No subcategories yet"
              disabled={!selectedCategoryId}
              onSelect={(val) => form.setValue("subcategory_id", parseInt(val))}
              onCreate={handleCreateSubcategory}
            />
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
        <Button type="button" variant="outline" onClick={onSuccess} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="min-w-[100px]">
          {isPending ? "Saving…" : transaction ? "Update" : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
