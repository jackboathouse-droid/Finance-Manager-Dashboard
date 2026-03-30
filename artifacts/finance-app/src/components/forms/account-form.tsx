import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Account,
  useCreateAccount,
  useUpdateAccount,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["bank", "credit_card"]),
  person: z.string().min(1, "Owner is required"),
  starting_balance: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .optional()
    .default(0),
});

type FormValues = z.infer<typeof formSchema>;

export function AccountForm({
  account,
  onSuccess,
}: {
  account?: Account | null;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: account?.name || "",
      type: (account?.type as "bank" | "credit_card") || "bank",
      person: account?.person || "",
      starting_balance: (account as any)?.starting_balance ?? 0,
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload = {
      name: values.name,
      type: values.type,
      person: values.person,
      starting_balance: values.starting_balance ?? 0,
    };

    if (account) {
      updateMutation.mutate(
        { id: account.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Account updated" });
            onSuccess();
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Account created" });
            onSuccess();
          },
          onError: (err: any) => {
            const msg: string = err?.message ?? err?.error ?? "Failed to create account";
            if (msg.includes("limit") || msg.includes("402") || err?.status === 402) {
              toast({
                title: "Account limit reached",
                description: "Free plan allows 2 accounts. Upgrade to Pro for unlimited accounts.",
                variant: "destructive",
              });
              navigate("/pricing");
            } else {
              toast({ title: msg, variant: "destructive" });
            }
          },
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Account Name</Label>
        <Input id="name" placeholder="Chase Checking" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Account Type</Label>
        <Select
          value={form.watch("type")}
          onValueChange={(val: any) => form.setValue("type", val)}
        >
          <SelectTrigger id="type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bank">Bank / Checking</SelectItem>
            <SelectItem value="credit_card">Credit Card</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="person">Owner</Label>
        <Input id="person" placeholder="John Doe" {...form.register("person")} />
        {form.formState.errors.person && (
          <p className="text-sm text-destructive">{form.formState.errors.person.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="starting_balance">Starting Balance</Label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs">
                Enter your current balance to start tracking this account accurately. Use a negative
                number for credit card debt.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
            $
          </span>
          <Input
            id="starting_balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            className="pl-7"
            {...form.register("starting_balance")}
          />
        </div>
        {form.formState.errors.starting_balance && (
          <p className="text-sm text-destructive">
            {form.formState.errors.starting_balance.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          This will be added to your account balance before any transactions.
        </p>
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
          {isPending ? "Saving..." : "Save Account"}
        </Button>
      </div>
    </form>
  );
}
