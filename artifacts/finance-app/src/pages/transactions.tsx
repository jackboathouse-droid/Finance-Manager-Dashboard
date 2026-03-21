import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  useGetTransactions,
  useGetAccounts,
  useGetCategories,
  useDeleteTransaction,
  useImportTransactions,
  Transaction,
  GetTransactionsType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Edit2, Trash2, X } from "lucide-react";
import { TransactionForm } from "@/components/forms/transaction-form";
import { Badge } from "@/components/ui/badge";

export default function Transactions() {
  const [month, setMonth] = useState<string>("");
  const [type, setType] = useState<GetTransactionsType | "all">("all");
  const [accountId, setAccountId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [csvData, setCsvData] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts } = useGetAccounts();
  const { data: categories } = useGetCategories();

  const { data: transactions, isLoading } = useGetTransactions({
    month: month || undefined,
    type: type === "all" ? undefined : type,
    account_id: accountId !== "all" ? parseInt(accountId) : undefined,
    category_id: categoryId !== "all" ? parseInt(categoryId) : undefined,
  });

  const deleteMutation = useDeleteTransaction();
  const importMutation = useImportTransactions();

  const showingByAccount = accountId !== "all";

  // Compute running balance when filtering by a specific account
  const runningBalanceMap = useMemo(() => {
    if (!showingByAccount || !transactions) return null;

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let balance = 0;
    const map: Record<number, number> = {};
    for (const tx of sorted) {
      balance += tx.amount;
      map[tx.id] = balance;
    }
    return map;
  }, [transactions, showingByAccount]);

  const hasActiveFilters =
    !!month || type !== "all" || accountId !== "all" || categoryId !== "all";

  const clearFilters = () => {
    setMonth("");
    setType("all");
    setAccountId("all");
    setCategoryId("all");
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Transaction deleted" });
          },
        }
      );
    }
  };

  const handleImport = () => {
    if (!csvData) return;
    importMutation.mutate(
      { data: { csv_data: csvData } },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
          toast({
            title: "Import complete",
            description: `Imported ${result.imported} transactions. ${result.errors.length} errors.`,
          });
          setIsImportOpen(false);
          setCsvData("");
        },
        onError: (err: any) => {
          toast({
            title: "Import failed",
            description: err.message || "Invalid CSV format",
            variant: "destructive",
          });
        },
      }
    );
  };

  const colSpan = showingByAccount ? 7 : 6;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isLoading ? "Loading…" : `${transactions?.length ?? 0} transactions`}
            {hasActiveFilters && " · filtered"}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button
            onClick={() => {
              setEditingTx(null);
              setIsFormOpen(true);
            }}
            className="flex-1 sm:flex-none"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Month
            </Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 bg-background text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Account
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9 bg-background text-sm">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Category
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 bg-background text-sm">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Type
            </Label>
            <div className="flex items-center gap-2">
              <Select value={type} onValueChange={(val: any) => setType(val)}>
                <SelectTrigger className="h-9 bg-background text-sm flex-1">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfers</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                  title="Clear filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        {showingByAccount && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            Running balance column shown for{" "}
            <strong>{accounts?.find((a) => a.id.toString() === accountId)?.name}</strong>
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider">
                  Date
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                  Description
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                  Category
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                  Account
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">
                  Amount
                </TableHead>
                {showingByAccount && (
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-blue-500">
                    Balance
                  </TableHead>
                )}
                <TableHead className="w-[90px] text-center text-xs font-semibold uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground text-sm">
                    Loading transactions…
                  </TableCell>
                </TableRow>
              ) : transactions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-16">
                    <div className="flex flex-col items-center">
                      <img
                        src={`${import.meta.env.BASE_URL}images/empty-state.png`}
                        alt="Empty"
                        className="w-20 h-20 opacity-40 mb-3"
                      />
                      <p className="text-muted-foreground font-medium text-sm">
                        No transactions found
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {hasActiveFilters
                          ? "Try adjusting your filters."
                          : "Add your first transaction to get started."}
                      </p>
                      {hasActiveFilters && (
                        <Button
                          variant="link"
                          className="mt-2 text-xs h-auto p-0"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transactions?.map((tx) => {
                  const balance = runningBalanceMap?.[tx.id];
                  return (
                    <TableRow key={tx.id} className="group hover:bg-muted/20 transition-colors">
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {format(new Date(tx.date + "T00:00:00"), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm leading-tight">{tx.description}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{tx.person}</div>
                      </TableCell>
                      <TableCell>
                        {tx.category_name ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="secondary" className="w-fit text-xs font-medium py-0 px-2">
                              {tx.category_name}
                            </Badge>
                            {tx.subcategory_name && (
                              <span className="text-xs text-muted-foreground pl-0.5">
                                › {tx.subcategory_name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Uncategorized</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.account_name}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold font-mono text-sm tabular-nums",
                          tx.type === "expense"
                            ? "text-red-600 dark:text-red-400"
                            : tx.type === "income"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                        )}
                      >
                        {tx.type === "expense" ? "−" : tx.type === "income" ? "+" : ""}
                        {formatCurrency(Math.abs(tx.amount))}
                      </TableCell>
                      {showingByAccount && (
                        <TableCell
                          className={cn(
                            "text-right font-mono text-sm tabular-nums font-medium",
                            balance !== undefined && balance >= 0
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {balance !== undefined ? formatCurrency(balance) : "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEdit(tx)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(tx.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* Footer count */}
        {transactions && transactions.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/30 bg-muted/20 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
            </span>
            {showingByAccount && runningBalanceMap && (
              <span className="text-xs text-muted-foreground">
                Current balance:{" "}
                <strong className="text-blue-600">
                  {formatCurrency(
                    accounts?.find((a) => a.id.toString() === accountId)?.balance ?? 0
                  )}
                </strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Transaction Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingTx ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>
          <TransactionForm transaction={editingTx} onSuccess={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Import Transactions from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Required CSV columns:</p>
              <p className="font-mono">
                date, description, account_id, amount, person, type
              </p>
              <p className="font-semibold text-foreground mt-2">Optional columns:</p>
              <p className="font-mono">category_id, subcategory_id</p>
              <p className="mt-2">
                • <code>type</code>: income | expense | transfer
              </p>
              <p>• Expenses should have negative amounts</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Paste CSV Data
              </Label>
              <textarea
                className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder={"date,description,account_id,amount,person,type\n2024-03-01,Groceries,1,-65.50,John,expense"}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!csvData || importMutation.isPending}>
                {importMutation.isPending ? "Importing…" : "Run Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
