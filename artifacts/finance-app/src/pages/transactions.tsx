import { useState } from "react";
import { format } from "date-fns";
import Papa from "papaparse";
import { 
  useGetTransactions, 
  useDeleteTransaction,
  useImportTransactions,
  Transaction,
  GetTransactionsType
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
import { Plus, Upload, Search, Edit2, Trash2 } from "lucide-react";
import { TransactionForm } from "@/components/forms/transaction-form";

export default function Transactions() {
  const [month, setMonth] = useState<string>("");
  const [type, setType] = useState<GetTransactionsType | "all">("all");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [csvData, setCsvData] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: transactions, isLoading } = useGetTransactions({ 
    month: month || undefined,
    type: type === "all" ? undefined : type 
  });
  
  const deleteMutation = useDeleteTransaction();
  const importMutation = useImportTransactions();

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          toast({ title: "Transaction deleted" });
        }
      });
    }
  };

  const handleImport = () => {
    if (!csvData) return;
    
    importMutation.mutate({ data: { csv_data: csvData } }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        toast({ 
          title: "Import complete", 
          description: `Imported ${result.imported} transactions. ${result.errors.length} errors.` 
        });
        setIsImportOpen(false);
        setCsvData("");
      },
      onError: (err: any) => {
        toast({ 
          title: "Import failed", 
          description: err.message || "Invalid CSV format", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">Manage and track your cash flow.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="flex-1 sm:flex-none bg-white">
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => { setEditingTx(null); setIsFormOpen(true); }} className="flex-1 sm:flex-none shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Filter by Month</Label>
          <Input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)} 
            className="h-10 bg-background"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Transaction Type</Label>
          <Select value={type} onValueChange={(val: any) => setType(val)}>
            <SelectTrigger className="h-10 bg-background">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="expense">Expenses Only</SelectItem>
              <SelectItem value="income">Income Only</SelectItem>
              <SelectItem value="transfer">Transfers Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Loading transactions...
                  </TableCell>
                </TableRow>
              ) : transactions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center">
                      <img src={`${import.meta.env.BASE_URL}images/empty-state.png`} alt="Empty" className="w-24 h-24 opacity-40 mb-4" />
                      <p className="text-muted-foreground font-medium">No transactions found</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting filters or add a new one.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transactions?.map((tx) => (
                  <TableRow key={tx.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      {format(new Date(tx.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{tx.description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{tx.person}</div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground">
                        {tx.category_name || 'Uncategorized'}
                      </div>
                      {tx.subcategory_name && (
                        <span className="text-xs text-muted-foreground ml-2">› {tx.subcategory_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tx.account_name}</TableCell>
                    <TableCell className={cn(
                      "text-right font-medium font-mono tracking-tight",
                      tx.type === 'expense' ? "text-destructive" : 
                      tx.type === 'income' ? "text-success" : 
                      "text-muted-foreground"
                    )}>
                      {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                      {formatCurrency(Math.abs(tx.amount))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(tx)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(tx.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Transaction Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingTx ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>
          <TransactionForm 
            transaction={editingTx} 
            onSuccess={() => setIsFormOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Paste CSV Data</Label>
              <textarea 
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                placeholder="date,description,account_id,category_id,amount,person,type..."
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Required columns: date, description, account_id, amount, person, type (income|expense|transfer)
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
              <Button onClick={handleImport} disabled={!csvData || importMutation.isPending}>
                {importMutation.isPending ? "Importing..." : "Run Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
