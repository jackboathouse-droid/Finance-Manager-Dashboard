import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetAccounts } from "@workspace/api-client-react";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  MoreVertical,
  Plane,
  Home,
  Briefcase,
  Car,
  PiggyBank,
  Heart,
  Star,
  Coffee,
  ShoppingBag,
  GraduationCap,
  Zap,
  Gift,
  Wallet,
  Umbrella,
  Camera,
  Target,
  Pause,
  Play,
  CheckCircle,
  Trash2,
  Edit2,
  Bell,
  TrendingUp,
  Calendar,
  DollarSign,
  Trophy,
  ChevronDown,
  History,
  ArrowUpRight,
  Landmark,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
  progress_pct: number;
  status: string;
  deadline: string | null;
  created_at: string;
  milestone_notified: number;
}

interface Contribution {
  id: number;
  project_id: number;
  amount: number;
  note: string | null;
  account_id: number | null;
  account_name: string | null;
  contributed_at: string;
}

// ── Icon registry ─────────────────────────────────────────────────────────────

const ICONS: { key: string; Component: React.ElementType }[] = [
  { key: "plane",          Component: Plane },
  { key: "home",           Component: Home },
  { key: "briefcase",      Component: Briefcase },
  { key: "car",            Component: Car },
  { key: "piggy-bank",     Component: PiggyBank },
  { key: "heart",          Component: Heart },
  { key: "star",           Component: Star },
  { key: "coffee",         Component: Coffee },
  { key: "shopping-bag",   Component: ShoppingBag },
  { key: "graduation-cap", Component: GraduationCap },
  { key: "zap",            Component: Zap },
  { key: "gift",           Component: Gift },
  { key: "wallet",         Component: Wallet },
  { key: "umbrella",       Component: Umbrella },
  { key: "camera",         Component: Camera },
  { key: "target",         Component: Target },
];

const COLORS = [
  "#4FC3F7", "#10B981", "#8B5CF6", "#F59E0B",
  "#EF4444", "#EC4899", "#06B6D4", "#F97316",
  "#84CC16", "#6366F1",
];

// ── Progress bar color ────────────────────────────────────────────────────────

function progressColor(pct: number, brandColor: string): string {
  if (pct >= 75) return "#10B981"; // green
  if (pct >= 25) return "#F59E0B"; // amber
  return "#EF4444";                // red
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function IconComp({ icon, className, style }: { icon: string; className?: string; style?: React.CSSProperties }) {
  const found = ICONS.find((i) => i.key === icon);
  const C = found?.Component ?? PiggyBank;
  return <C className={className} style={style} />;
}

function statusBadge(status: string) {
  if (status === "completed")
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs">Completed</Badge>;
  if (status === "paused")
    return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-xs">Paused</Badge>;
  return <Badge className="bg-primary/10 text-primary border-0 text-xs">Active</Badge>;
}

async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function sendMilestoneNotification(project: Project, milestone: number) {
  const isComplete = milestone === 100;
  const title = isComplete ? `🎉 ${project.name} Complete!` : `🎯 ${milestone}% milestone reached!`;
  const body = isComplete
    ? `Congratulations! You've fully funded your ${project.name} goal!`
    : `You're ${milestone}% of the way to your ${project.name} goal. Keep going!`;
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

// ── Create/Edit modal ─────────────────────────────────────────────────────────

function ProjectModal({
  open, onClose, existing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Project | null;
  onSaved: () => void;
}) {
  const [name, setName]             = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [icon, setIcon]             = useState(existing?.icon ?? "piggy-bank");
  const [color, setColor]           = useState(existing?.color ?? "#4FC3F7");
  const [target, setTarget]         = useState(existing ? String(existing.target_amount) : "");
  const [deadline, setDeadline]     = useState(existing?.deadline ?? "");
  const [startBal, setStartBal]     = useState("0");
  const [accountId, setAccountId]   = useState<string>("none");
  const [loading, setLoading]       = useState(false);
  const { toast }                   = useToast();

  const isEdit = !!existing;
  const { data: accounts = [] } = useGetAccounts();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tgt = parseFloat(target);
    const sb  = parseFloat(startBal) || 0;
    if (!name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (isNaN(tgt) || tgt <= 0) return toast({ title: "Enter a valid target amount", variant: "destructive" });

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name, description, icon, color, target_amount: tgt, deadline: deadline || null,
      };
      if (!isEdit && sb > 0) {
        payload.starting_balance = sb;
        if (accountId !== "none") payload.account_id = parseInt(accountId);
      }

      const url = isEdit ? `/api/projects/${existing.id}` : "/api/projects";
      const method = isEdit ? "PUT" : "POST";
      const result = await apiFetch<{ milestone?: number | null; completed?: boolean } & Project>(method, url, payload);

      onSaved();
      onClose();

      if (!isEdit && result.milestone) {
        toast({
          title: `${result.milestone}% funded! 🎉`,
          description: `Your starting balance puts ${name} at ${result.milestone}% already!`,
          duration: 5000,
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sbNum = parseFloat(startBal) || 0;
  const tgtNum = parseFloat(target) || 0;
  const startPct = tgtNum > 0 ? Math.min(100, Math.round((sbNum / tgtNum) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Goal" : "New Savings Goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Goal name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Holiday Fund" autoFocus />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you saving for?" rows={2} className="resize-none" />
          </div>

          {/* Icon grid */}
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICONS.map(({ key, Component }) => (
                <button key={key} type="button" onClick={() => setIcon(key)}
                  className={cn("h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                    icon === key ? "ring-2 ring-primary ring-offset-1" : "bg-muted/50 hover:bg-muted")}
                  style={icon === key ? { backgroundColor: color + "22" } : undefined}>
                  <Component className="h-4 w-4" style={icon === key ? { color } : undefined} />
                </button>
              ))}
            </div>
          </div>

          {/* Colour */}
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn("h-7 w-7 rounded-full transition-all",
                    color === c ? "ring-2 ring-offset-2 ring-foreground/40 scale-110" : "hover:scale-105")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50" style={{ background: color + "15" }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "30" }}>
              <IconComp icon={icon} className="h-5 w-5" style={{ color }} />
            </div>
            <span className="font-semibold text-sm">{name || "Your goal"}</span>
          </div>

          {/* Target + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target amount ($)</Label>
              <Input type="number" min="1" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10,000" />
            </div>
            <div className="space-y-1.5">
              <Label>Deadline <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          {/* Starting balance — create mode only */}
          {!isEdit && (
            <div className="rounded-xl border border-border/60 p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Starting balance (optional)</p>

              <div className="space-y-1.5">
                <Label className="text-sm">Amount already saved ($)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" min="0" step="0.01" value={startBal} onChange={(e) => setStartBal(e.target.value)} placeholder="0.00" className="pl-7" />
                </div>
                {sbNum > 0 && tgtNum > 0 && (
                  <p className="text-xs text-muted-foreground">
                    This puts your goal at <span className="font-semibold text-foreground">{startPct}%</span> right from the start.
                  </p>
                )}
              </div>

              {sbNum > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Deduct from account <span className="text-muted-foreground">(optional)</span></Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Don't deduct from any account</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name} — {formatCurrency(a.balance ?? 0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This will create a transfer transaction reducing that account's balance.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Contribute modal ──────────────────────────────────────────────────────────

const QUICK_AMOUNTS = [50, 100, 250, 500];

function ContributeModal({
  project, onClose, onContributed,
}: {
  project: Project;
  onClose: () => void;
  onContributed: (milestone: number | null, completed: boolean) => void;
}) {
  const [amount, setAmount]       = useState("");
  const [note, setNote]           = useState("");
  const [accountId, setAccountId] = useState<string>("none");
  const [loading, setLoading]     = useState(false);
  const { toast }                 = useToast();

  const { data: accounts = [] }   = useGetAccounts();
  const remaining = project.target_amount - project.current_amount;
  const amt       = parseFloat(amount) || 0;

  const selectedAccount = accounts.find((a) => String(a.id) === accountId);
  const accountBalanceAfter = selectedAccount ? (selectedAccount.balance ?? 0) - amt : null;

  const progressAfter = Math.min(
    100,
    Math.round(((project.current_amount + amt) / project.target_amount) * 100)
  );

  const barColor = progressColor(progressAfter, project.color);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(amt) || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    if (amt > remaining + 0.01) return toast({
      title: "Amount exceeds remaining goal",
      description: `Only ${formatCurrency(remaining)} left to reach your target.`,
      variant: "destructive",
    });
    if (accountId !== "none" && accountBalanceAfter !== null && accountBalanceAfter < 0) {
      return toast({
        title: "Insufficient funds",
        description: `${selectedAccount?.name} only has ${formatCurrency(selectedAccount?.balance ?? 0)}.`,
        variant: "destructive",
      });
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { amount: amt, note: note.trim() || undefined };
      if (accountId !== "none") body.account_id = parseInt(accountId);

      const data = await apiFetch<{
        contribution: unknown;
        project: Project;
        milestone: number | null;
        completed: boolean;
      }>("POST", `/api/projects/${project.id}/contributions`, body);

      onContributed(data.milestone, data.completed);
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: project.color + "30" }}>
              <IconComp icon={project.icon} className="h-4 w-4" style={{ color: project.color }} />
            </div>
            Add funds to {project.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Current → After progress preview */}
          <div className="rounded-xl border border-border/50 p-3 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Current: <span className="font-medium text-foreground">{formatCurrency(project.current_amount)}</span></span>
              <span>Goal: {formatCurrency(project.target_amount)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressAfter}%`, backgroundColor: barColor }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">After contribution</span>
              <span className="text-sm font-bold" style={{ color: barColor }}>{progressAfter}%</span>
            </div>
          </div>

          {/* Quick-add amounts */}
          <div className="space-y-1.5">
            <Label>Quick add</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={q > remaining + 0.01}
                  onClick={() => setAmount(String(q))}
                  className={cn(
                    "h-8 rounded-lg text-xs font-semibold border transition-all",
                    amount === String(q)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 hover:bg-muted border-border/60 disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                >
                  ${q}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min="0.01" step="0.01"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Up to ${formatCurrency(remaining)}`}
                  className="pl-7" autoFocus
                />
              </div>
              <Button type="button" variant="outline" size="sm" className="text-xs px-2 h-9 shrink-0"
                onClick={() => setAmount(remaining.toFixed(2))}>
                Full
              </Button>
            </div>
            {amt > 0 && (
              <p className="text-xs text-muted-foreground">
                After: {formatCurrency(Math.min(project.current_amount + amt, project.target_amount))} saved
                {project.target_amount - project.current_amount - amt > 0.01
                  ? ` · ${formatCurrency(Math.max(0, project.target_amount - project.current_amount - amt))} remaining`
                  : " · 🎉 Goal complete!"}
              </p>
            )}
          </div>

          {/* Source account */}
          <div className="space-y-1.5">
            <Label>Source account <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account (manual entry)</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    <span className="flex items-center gap-1.5">
                      <Landmark className="h-3 w-3 text-muted-foreground" />
                      {a.name} — {formatCurrency(a.balance ?? 0)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accountId !== "none" && selectedAccount && amt > 0 && (
              <p className={cn("text-xs", accountBalanceAfter! < 0 ? "text-destructive" : "text-muted-foreground")}>
                {selectedAccount.name} balance after: {formatCurrency(accountBalanceAfter!)}
                {accountBalanceAfter! < 0 && " — insufficient funds!"}
              </p>
            )}
            {accountId !== "none" && (
              <p className="text-xs text-muted-foreground">
                A transfer transaction will be created on this account.
              </p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly top-up" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || amt <= 0}>
              {loading ? "Adding…" : `Add ${amt > 0 ? formatCurrency(amt) : "funds"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Contribution history ──────────────────────────────────────────────────────

function ContributionHistory({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);

  const { data: contribs = [], isLoading } = useQuery<Contribution[]>({
    queryKey: ["projects", projectId, "contributions"],
    queryFn: () => apiFetch("GET", `/api/projects/${projectId}/contributions`),
    enabled: open,
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 w-full">
          <History className="h-3 w-3" />
          <span>History</span>
          <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {isLoading ? (
          <div className="text-xs text-muted-foreground py-1">Loading…</div>
        ) : contribs.length === 0 ? (
          <div className="text-xs text-muted-foreground py-1">No contributions yet.</div>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
            {contribs.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">
                      {c.note || (c.account_name ? `From ${c.account_name}` : "Manual entry")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.contributed_at), "d MMM yyyy")}
                      {c.account_name && !c.note && ""}
                      {c.account_name && ` · ${c.account_name}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-500 flex-shrink-0 ml-2">
                  +{formatCurrency(c.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project, onContribute, onEdit, onStatusChange, onDelete,
}: {
  project: Project;
  onContribute: (p: Project) => void;
  onEdit: (p: Project) => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const daysLeft =
    project.deadline && project.status === "active"
      ? differenceInDays(parseISO(project.deadline), new Date())
      : null;

  const isCompleted = project.status === "completed";
  const isPaused    = project.status === "paused";
  const barColor    = progressColor(project.progress_pct, project.color);

  return (
    <Card className={cn(
      "relative overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md",
      isCompleted && "ring-1 ring-emerald-500/20"
    )}>
      {/* Color accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: project.color }} />

      <CardContent className="pt-5 pb-4 px-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: project.color + "25" }}>
              <IconComp icon={project.icon} className="h-5 w-5" style={{ color: project.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {statusBadge(project.status)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(project)}>
                  <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                {!isCompleted && (
                  <DropdownMenuItem onClick={() => onStatusChange(project.id, isPaused ? "active" : "paused")}>
                    {isPaused ? <><Play className="h-3.5 w-3.5 mr-2" /> Resume</> : <><Pause className="h-3.5 w-3.5 mr-2" /> Pause</>}
                  </DropdownMenuItem>
                )}
                {!isCompleted && (
                  <DropdownMenuItem onClick={() => onStatusChange(project.id, "completed")}>
                    <CheckCircle className="h-3.5 w-3.5 mr-2" /> Mark complete
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(project.id)} className="text-red-500 focus:text-red-500">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold">{formatCurrency(project.current_amount)}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
              {project.progress_pct}%
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{
                width: `${project.progress_pct}%`,
                backgroundColor: barColor,
                boxShadow: `0 0 8px ${barColor}60`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Saved</span>
            <span>Goal: {formatCurrency(project.target_amount)}</span>
          </div>
        </div>

        {/* Deadline / completion */}
        {isCompleted ? (
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium mb-2">
            <Trophy className="h-3.5 w-3.5" />
            <span>Goal achieved! 🏆</span>
          </div>
        ) : project.deadline ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {daysLeft !== null && daysLeft >= 0
                ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left · `
                : "Overdue · "}
              {format(parseISO(project.deadline), "d MMM yyyy")}
            </span>
          </div>
        ) : null}

        {/* Add Funds */}
        {!isCompleted && (
          <Button
            size="sm"
            className="w-full h-8 text-xs font-semibold mb-2"
            style={{ backgroundColor: isPaused ? undefined : project.color, color: isPaused ? undefined : "#fff" }}
            variant={isPaused ? "outline" : "default"}
            disabled={isPaused}
            onClick={() => onContribute(project)}
          >
            <DollarSign className="h-3.5 w-3.5 mr-1.5" />
            {isPaused ? "Paused" : "Add Funds"}
          </Button>
        )}

        {/* Contribution history (collapsible) */}
        <ContributionHistory projectId={project.id} />
      </CardContent>
    </Card>
  );
}

// ── Celebration toast ─────────────────────────────────────────────────────────

function CelebrationToast({ project }: { project: Project }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-3xl">🎉</div>
      <div>
        <p className="font-semibold text-sm">Goal Achieved!</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You've fully funded your <span className="font-medium">{project.name}</span> goal! Incredible work! 🏆
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_TABS = ["all", "active", "paused", "completed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function Projects() {
  const { toast }        = useToast();
  const queryClient      = useQueryClient();

  const [statusFilter, setStatusFilter]     = useState<StatusTab>("all");
  const [createOpen, setCreateOpen]         = useState(false);
  const [editProject, setEditProject]       = useState<Project | null>(null);
  const [contributeProject, setContribute]  = useState<Project | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => apiFetch("GET", "/api/projects"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["projects/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch("PUT", `/api/projects/${id}`, { status }),
    onSuccess: () => invalidate(),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch("DELETE", `/api/projects/${id}`),
    onSuccess: () => { toast({ description: "Project deleted." }); invalidate(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleContributed = (project: Project, milestone: number | null, completed: boolean) => {
    invalidate();
    if (completed) {
      sendMilestoneNotification(project, 100);
      toast({ duration: 6000, description: <CelebrationToast project={project} /> });
    } else if (milestone !== null) {
      sendMilestoneNotification(project, milestone);
      toast({
        title: `${milestone}% milestone! 🎯`,
        description: `You're ${milestone}% of the way to your ${project.name} goal. You're doing great!`,
        duration: 5000,
      });
    } else {
      toast({ description: `Funds added to ${project.name}` });
    }
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      toast({ description: "Your browser doesn't support notifications.", variant: "destructive" });
      return;
    }
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") toast({ description: "Notifications enabled! We'll celebrate your milestones." });
  };

  const filtered = useMemo(
    () => statusFilter === "all" ? projects : projects.filter((p) => p.status === statusFilter),
    [projects, statusFilter]
  );

  const activeProjects    = projects.filter((p) => p.status === "active");
  const completedProjects = projects.filter((p) => p.status === "completed");
  const totalSaved        = projects.reduce((s, p) => s + p.current_amount, 0);
  const totalTarget       = projects.reduce((s, p) => s + p.target_amount, 0);
  const overallPct        = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Savings Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and celebrate your financial milestones</p>
        </div>
        <div className="flex items-center gap-2">
          {notifPermission === "default" && (
            <Button variant="outline" size="sm" onClick={requestNotifications}>
              <Bell className="h-4 w-4 mr-2" />
              Enable notifications
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New goal
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total saved",   value: formatCurrency(totalSaved),        className: "text-emerald-500" },
            { label: "Total target",  value: formatCurrency(totalTarget),        className: "" },
            { label: "Active goals",  value: String(activeProjects.length),     className: "" },
            { label: "Completed",     value: String(completedProjects.length),  className: "text-primary" },
          ].map(({ label, value, className }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                <p className={cn("text-xl font-bold", className)}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overall progress */}
      {projects.length > 0 && totalTarget > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Overall progress across all goals</span>
              </div>
              <span className="text-sm font-bold" style={{ color: progressColor(overallPct, "#4FC3F7") }}>
                {overallPct}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${overallPct}%`,
                  backgroundColor: progressColor(overallPct, "#4FC3F7"),
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {formatCurrency(totalSaved)} saved of {formatCurrency(totalTarget)} total
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1 border border-border/50 w-fit">
        {STATUS_TABS.map((tab) => (
          <button key={tab} onClick={() => setStatusFilter(tab)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
              statusFilter === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}>
            {tab}
            {tab !== "all" && (
              <span className="ml-1.5 opacity-70">({projects.filter((p) => p.status === tab).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Projects grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-52 border-border/50 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Target className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">
              {statusFilter === "all" ? "No goals yet" : `No ${statusFilter} goals`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {statusFilter === "all" ? "Create your first savings goal to get started." : `You don't have any ${statusFilter} goals right now.`}
            </p>
            {statusFilter === "all" && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create a goal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onContribute={(p) => setContribute(p)}
              onEdit={(p) => setEditProject(p)}
              onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
              onDelete={(id) => {
                if (confirm("Delete this goal? This cannot be undone.")) deleteMutation.mutate(id);
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {createOpen && (
        <ProjectModal open onClose={() => setCreateOpen(false)} onSaved={invalidate} />
      )}
      {editProject && (
        <ProjectModal open onClose={() => setEditProject(null)} existing={editProject} onSaved={invalidate} />
      )}
      {contributeProject && (
        <ContributeModal
          project={contributeProject}
          onClose={() => setContribute(null)}
          onContributed={(milestone, completed) =>
            handleContributed(contributeProject, milestone, completed)
          }
        />
      )}
    </div>
  );
}
