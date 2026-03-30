import { useState } from "react";
import { useGetAccounts, useDeleteAccount, Account } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, Landmark, Edit2, Trash2, Wallet } from "lucide-react";
import { AccountForm } from "@/components/forms/account-form";

export default function Accounts() {
  const { data: accounts, isLoading } = useGetAccounts();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteAccount();
  const { toast } = useToast();

  const handleEdit = (acc: Account) => {
    setEditingAcc(acc);
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this account? It will delete all associated transactions!")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          toast({ title: "Account deleted" });
        }
      });
    }
  };

  const totalBalance = accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground mt-1">Manage your bank accounts and credit cards.</p>
        </div>
        <Button onClick={() => { setEditingAcc(null); setIsFormOpen(true); }} className="shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Add Account
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Net Worth Card */}
        <Card className="bg-primary text-primary-foreground border-primary shadow-lg sm:col-span-2 lg:col-span-1 flex flex-col justify-center min-h-[160px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary-foreground/80 font-medium text-sm uppercase tracking-wider">Total Net Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display font-bold tracking-tight">
              {formatCurrency(totalBalance)}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="sm:col-span-2 py-12 text-center text-muted-foreground">Loading accounts...</div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-2 bg-card border border-dashed border-border/60 rounded-xl py-14 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No accounts yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first account to start tracking your finances.</p>
            </div>
            <Button size="sm" onClick={() => { setEditingAcc(null); setIsFormOpen(true); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add your first account
            </Button>
          </div>
        ) : accounts?.map((acc) => (
          <Card key={acc.id} className="border-border/50 shadow-sm hover:shadow-md transition-all group flex flex-col bg-card">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${acc.type === 'bank' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'}`}>
                  {acc.type === 'bank' ? <Landmark className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                </div>
                <div>
                  <CardTitle className="text-lg">{acc.name}</CardTitle>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{acc.type.replace('_', ' ')} • {acc.person}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold font-mono tracking-tight text-foreground">
                  {formatCurrency(acc.balance || 0)}
                </span>
              </div>
            </CardContent>
            <CardFooter className="pt-0 flex gap-2 border-t border-border/30 px-6 py-4 bg-muted/20">
              <Button variant="secondary" size="sm" className="w-full" onClick={() => handleEdit(acc)}>
                <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(acc.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAcc ? "Edit Account" : "Add Account"}</DialogTitle>
          </DialogHeader>
          <AccountForm account={editingAcc} onSuccess={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
