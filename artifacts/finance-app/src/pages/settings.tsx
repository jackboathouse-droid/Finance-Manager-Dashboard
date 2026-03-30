import { useState, useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Calendar,
  Bell,
  Target,
  Shield,
  Eye,
  EyeOff,
  Check,
  Loader2,
  RefreshCw,
  TrendingUp,
  Trash2,
  Download,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  variant = "default",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  const isDanger = variant === "danger";
  return (
    <div className={cn(
      "bg-card border rounded-2xl shadow-sm overflow-hidden",
      isDanger ? "border-red-200 dark:border-red-900/60" : "border-border/50"
    )}>
      <div className={cn(
        "px-6 py-5 border-b",
        isDanger ? "border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20" : "border-border/40 bg-muted/20"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
            isDanger ? "bg-red-100 dark:bg-red-900/40" : "bg-primary/10"
          )}>
            <Icon className={cn("h-4.5 w-4.5", isDanger ? "text-red-600 dark:text-red-400" : "text-primary")} />
          </div>
          <div>
            <h2 className={cn("text-base font-semibold leading-tight", isDanger && "text-red-700 dark:text-red-400")}>{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Password strength bar ─────────────────────────────────────────────────────

function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pw) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Weak", color: "bg-red-500" };
  if (score === 2 || score === 3) return { level: 2, label: "Fair", color: "bg-amber-500" };
  return { level: 3, label: "Strong", color: "bg-emerald-500" };
}

// ── Delete Account dialog ─────────────────────────────────────────────────────

function DeleteAccountDialog({
  open,
  onClose,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  userEmail: string;
}) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const emailMatches = confirmEmail.trim().toLowerCase() === userEmail.toLowerCase();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleDelete = async () => {
    if (!emailMatches) return;
    setDeleting(true);
    try {
      const res = await fetch(`${base}/api/auth/account`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to delete account.", variant: "destructive" });
        return;
      }
      toast({ title: "Account deleted", description: "All your data has been permanently removed." });
      setLocation("/login");
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) {
      setConfirmEmail("");
      setPassword("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            Delete your account
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            This will <strong>permanently delete</strong> your account and all associated data —
            including all transactions, accounts, budgets, assets, and settings. This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              All data will be immediately and permanently deleted from our servers.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Type your email to confirm
            </Label>
            <Input
              type="email"
              placeholder={userEmail}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="h-10"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current password <span className="normal-case font-normal">(if using email sign-in)</span>
            </Label>
            <div className="relative">
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
                autoComplete="current-password"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={handleClose} disabled={deleting} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!emailMatches || deleting}
            className="flex-1"
          >
            {deleting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting…</>
            ) : (
              <><Trash2 className="h-4 w-4 mr-2" />Delete forever</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const { user } = useAuth();

  // ── Financial preferences state ───────────────────────────────────────────
  const [currency, setCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [savingFinancial, setSavingFinancial] = useState(false);

  // ── Notification state ────────────────────────────────────────────────────
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [milestoneAlerts, setMilestoneAlerts] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // ── Budget settings state ─────────────────────────────────────────────────
  const [recurringBudgets, setRecurringBudgets] = useState(true);
  const [rolloverBudget, setRolloverBudget] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);

  // ── Security state ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // ── Danger zone state ─────────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Populate state from loaded settings
  useEffect(() => {
    if (!settings) return;
    setCurrency(settings.currency);
    setDateFormat(settings.date_format);
    setBudgetAlerts(settings.budget_alerts);
    setMilestoneAlerts(settings.milestone_alerts);
    setWeeklySummary(settings.weekly_summary);
    setRecurringBudgets(settings.recurring_budgets);
    setRolloverBudget(settings.rollover_budget);
  }, [settings]);

  // ── Save handlers ─────────────────────────────────────────────────────────

  const saveFinancial = async () => {
    setSavingFinancial(true);
    try {
      await updateSettings({ currency, date_format: dateFormat });
      toast({ title: "Financial preferences saved" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingFinancial(false);
    }
  };

  const saveNotifications = async () => {
    setSavingNotifications(true);
    try {
      await updateSettings({ budget_alerts: budgetAlerts, milestone_alerts: milestoneAlerts, weekly_summary: weeklySummary });
      toast({ title: "Notification preferences saved" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingNotifications(false);
    }
  };

  const saveBudget = async () => {
    setSavingBudget(true);
    try {
      await updateSettings({ recurring_budgets: recurringBudgets, rollover_budget: rolloverBudget });
      toast({ title: "Budget settings saved" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingBudget(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Please fill in all password fields", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setSavingPassword(true);
    setPasswordSuccess(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      toast({ title: "Password updated successfully" });
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDownloadData = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${base}/api/auth/export`;
  };

  const strength = passwordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const userEmail = user?.username ?? "";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your preferences, notifications, and account security.
        </p>
      </div>

      {/* ── 1. Financial Preferences ───────────────────────────────────────── */}
      <SectionCard
        icon={DollarSign}
        title="Financial Preferences"
        description="Set your default currency and date display format."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Currency
            </Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">🇺🇸 USD — US Dollar ($)</SelectItem>
                <SelectItem value="GBP">🇬🇧 GBP — British Pound (£)</SelectItem>
                <SelectItem value="EUR">🇪🇺 EUR — Euro (€)</SelectItem>
                <SelectItem value="CAD">🇨🇦 CAD — Canadian Dollar ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date Format
            </Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl bg-muted/40 border border-border/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Preview — </span>
          <span className="font-medium">
            {new Intl.NumberFormat(
              currency === "GBP" ? "en-GB" : currency === "EUR" ? "de-DE" : currency === "CAD" ? "en-CA" : "en-US",
              { style: "currency", currency }
            ).format(1234.56)}
          </span>
          <span className="text-muted-foreground mx-2">·</span>
          <span className="font-medium">
            {(() => {
              const d = new Date(2026, 2, 22);
              const day = String(d.getDate()).padStart(2, "0");
              const month = String(d.getMonth() + 1).padStart(2, "0");
              const year = String(d.getFullYear());
              if (dateFormat === "DD/MM/YYYY") return `${day}/${month}/${year}`;
              if (dateFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
              return `${month}/${day}/${year}`;
            })()}
          </span>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={saveFinancial} disabled={savingFinancial} className="min-w-[120px]">
            {savingFinancial ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {savingFinancial ? "Saving…" : "Save Preferences"}
          </Button>
        </div>
      </SectionCard>

      {/* ── 2. Notifications ───────────────────────────────────────────────── */}
      <SectionCard
        icon={Bell}
        title="Notifications"
        description="Choose which alerts and summaries you receive."
      >
        <div className="divide-y divide-border/40 -my-1">
          <div className="py-3">
            <ToggleRow
              label="Budget Alerts"
              description="Get notified when you approach or exceed a budget limit."
              checked={budgetAlerts}
              onCheckedChange={setBudgetAlerts}
            />
          </div>
          <div className="py-3">
            <ToggleRow
              label="Project Milestone Alerts"
              description="Notify me when a savings goal reaches a milestone."
              checked={milestoneAlerts}
              onCheckedChange={setMilestoneAlerts}
            />
          </div>
          <div className="py-3">
            <ToggleRow
              label="Weekly Summary"
              description="Receive a weekly email summarising your spending and income."
              checked={weeklySummary}
              onCheckedChange={setWeeklySummary}
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={saveNotifications} disabled={savingNotifications} className="min-w-[120px]">
            {savingNotifications ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {savingNotifications ? "Saving…" : "Save Notifications"}
          </Button>
        </div>
      </SectionCard>

      {/* ── 3. Budget Settings ─────────────────────────────────────────────── */}
      <SectionCard
        icon={Target}
        title="Budget Settings"
        description="Control how budgets behave across months."
      >
        <div className="divide-y divide-border/40 -my-1">
          <div className="py-3">
            <ToggleRow
              label="Enable Recurring Budgets"
              description="Automatically apply this month's budgets to future months."
              checked={recurringBudgets}
              onCheckedChange={setRecurringBudgets}
            />
          </div>
          <div className="py-3">
            <ToggleRow
              label="Rollover Unused Budget"
              description="Carry any unspent budget forward into the next month."
              checked={rolloverBudget}
              onCheckedChange={setRolloverBudget}
            />
          </div>
        </div>

        {rolloverBudget && (
          <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Unspent amounts will be added to next month's budget for the same category.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button onClick={saveBudget} disabled={savingBudget} className="min-w-[120px]">
            {savingBudget ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {savingBudget ? "Saving…" : "Save Budget Settings"}
          </Button>
        </div>
      </SectionCard>

      {/* ── 4. Security ────────────────────────────────────────────────────── */}
      <SectionCard
        icon={Shield}
        title="Security"
        description="Update your password to keep your account secure."
      >
        {passwordSuccess && (
          <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            <Check className="h-4 w-4 shrink-0" />
            Password updated successfully.
          </div>
        )}

        <div className="space-y-4">
          <PasswordInput
            id="current-password"
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Enter your current password"
          />

          <PasswordInput
            id="new-password"
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="At least 8 characters"
          />

          {/* Strength bar */}
          {newPassword && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-all duration-300",
                      i <= strength.level ? strength.color : "bg-border"
                    )}
                  />
                ))}
              </div>
              <p className={cn(
                "text-xs font-medium",
                strength.level === 1 && "text-red-500",
                strength.level === 2 && "text-amber-500",
                strength.level === 3 && "text-emerald-500",
              )}>
                {strength.label} password
              </p>
            </div>
          )}

          <PasswordInput
            id="confirm-password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Repeat your new password"
          />

          {/* Match indicator */}
          {confirmPassword && (
            <p className={cn(
              "text-xs font-medium flex items-center gap-1.5",
              passwordsMatch ? "text-emerald-600" : "text-red-500"
            )}>
              {passwordsMatch ? (
                <><Check className="h-3.5 w-3.5" /> Passwords match</>
              ) : (
                "Passwords do not match"
              )}
            </p>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button
            onClick={savePassword}
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="min-w-[140px]"
          >
            {savingPassword ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating…</>
            ) : (
              <><Shield className="h-4 w-4 mr-2" />Update Password</>
            )}
          </Button>
        </div>
      </SectionCard>

      {/* ── 5. Privacy & Data ──────────────────────────────────────────────── */}
      <SectionCard
        icon={Download}
        title="Privacy & Data"
        description="Download a copy of your data or review our Privacy Policy."
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="flex-1 justify-start gap-2" onClick={handleDownloadData}>
            <Download className="h-4 w-4" />
            Download my data
          </Button>
          <Link href="/privacy" className="flex-1">
            <Button variant="outline" className="w-full justify-start gap-2">
              <Shield className="h-4 w-4" />
              Privacy Policy
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Your data export includes all transactions, accounts, budgets, assets, and settings in JSON format.
        </p>
      </SectionCard>

      {/* ── 6. Danger Zone ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={AlertTriangle}
        title="Danger Zone"
        description="Irreversible actions — proceed with care."
        variant="danger"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Delete my account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete account
          </Button>
        </div>
      </SectionCard>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        userEmail={userEmail}
      />
    </div>
  );
}
