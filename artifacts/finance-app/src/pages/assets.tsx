import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Scale,
  Home,
  Car,
  BarChart2,
  Landmark,
  CreditCard,
  Briefcase,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ManualAsset {
  id: number;
  user_id: number;
  name: string;
  type: "asset" | "liability";
  category: string;
  value: string;
  created_at: string;
}

const ASSET_CATEGORIES = [
  "Property",
  "Vehicle",
  "Investment",
  "Savings",
  "Business",
  "Valuables",
  "Other",
];

const LIABILITY_CATEGORIES = [
  "Mortgage",
  "Personal Loan",
  "Car Finance",
  "Student Loan",
  "Credit Card Debt",
  "Other",
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Property: Home,
  Vehicle: Car,
  Investment: BarChart2,
  Savings: Landmark,
  Business: Briefcase,
  Valuables: Package,
  Mortgage: Home,
  "Personal Loan": CreditCard,
  "Car Finance": Car,
  "Student Loan": Briefcase,
  "Credit Card Debt": CreditCard,
  Other: Package,
};

interface AssetFormData {
  name: string;
  type: "asset" | "liability";
  category: string;
  value: string;
}

const DEFAULT_FORM: AssetFormData = {
  name: "",
  type: "asset",
  category: "Other",
  value: "",
};

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed");
  }
  return res.json();
}

export default function AssetsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManualAsset | null>(null);
  const [form, setForm] = useState<AssetFormData>(DEFAULT_FORM);

  const { data: items = [], isLoading } = useQuery<ManualAsset[]>({
    queryKey: ["assets"],
    queryFn: () => apiFetch(`${BASE}/api/assets`),
  });

  const createMutation = useMutation({
    mutationFn: (data: AssetFormData) =>
      apiFetch(`${BASE}/api/assets`, {
        method: "POST",
        body: JSON.stringify({ ...data, value: parseFloat(data.value) || 0 }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard/net-worth"] });
      toast({ title: "Item added" });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssetFormData }) =>
      apiFetch(`${BASE}/api/assets/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...data, value: parseFloat(data.value) || 0 }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard/net-worth"] });
      toast({ title: "Item updated" });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`${BASE}/api/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard/net-worth"] });
      toast({ title: "Item deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setIsDialogOpen(true);
  };

  const openEdit = (item: ManualAsset) => {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      category: item.category || "Other",
      value: item.value,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditing(null);
    setForm(DEFAULT_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.value) return;
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (item: ManualAsset) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    deleteMutation.mutate(item.id);
  };

  const assets = items.filter((i) => i.type === "asset");
  const liabilities = items.filter((i) => i.type === "liability");
  const totalAssets = assets.reduce((s, i) => s + parseFloat(i.value ?? "0"), 0);
  const totalLiabilities = liabilities.reduce((s, i) => s + parseFloat(i.value ?? "0"), 0);
  const net = totalAssets - totalLiabilities;

  const categories = form.type === "asset" ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets & Liabilities</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track what you own and what you owe to get your true net worth.
          </p>
        </div>
        <Button onClick={openAdd} className="shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Assets</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">{formatCurrency(totalAssets)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Liabilities</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400 truncate">{formatCurrency(totalLiabilities)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-border/50",
          net >= 0 ? "bg-primary/5 border-primary/20" : "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50"
        )}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
                net >= 0 ? "bg-primary/10" : "bg-red-100 dark:bg-red-900/40"
              )}>
                <Scale className={cn("h-4.5 w-4.5", net >= 0 ? "text-primary" : "text-red-600 dark:text-red-400")} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net</p>
                <p className={cn("text-xl font-bold truncate", net >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400")}>
                  {formatCurrency(net)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Assets</span>
          <div className="flex-1 h-px bg-emerald-200 dark:bg-emerald-800/50" />
          <span className="text-xs text-muted-foreground">{assets.length} item{assets.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-8 w-8 opacity-30" />
              <p className="text-sm">No assets yet. Add property, investments, vehicles and more.</p>
              <Button variant="outline" size="sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Asset
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {assets.map((item) => (
              <AssetRow key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Liabilities section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Liabilities</span>
          <div className="flex-1 h-px bg-red-200 dark:bg-red-800/50" />
          <span className="text-xs text-muted-foreground">{liabilities.length} item{liabilities.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1].map((i) => (
              <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : liabilities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <TrendingDown className="h-8 w-8 opacity-30" />
              <p className="text-sm">No liabilities yet. Add mortgages, loans, and other debts.</p>
              <Button variant="outline" size="sm" onClick={() => { openAdd(); setForm((f) => ({ ...f, type: "liability", category: "Other" })); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Liability
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {liabilities.map((item) => (
              <AssetRow key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Form dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["asset", "liability"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t, category: t === "asset" ? "Other" : "Other" }))}
                    className={cn(
                      "py-2 rounded-lg border text-sm font-medium transition-all",
                      form.type === t
                        ? t === "asset"
                          ? "bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-300"
                          : "bg-red-100 border-red-400 text-red-700 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300"
                        : "bg-muted/40 border-input text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {t === "asset" ? "Asset" : "Liability"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder={form.type === "asset" ? "e.g. Home, Savings ISA, Tesla" : "e.g. Mortgage, Student Loan"}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            {/* Value */}
            <div className="space-y-1.5">
              <Label htmlFor="value">Current Value (£)</Label>
              <Input
                id="value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="flex-1">
                {isSaving ? "Saving…" : editing ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ManualAsset;
  onEdit: (item: ManualAsset) => void;
  onDelete: (item: ManualAsset) => void;
}) {
  const isAsset = item.type === "asset";
  const cat = item.category || "Other";
  const Icon = CATEGORY_ICONS[cat] ?? Package;

  return (
    <Card className="border-border/50 hover:border-border/80 transition-colors">
      <CardContent className="py-0 px-4">
        <div className="flex items-center gap-3 h-16">
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
            isAsset
              ? "bg-emerald-100 dark:bg-emerald-900/30"
              : "bg-red-100 dark:bg-red-900/30"
          )}>
            <Icon className={cn("h-4.5 w-4.5", isAsset ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">{cat}</p>
          </div>
          <p className={cn(
            "text-sm font-bold mr-3",
            isAsset ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}>
            {isAsset ? "+" : "-"}{formatCurrency(parseFloat(item.value ?? "0"))}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(item)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
