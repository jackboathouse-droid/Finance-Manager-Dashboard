import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import {
  useGetTransactions,
  useGetAccounts,
  useGetCategories,
  useDeleteTransaction,
  useImportTransactions,
  Transaction,
  GetTransactionsType,
  Category,
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
import { Plus, Upload, Edit2, Trash2, X, Sparkles, Loader2 } from "lucide-react";
import { TransactionForm } from "@/components/forms/transaction-form";
import { Badge } from "@/components/ui/badge";

// ── CSV import types ──────────────────────────────────────────────────────────

interface CsvRow {
  date: string;
  description: string;
  account_id: string;
  amount: string;
  person: string;
  type: string;
  category_id?: string;
  subcategory_id?: string;
  // AI-suggested category (pre-filled, user-overridable)
  ai_category_id?: string;
  ai_category_name?: string;
  ai_loading?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCsv(raw: string): CsvRow[] {
  const lines = raw.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row as CsvRow;
  });
}

export default function Transactions() {
  const [month, setMonth] = useState<string>("");
  const [type, setType] = useState<GetTransactionsType | "all">("all");
  const [accountId, setAccountId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [csvData, setCsvData] = useState("");

  // CSV import preview state
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);
  const [aiRunning, setAiRunning] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts } = useGetAccounts();
  const { data: categories = [] as Category[] } = useGetCategories();

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

  // ── CSV Preview + AI categorisation ────────────────────────────────────────

  const runAiOnRows = useCallback(async (rows: CsvRow[]) => {
    setAiRunning(true);
    const updated = [...rows];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      // Skip if already has a category or is a transfer
      if (row.category_id || row.type === "transfer" || !row.description) continue;

      // Mark as loading
      updated[i] = { ...row, ai_loading: true };
      setPreviewRows([...updated]);

      try {
        const res = await fetch("/api/ai/categorise", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: row.description,
            amount: row.amount ? Math.abs(parseFloat(row.amount)) : undefined,
            type: row.type || "expense",
          }),
        });

        if (res.ok) {
          const suggestion: { category_id: number; category_name: string } | null = await res.json();
          if (suggestion) {
            updated[i] = {
              ...updated[i],
              ai_loading: false,
              ai_category_id: suggestion.category_id.toString(),
              ai_category_name: suggestion.category_name,
              // Pre-fill category_id with suggestion (user can override)
              category_id: suggestion.category_id.toString(),
            };
          } else {
            updated[i] = { ...updated[i], ai_loading: false };
          }
        } else {
          updated[i] = { ...updated[i], ai_loading: false };
          // 429 rate limit — stop trying more rows
          if (res.status === 429) break;
        }
      } catch {
        updated[i] = { ...updated[i], ai_loading: false };
      }

      setPreviewRows([...updated]);
      // Small delay between calls to avoid rate limit burst
      if (i < updated.length - 1) await new Promise((r) => setTimeout(r, 200));
    }

    setAiRunning(false);
  }, []);

  const handleParseCsv = useCallback(() => {
    const rows = parseCsv(csvData);
    if (rows.length === 0) return;
    setPreviewRows(rows);
    // Auto-run AI after a short delay
    setTimeout(() => runAiOnRows(rows), 100);
  }, [csvData, runAiOnRows]);

  const handlePreviewCategoryChange = useCallback((rowIndex: number, catId: string) => {
    setPreviewRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], category_id: catId };
      return updated;
    });
  }, []);

  // Build CSV from preview rows and submit
  const handleImportFromPreview = useCallback(() => {
    if (previewRows.length === 0) return;
    const headers = ["date", "description", "account_id", "amount", "person", "type", "category_id", "subcategory_id"];
    const lines = [
      headers.join(","),
      ...previewRows.map((r) =>
        [r.date, r.description, r.account_id, r.amount, r.person, r.type, r.category_id ?? "", r.subcategory_id ?? ""].join(",")
      ),
    ];
    const csv = lines.join("\n");

    importMutation.mutate(
      { data: { csv_data: csv } },
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
          setPreviewRows([]);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Invalid CSV format";
          toast({ title: "Import failed", description: msg, variant: "destructive" });
        },
      }
    );
  }, [previewRows, importMutation, queryClient, toast]);

  const handleImportDirect = useCallback(() => {
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
          setPreviewRows([]);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Invalid CSV format";
          toast({ title: "Import failed", description: msg, variant: "destructive" });
        },
      }
    );
  }, [csvData, importMutation, queryClient, toast]);

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
            onClick={() => { setIsImportOpen(true); setPreviewRows([]); setCsvData(""); }}
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
              <Select value={type} onValueChange={(val) => setType(val as GetTransactionsType | "all")}>
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
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mb-1">
                        <Upload className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-muted-foreground font-medium text-sm">
                        {hasActiveFilters ? "No transactions match your filters" : "No transactions yet"}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {hasActiveFilters
                          ? "Try adjusting your filters to see more results."
                          : "Add a transaction manually or import from CSV to get started."}
                      </p>
                      {hasActiveFilters ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </Button>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => { setEditingTx(null); setIsFormOpen(true); }}
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Transaction
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsImportOpen(true)}
                          >
                            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV
                          </Button>
                        </div>
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
      <Dialog open={isImportOpen} onOpenChange={(open) => {
        setIsImportOpen(open);
        if (!open) { setCsvData(""); setPreviewRows([]); }
      }}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Transactions from CSV</DialogTitle>
          </DialogHeader>

          {previewRows.length === 0 ? (
            /* ── Step 1: Paste CSV ──────────────────────────────────────── */
            <div className="space-y-4 pt-2">
              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Required CSV columns:</p>
                <p className="font-mono">date, description, account_id, amount, person, type</p>
                <p className="font-semibold text-foreground mt-2">Optional columns:</p>
                <p className="font-mono">category_id, subcategory_id</p>
                <p className="mt-2">• <code>type</code>: income | expense | transfer</p>
                <p>• Expenses should have negative amounts</p>
                <p className="flex items-center gap-1 mt-1 text-[#4FC3F7]">
                  <Sparkles className="h-3 w-3" />
                  Categories will be suggested automatically by AI
                </p>
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
                <Button
                  onClick={handleParseCsv}
                  disabled={!csvData.trim()}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Preview & Auto-Categorise
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleImportDirect}
                  disabled={!csvData || importMutation.isPending}
                  title="Import without preview or AI categorisation"
                >
                  {importMutation.isPending ? "Importing…" : "Import Directly"}
                </Button>
              </div>
            </div>
          ) : (
            /* ── Step 2: Preview table with AI suggestions ──────────────── */
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {previewRows.length} rows parsed
                  </p>
                  {aiRunning && (
                    <span className="flex items-center gap-1.5 text-xs text-[#4FC3F7] animate-pulse">
                      <Sparkles className="h-3 w-3" />
                      AI categorising…
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setPreviewRows([])}
                >
                  ← Back to paste
                </Button>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[45vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-[#4FC3F7]" /> Category
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/10">
                          <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.date}</td>
                          <td className="px-3 py-2 max-w-[180px]">
                            <div className="truncate font-medium">{row.description}</div>
                            <div className="text-muted-foreground">{row.person}</div>
                          </td>
                          <td className={cn(
                            "px-3 py-2 tabular-nums font-mono",
                            parseFloat(row.amount) < 0 ? "text-red-500" : "text-emerald-600"
                          )}>
                            {formatCurrency(Math.abs(parseFloat(row.amount) || 0))}
                          </td>
                          <td className="px-3 py-2 min-w-[180px]">
                            {row.ai_loading ? (
                              <span className="flex items-center gap-1 text-muted-foreground animate-pulse">
                                <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <Select
                                  value={row.category_id ?? "none"}
                                  onValueChange={(val) => handlePreviewCategoryChange(i, val === "none" ? "" : val)}
                                >
                                  <SelectTrigger className="h-7 text-xs border-border/50">
                                    <SelectValue placeholder="No category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No category</SelectItem>
                                    {categories
                                      .filter((c) => !row.type || row.type === "transfer" || c.type === row.type)
                                      .map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>
                                          {cat.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                {row.ai_category_id && row.category_id === row.ai_category_id && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-[#4FC3F7]">
                                    <Sparkles className="h-2.5 w-2.5" /> AI suggested
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImportFromPreview}
                  disabled={importMutation.isPending || aiRunning}
                >
                  {importMutation.isPending ? "Importing…" : `Import ${previewRows.length} Transactions`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
