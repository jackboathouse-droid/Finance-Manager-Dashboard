import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  contributed_at: string;
}

// ── Icon registry ─────────────────────────────────────────────────────────────

const ICONS: { key: string; Component: React.ElementType }[] = [
  { key: "plane", Component: Plane },
  { key: "home", Component: Home },
  { key: "briefcase", Component: Briefcase },
  { key: "car", Component: Car },
  { key: "piggy-bank", Component: PiggyBank },
  { key: "heart", Component: Heart },
  { key: "star", Component: Star },
  { key: "coffee", Component: Coffee },
  { key: "shopping-bag", Component: ShoppingBag },
  { key: "graduation-cap", Component: GraduationCap },
  { key: "zap", Component: Zap },
  { key: "gift", Component: Gift },
  { key: "wallet", Component: Wallet },
  { key: "umbrella", Component: Umbrella },
  { key: "camera", Component: Camera },
  { key: "target", Component: Target },
];

const COLORS = [
  "#4FC3F7", "#10B981", "#8B5CF6", "#F59E0B",
  "#EF4444", "#EC4899", "#06B6D4", "#F97316",
  "#84CC16", "#6366F1",
];

function IconComp({ icon, className }: { icon: string; className?: string }) {
  const found = ICONS.find((i) => i.key === icon);
  const C = found?.Component ?? PiggyBank;
  return <C className={className} />;
}

function statusBadge(status: string) {
  if (status === "completed")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs">
        Completed
      </Badge>
    );
  if (status === "paused")
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-xs">
        Paused
      </Badge>
    );
  return (
    <Badge className="bg-primary/10 text-primary border-0 text-xs">Active</Badge>
  );
}

// ── API helpers ───────────────────────────────────────────────────────────────

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

// ── Milestone notification ────────────────────────────────────────────────────

function sendMilestoneNotification(project: Project, milestone: number) {
  const isComplete = milestone === 100;
  const title = isComplete
    ? `🎉 ${project.name} Complete!`
    : `🎯 ${milestone}% milestone reached!`;
  const body = isComplete
    ? `Congratulations! You've fully funded your ${project.name} goal!`
    : `You're ${milestone}% of the way to your ${project.name} goal. Keep going!`;

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

// ── Create/Edit modal ─────────────────────────────────────────────────────────

function ProjectModal({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Project | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "piggy-bank");
  const [color, setColor] = useState(existing?.color ?? "#4FC3F7");
  const [target, setTarget] = useState(existing ? String(existing.target_amount) : "");
  const [deadline, setDeadline] = useState(existing?.deadline ?? "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEdit = !!existing;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tgt = parseFloat(target);
    if (!name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (isNaN(tgt) || tgt <= 0)
      return toast({ title: "Enter a valid target amount", variant: "destructive" });

    setLoading(true);
    try {
      if (isEdit) {
        await apiFetch("PUT", `/api/projects/${existing.id}`, {
          name, description, icon, color, target_amount: tgt, deadline: deadline || null,
        });
      } else {
        await apiFetch("POST", "/api/projects", {
          name, description, icon, color, target_amount: tgt, deadline: deadline || null,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Project" : "New Savings Goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Project name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Holiday Fund"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you saving for?"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICONS.map(({ key, Component }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                    icon === key
                      ? "ring-2 ring-primary ring-offset-1"
                      : "bg-muted/50 hover:bg-muted"
                  )}
                  style={icon === key ? { backgroundColor: color + "22" } : undefined}
                >
                  <Component className="h-4 w-4" style={icon === key ? { color } : undefined} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    color === c ? "ring-2 ring-offset-2 ring-foreground/40 scale-110" : "hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl border border-border/50"
            style={{ background: color + "15" }}
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color + "30" }}
            >
              <IconComp icon={icon} className="h-5 w-5" style={{ color } as any} />
            </div>
            <span className="font-semibold text-sm">{name || "Your goal"}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target amount ($)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="10,000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deadline (optional)</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
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

function ContributeModal({
  project,
  onClose,
  onContributed,
}: {
  project: Project;
  onClose: () => void;
  onContributed: (milestone: number | null, completed: boolean) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const remaining = project.target_amount - project.current_amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0)
      return toast({ title: "Enter a valid amount", variant: "destructive" });
    if (amt > remaining + 0.01)
      return toast({
        title: "Amount exceeds remaining goal",
        description: `Only ${formatCurrency(remaining)} left to reach your target.`,
        variant: "destructive",
      });

    setLoading(true);
    try {
      const data = await apiFetch<{
        contribution: unknown;
        project: Project;
        milestone: number | null;
        completed: boolean;
      }>("POST", `/api/projects/${project.id}/contributions`, {
        amount: amt,
        note: note.trim() || undefined,
      });
      onContributed(data.milestone, data.completed);
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const progressAfter = Math.min(
    100,
    Math.round(((project.current_amount + (parseFloat(amount) || 0)) / project.target_amount) * 100)
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: project.color + "30" }}
            >
              <IconComp icon={project.icon} className="h-4 w-4" style={{ color: project.color } as any} />
            </div>
            Add funds to {project.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Current progress */}
          <div className="rounded-xl border border-border/50 p-3 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Current</span>
              <span>Goal</span>
            </div>
            <Progress
              value={project.progress_pct}
              className="h-2"
              style={{ "--progress-color": project.color } as any}
            />
            <div className="flex justify-between text-sm font-medium">
              <span>{formatCurrency(project.current_amount)}</span>
              <span className="text-muted-foreground">{formatCurrency(project.target_amount)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Amount to add ($)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${formatCurrency(remaining)}`}
              autoFocus
            />
            {parseFloat(amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                Progress after: {progressAfter}% · {formatCurrency(Math.min(project.current_amount + parseFloat(amount), project.target_amount))} saved
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Monthly top-up"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding…" : `Add ${parseFloat(amount) > 0 ? formatCurrency(parseFloat(amount)) : "funds"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onContribute,
  onEdit,
  onStatusChange,
  onDelete,
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
  const isPaused = project.status === "paused";

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md",
        isCompleted && "ring-1 ring-emerald-500/20"
      )}
    >
      {/* Color accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: project.color }} />

      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: project.color + "25" }}
            >
              <IconComp icon={project.icon} className="h-5 w-5" style={{ color: project.color } as any} />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {project.description}
                </p>
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
                  <DropdownMenuItem
                    onClick={() => onStatusChange(project.id, isPaused ? "active" : "paused")}
                  >
                    {isPaused ? (
                      <><Play className="h-3.5 w-3.5 mr-2" /> Resume</>
                    ) : (
                      <><Pause className="h-3.5 w-3.5 mr-2" /> Pause</>
                    )}
                  </DropdownMenuItem>
                )}
                {!isCompleted && (
                  <DropdownMenuItem onClick={() => onStatusChange(project.id, "completed")}>
                    <CheckCircle className="h-3.5 w-3.5 mr-2" /> Mark complete
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(project.id)}
                  className="text-red-500 focus:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold">{formatCurrency(project.current_amount)}</span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: project.color }}
            >
              {project.progress_pct}%
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{
                width: `${project.progress_pct}%`,
                backgroundColor: project.color,
                boxShadow: `0 0 8px ${project.color}60`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Saved</span>
            <span>Goal: {formatCurrency(project.target_amount)}</span>
          </div>
        </div>

        {/* Deadline / completion info */}
        {isCompleted ? (
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium mb-3">
            <Trophy className="h-3.5 w-3.5" />
            <span>Goal achieved!</span>
          </div>
        ) : project.deadline ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {daysLeft !== null && daysLeft >= 0
                ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left · `
                : "Overdue · "}
              {format(parseISO(project.deadline), "d MMM yyyy")}
            </span>
          </div>
        ) : null}

        {/* Add Funds button */}
        {!isCompleted && (
          <Button
            size="sm"
            className="w-full h-8 text-xs font-semibold"
            style={{
              backgroundColor: isPaused ? undefined : project.color,
              color: isPaused ? undefined : "#fff",
            }}
            variant={isPaused ? "outline" : "default"}
            disabled={isPaused}
            onClick={() => onContribute(project)}
          >
            <DollarSign className="h-3.5 w-3.5 mr-1.5" />
            {isPaused ? "Paused" : "Add Funds"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Celebration overlay ───────────────────────────────────────────────────────

function CelebrationToast({ project }: { project: Project }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-3xl">🎉</div>
      <div>
        <p className="font-semibold text-sm">Goal Achieved!</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You've fully funded your <span className="font-medium">{project.name}</span> goal!
          Incredible work! 🏆
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_TABS = ["all", "active", "paused", "completed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function Projects() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [contributeProject, setContributeProject] = useState<Project | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => apiFetch("GET", "/api/projects"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects"] });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch("PUT", `/api/projects/${id}`, { status }),
    onSuccess: () => invalidate(),
    onError: (err: any) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      toast({ description: "Project deleted." });
      invalidate();
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleContributed = (
    project: Project,
    milestone: number | null,
    completed: boolean
  ) => {
    invalidate();

    if (completed) {
      sendMilestoneNotification(project, 100);
      toast({
        duration: 6000,
        description: <CelebrationToast project={project} />,
      });
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
    if (result === "granted") {
      toast({ description: "Notifications enabled! We'll celebrate your milestones." });
    }
  };

  const filtered = useMemo(
    () =>
      statusFilter === "all" ? projects : projects.filter((p) => p.status === statusFilter),
    [projects, statusFilter]
  );

  const activeProjects = projects.filter((p) => p.status === "active");
  const completedProjects = projects.filter((p) => p.status === "completed");
  const totalSaved = projects.reduce((s, p) => s + p.current_amount, 0);
  const totalTarget = projects.reduce((s, p) => s + p.target_amount, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Savings Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and celebrate your financial milestones
          </p>
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
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Total saved
              </p>
              <p className="text-xl font-bold text-emerald-500">{formatCurrency(totalSaved)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Total target
              </p>
              <p className="text-xl font-bold">{formatCurrency(totalTarget)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Active goals
              </p>
              <p className="text-xl font-bold">{activeProjects.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Completed
              </p>
              <p className="text-xl font-bold text-primary">{completedProjects.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overall progress bar */}
      {projects.length > 0 && totalTarget > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Overall progress across all goals</span>
              </div>
              <span className="text-sm font-bold text-primary">{overallPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${overallPct}%`,
                  background: "linear-gradient(90deg, #4FC3F7, #10B981)",
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {formatCurrency(totalSaved)} saved of {formatCurrency(totalTarget)} total
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status tabs */}
      <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1 border border-border/50 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
              statusFilter === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab}
            {tab !== "all" && (
              <span className="ml-1.5 opacity-70">
                ({projects.filter((p) => p.status === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
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
              {statusFilter === "all"
                ? "Create your first savings goal to get started."
                : `You don't have any ${statusFilter} goals right now.`}
            </p>
            {statusFilter === "all" && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create a goal
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
              onContribute={(p) => setContributeProject(p)}
              onEdit={(p) => setEditProject(p)}
              onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
              onDelete={(id) => {
                if (confirm("Delete this project? This cannot be undone.")) {
                  deleteMutation.mutate(id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {createOpen && (
        <ProjectModal
          open
          onClose={() => setCreateOpen(false)}
          onSaved={invalidate}
        />
      )}
      {editProject && (
        <ProjectModal
          open
          onClose={() => setEditProject(null)}
          existing={editProject}
          onSaved={invalidate}
        />
      )}
      {contributeProject && (
        <ContributeModal
          project={contributeProject}
          onClose={() => setContributeProject(null)}
          onContributed={(milestone, completed) =>
            handleContributed(contributeProject, milestone, completed)
          }
        />
      )}
    </div>
  );
}
