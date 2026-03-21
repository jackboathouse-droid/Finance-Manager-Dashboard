import { useEffect } from "react";
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
  CreateTransactionRequestType,
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

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  account_id: z.coerce.number().min(1, "Account is required"),
  category_id: z.coerce.number().optional().nullable(),
  subcategory_id: z.coerce.number().optional().nullable(),
  amount: z.coerce.number(),
  person: z.string().min(1, "Person/Payee is required"),
  type: z.enum(["income", "expense", "transfer"]),
});

type FormValues = z.infer<typeof formSchema>;

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

  const { data: accounts } = useGetAccounts();
  const { data: categories } = useGetCategories();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: transaction?.date || new Date().toISOString().split("T")[0],
      description: transaction?.description || "",
      account_id: transaction?.account_id || 0,
      category_id: transaction?.category_id || 0,
      subcategory_id: transaction?.subcategory_id || 0,
      amount: transaction ? Math.abs(transaction.amount) : 0,
      person: transaction?.person || "",
      type: transaction?.type || "expense",
    },
  });

  const selectedCategory = form.watch("category_id");
  const type = form.watch("type");

  const { data: subcategories } = useGetSubcategories(
    { category_id: selectedCategory || undefined },
    { query: { enabled: !!selectedCategory } }
  );

  // Filter categories by selected type
  const filteredCategories = categories?.filter((c) => c.type === type);

  const onSubmit = (values: FormValues) => {
    // Process amount to be negative for expenses
    let finalAmount = Math.abs(values.amount);
    if (values.type === "expense") {
      finalAmount = -finalAmount;
    }

    const payload = {
      ...values,
      amount: finalAmount,
      type: values.type as CreateTransactionRequestType,
      category_id: values.category_id || null,
      subcategory_id: values.subcategory_id || null,
    };

    if (transaction) {
      updateMutation.mutate(
        { id: transaction.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
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
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
            toast({ title: "Transaction created" });
            onSuccess();
          },
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...form.register("date")} />
          {form.formState.errors.date && (
            <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={form.watch("type")}
            onValueChange={(val: any) => {
              form.setValue("type", val);
              form.setValue("category_id", 0);
              form.setValue("subcategory_id", 0);
            }}
          >
            <SelectTrigger id="type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" placeholder="Grocery run..." {...form.register("description")} />
        {form.formState.errors.description && (
          <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...form.register("amount")}
          />
          {form.formState.errors.amount && (
            <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="person">Person / Payee</Label>
          <Input id="person" placeholder="Whole Foods" {...form.register("person")} />
          {form.formState.errors.person && (
            <p className="text-sm text-destructive">{form.formState.errors.person.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account">Account</Label>
        <Select
          value={form.watch("account_id")?.toString()}
          onValueChange={(val) => form.setValue("account_id", parseInt(val))}
        >
          <SelectTrigger id="account">
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
          <p className="text-sm text-destructive">{form.formState.errors.account_id.message}</p>
        )}
      </div>

      {type !== "transfer" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={form.watch("category_id")?.toString()}
              onValueChange={(val) => {
                form.setValue("category_id", parseInt(val));
                form.setValue("subcategory_id", 0);
              }}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory</Label>
            <Select
              value={form.watch("subcategory_id")?.toString()}
              onValueChange={(val) => form.setValue("subcategory_id", parseInt(val))}
              disabled={!selectedCategory || !subcategories?.length}
            >
              <SelectTrigger id="subcategory">
                <SelectValue placeholder="Select subcategory" />
              </SelectTrigger>
              <SelectContent>
                {subcategories?.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id.toString()}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSuccess}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="min-w-[100px]">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
