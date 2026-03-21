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
  name: z.string().min(1, "Name is required"),
  type: z.enum(["bank", "credit_card"]),
  person: z.string().min(1, "Owner is required"),
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
  
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: account?.name || "",
      type: account?.type || "bank",
      person: account?.person || "",
    },
  });

  const onSubmit = (values: FormValues) => {
    if (account) {
      updateMutation.mutate(
        { id: account.id, data: values },
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
        { data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Account created" });
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
