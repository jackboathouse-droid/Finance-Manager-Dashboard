import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  useGetCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useGetSubcategories,
  useCreateSubcategory,
  useUpdateSubcategory,
  useDeleteSubcategory,
  Category,
  Subcategory,
  CreateCategoryRequestType,
  CreateSubcategoryRequestType,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Layers,
} from "lucide-react";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Name too long"),
  type: z.enum(["income", "expense"]),
});
type CategoryForm = z.infer<typeof categorySchema>;

const subcategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Name too long"),
  category_id: z.coerce.number().min(1, "Parent category is required"),
  type: z.enum(["income", "expense"]),
});
type SubcategoryForm = z.infer<typeof subcategorySchema>;

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-semibold capitalize",
        type === "income"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      )}
    >
      {type}
    </Badge>
  );
}

// ─── Confirm delete dialog (with optional transaction count warning) ──────────

function ConfirmDeleteDialog({
  open,
  label,
  txCount,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  label: string;
  txCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirm deletion
          </DialogTitle>
          <DialogDescription className="pt-1">
            Delete <strong>"{label}"</strong>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {txCount > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3.5 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>{txCount} transaction{txCount !== 1 ? "s" : ""}</strong> are currently using
              this category. They will lose their category assignment if you continue.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category form modal ──────────────────────────────────────────────────────

function CategoryModal({
  open,
  editing,
  existingNames,
  onClose,
}: {
  open: boolean;
  editing: Category | null;
  existingNames: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const form = useForm<CategoryForm>({
    resolver: zodResolver(
      categorySchema.superRefine((data, ctx) => {
        const lower = data.name.trim().toLowerCase();
        const dupes = existingNames
          .filter((n) => n.toLowerCase() !== editing?.name.toLowerCase())
          .map((n) => n.toLowerCase());
        if (dupes.includes(lower)) {
          ctx.addIssue({ code: "custom", path: ["name"], message: "A category with this name already exists" });
        }
      })
    ),
    defaultValues: { name: editing?.name ?? "", type: (editing?.type as "income" | "expense") ?? "expense" },
  });

  useState(() => {
    form.reset({ name: editing?.name ?? "", type: (editing?.type as "income" | "expense") ?? "expense" });
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (values: CategoryForm) => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: { name: values.name, type: values.type as CreateCategoryRequestType } },
        {
          onSuccess: () => { toast({ title: "Category updated" }); invalidate(); handleClose(); },
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { data: { name: values.name, type: values.type as CreateCategoryRequestType } },
        {
          onSuccess: () => { toast({ title: "Category created" }); invalidate(); handleClose(); },
          onError: () => toast({ title: "Failed to create", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the category details below." : "Create a new income or expense category."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Name
            </Label>
            <Input
              placeholder="e.g. Food & Dining"
              className="h-10"
              {...form.register("name")}
              autoFocus
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Type
            </Label>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => form.setValue("type", t)}
                  className={cn(
                    "flex-1 py-2.5 capitalize transition-colors",
                    form.watch("type") === t
                      ? t === "expense"
                        ? "bg-red-500 text-white"
                        : "bg-emerald-500 text-white"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-[100px]">
              {isPending ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Subcategory form modal ───────────────────────────────────────────────────

function SubcategoryModal({
  open,
  editing,
  categories,
  defaultCategoryId,
  existingNames,
  onClose,
}: {
  open: boolean;
  editing: Subcategory | null;
  categories: Category[];
  defaultCategoryId?: number;
  existingNames: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateSubcategory();
  const updateMutation = useUpdateSubcategory();

  const form = useForm<SubcategoryForm>({
    resolver: zodResolver(
      subcategorySchema.superRefine((data, ctx) => {
        const lower = data.name.trim().toLowerCase();
        const dupes = existingNames
          .filter((n) => n.toLowerCase() !== editing?.name.toLowerCase())
          .map((n) => n.toLowerCase());
        if (dupes.includes(lower)) {
          ctx.addIssue({ code: "custom", path: ["name"], message: "A subcategory with this name already exists" });
        }
      })
    ),
    defaultValues: {
      name: editing?.name ?? "",
      category_id: editing?.category_id ?? defaultCategoryId ?? 0,
      type: (editing?.type as "income" | "expense") ?? "expense",
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const selectedCategoryId = form.watch("category_id");

  const onCategoryChange = (val: string) => {
    const id = parseInt(val);
    form.setValue("category_id", id);
    const parent = categories.find((c) => c.id === id);
    if (parent) form.setValue("type", parent.type as "income" | "expense");
  };

  const onSubmit = (values: SubcategoryForm) => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: { name: values.name, category_id: values.category_id, type: values.type as CreateSubcategoryRequestType } },
        {
          onSuccess: () => { toast({ title: "Subcategory updated" }); invalidate(); handleClose(); },
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { data: { name: values.name, category_id: values.category_id, type: values.type as CreateSubcategoryRequestType } },
        {
          onSuccess: () => { toast({ title: "Subcategory created" }); invalidate(); handleClose(); },
          onError: () => toast({ title: "Failed to create", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Subcategory" : "Add Subcategory"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update subcategory details." : "Create a subcategory under an existing category."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Name
            </Label>
            <Input
              placeholder="e.g. Groceries"
              className="h-10"
              {...form.register("name")}
              autoFocus
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parent Category
            </Label>
            <Select
              value={selectedCategoryId ? selectedCategoryId.toString() : ""}
              onValueChange={onCategoryChange}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    <span className="flex items-center gap-2">
                      {cat.name}
                      <span className={cn(
                        "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded",
                        cat.type === "income"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      )}>
                        {cat.type}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category_id && (
              <p className="text-xs text-destructive">{form.formState.errors.category_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Type
            </Label>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => form.setValue("type", t)}
                  className={cn(
                    "flex-1 py-2.5 capitalize transition-colors",
                    form.watch("type") === t
                      ? t === "expense"
                        ? "bg-red-500 text-white"
                        : "bg-emerald-500 text-white"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-[100px]">
              {isPending ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Categories() {
  const { data: categories = [] as Category[], isLoading: loadingCats } = useGetCategories();
  const { data: subcategories = [] as Subcategory[], isLoading: loadingSubs } = useGetSubcategories({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Transaction count maps for delete warnings
  const { data: catTxCounts = {} as Record<number, number> } = useQuery<Record<number, number>>({
    queryKey: ["/api/categories/transaction-counts"],
    queryFn: async () => {
      const res = await fetch("/api/categories/transaction-counts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: subTxCounts = {} as Record<number, number> } = useQuery<Record<number, number>>({
    queryKey: ["/api/subcategories/transaction-counts"],
    queryFn: async () => {
      const res = await fetch("/api/subcategories/transaction-counts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  // Expanded rows (category IDs that show their subcategories)
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Category CRUD state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);
  const deleteCatMutation = useDeleteCategory();

  // Subcategory CRUD state
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [defaultSubCatId, setDefaultSubCatId] = useState<number | undefined>(undefined);
  const [deletingSub, setDeletingSub] = useState<Subcategory | null>(null);
  const deleteSubMutation = useDeleteSubcategory();

  // Category actions
  const openAddCat = () => { setEditingCat(null); setCatModalOpen(true); };
  const openEditCat = (cat: Category) => { setEditingCat(cat); setCatModalOpen(true); };
  const confirmDeleteCat = () => {
    if (!deletingCat) return;
    deleteCatMutation.mutate({ id: deletingCat.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        queryClient.invalidateQueries({ queryKey: ["/api/categories/transaction-counts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        toast({ title: "Category deleted" });
        setDeletingCat(null);
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  // Subcategory actions
  const openAddSub = (categoryId?: number) => {
    setEditingSub(null);
    setDefaultSubCatId(categoryId);
    setSubModalOpen(true);
  };
  const openEditSub = (sub: Subcategory) => { setEditingSub(sub); setDefaultSubCatId(undefined); setSubModalOpen(true); };
  const confirmDeleteSub = () => {
    if (!deletingSub) return;
    deleteSubMutation.mutate({ id: deletingSub.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subcategories/transaction-counts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        toast({ title: "Subcategory deleted" });
        setDeletingSub(null);
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  const categoryNames = categories.map((c) => c.name);
  const subcategoryNames = subcategories.map((s) => s.name);

  // Group subcategories by parent category
  const subsByCategory = subcategories.reduce<Record<number, Subcategory[]>>((acc, sub) => {
    if (!acc[sub.category_id]) acc[sub.category_id] = [];
    acc[sub.category_id].push(sub);
    return acc;
  }, {});

  const isLoading = loadingCats || loadingSubs;

  return (
    <div className="space-y-6 pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage how your transactions are organized and reported.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openAddSub()} className="h-8 gap-1.5" disabled={categories.length === 0}>
            <Layers className="h-3.5 w-3.5" />
            Add Subcategory
          </Button>
          <Button size="sm" onClick={openAddCat} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Hierarchical category tree */}
      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-2.5 bg-muted/40 border-b border-border/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[90px]">Type</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[80px] text-right">Transactions</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[80px] text-center">Actions</span>
        </div>

        {isLoading ? (
          <div className="py-14 text-center text-sm text-muted-foreground">Loading…</div>
        ) : categories.length === 0 ? (
          <div className="py-14 text-center flex flex-col items-center gap-3">
            <Tag className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No categories yet</p>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={openAddCat}>
              Add your first category
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {[...categories]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((cat) => {
                const subs = (subsByCategory[cat.id] ?? []).sort((a, b) => a.name.localeCompare(b.name));
                const hasSubs = subs.length > 0;
                const isOpen = expanded.has(cat.id);
                const txCount = catTxCounts[cat.id] ?? 0;

                return (
                  <div key={cat.id}>
                    {/* Category row */}
                    <div className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Expand/collapse toggle */}
                        <button
                          type="button"
                          onClick={() => hasSubs && toggleExpand(cat.id)}
                          className={cn(
                            "h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
                            hasSubs
                              ? "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                              : "text-muted-foreground/20 cursor-default"
                          )}
                          title={hasSubs ? (isOpen ? "Collapse" : "Expand subcategories") : undefined}
                        >
                          {hasSubs ? (
                            isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                          ) : (
                            <span className="h-3.5 w-3.5 flex items-center justify-center">
                              <span className="h-1 w-1 rounded-full bg-current opacity-30" />
                            </span>
                          )}
                        </button>
                        <span className="font-medium truncate">{cat.name}</span>
                        {hasSubs && (
                          <span className="text-xs text-muted-foreground ml-1 flex-shrink-0">
                            ({subs.length})
                          </span>
                        )}
                      </div>
                      <div className="w-[90px]"><TypeBadge type={cat.type} /></div>
                      <div className="w-[80px] text-right">
                        <span className={cn(
                          "text-sm tabular-nums",
                          txCount > 0 ? "font-medium" : "text-muted-foreground"
                        )}>{txCount}</span>
                      </div>
                      <div className="w-[80px] flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditCat(cat)}
                          title="Edit category"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingCat(cat)}
                          title="Delete category"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => { if (!expanded.has(cat.id)) toggleExpand(cat.id); openAddSub(cat.id); }}
                          title="Add subcategory"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Subcategory rows (expanded) */}
                    {isOpen && subs.length > 0 && (
                      <div className="bg-muted/10 border-t border-border/30">
                        {subs.map((sub) => {
                          const subTxCount = subTxCounts[sub.id] ?? 0;
                          return (
                            <div
                              key={sub.id}
                              className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 pl-12 pr-4 py-2.5 hover:bg-muted/20 transition-colors border-b border-border/20 last:border-0"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Layers className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                                <span className="text-sm truncate">{sub.name}</span>
                              </div>
                              <div className="w-[90px]"><TypeBadge type={sub.type} /></div>
                              <div className="w-[80px] text-right">
                                <span className={cn(
                                  "text-sm tabular-nums",
                                  subTxCount > 0 ? "font-medium" : "text-muted-foreground"
                                )}>{subTxCount}</span>
                              </div>
                              <div className="w-[80px] flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => openEditSub(sub)}
                                  title="Edit subcategory"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeletingSub(sub)}
                                  title="Delete subcategory"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Expanded but empty message */}
                    {isOpen && subs.length === 0 && (
                      <div className="bg-muted/10 border-t border-border/30 pl-12 pr-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>No subcategories.</span>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => openAddSub(cat.id)}
                        >
                          Add one
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Summary */}
      {!isLoading && categories.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {categories.length} {categories.length === 1 ? "category" : "categories"} ·{" "}
          {subcategories.length} {subcategories.length === 1 ? "subcategory" : "subcategories"}
        </p>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      <CategoryModal
        open={catModalOpen}
        editing={editingCat}
        existingNames={categoryNames}
        onClose={() => { setCatModalOpen(false); setEditingCat(null); }}
      />

      <SubcategoryModal
        open={subModalOpen}
        editing={editingSub}
        categories={categories}
        defaultCategoryId={defaultSubCatId}
        existingNames={subcategoryNames}
        onClose={() => { setSubModalOpen(false); setEditingSub(null); setDefaultSubCatId(undefined); }}
      />

      <ConfirmDeleteDialog
        open={!!deletingCat}
        label={deletingCat?.name ?? ""}
        txCount={deletingCat ? (catTxCounts[deletingCat.id] ?? 0) : 0}
        onConfirm={confirmDeleteCat}
        onCancel={() => setDeletingCat(null)}
        isPending={deleteCatMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={!!deletingSub}
        label={deletingSub?.name ?? ""}
        txCount={deletingSub ? (subTxCounts[deletingSub.id] ?? 0) : 0}
        onConfirm={confirmDeleteSub}
        onCancel={() => setDeletingSub(null)}
        isPending={deleteSubMutation.isPending}
      />
    </div>
  );
}
