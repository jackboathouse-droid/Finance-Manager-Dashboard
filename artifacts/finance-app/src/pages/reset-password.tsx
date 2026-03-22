import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { BubbleLogo } from "@/components/bubble-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Password strength helper ──────────────────────────────────────────────────

function strengthLevel(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const levels: { level: 0 | 1 | 2 | 3; label: string; color: string }[] = [
    { level: 0, label: "", color: "" },
    { level: 1, label: "Weak", color: "bg-destructive" },
    { level: 2, label: "Fair", color: "bg-amber-500" },
    { level: 3, label: "Strong", color: "bg-emerald-500" },
  ];
  return levels[score];
}

function StrengthBar({ password }: { password: string }) {
  const s = strengthLevel(password);
  if (!password) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              s.level >= n ? s.color : "bg-secondary"
            )}
          />
        ))}
      </div>
      {s.label && (
        <p className={cn("text-xs font-medium", s.level === 1 ? "text-destructive" : s.level === 2 ? "text-amber-500" : "text-emerald-500")}>
          {s.label} password
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TokenState = "loading" | "valid" | "invalid";

export default function ResetPassword() {
  const search = useSearch();
  const [, setLocation] = useLocation();

  const token = new URLSearchParams(search).get("token") || "";

  const [tokenState, setTokenState] = useState<TokenState>("loading");
  const [tokenError, setTokenError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      setTokenError("No reset token found. Please request a new password reset link.");
      return;
    }

    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setTokenState("valid");
        } else {
          setTokenState("invalid");
          setTokenError(data.error || "This reset link is invalid or has expired.");
        }
      })
      .catch(() => {
        setTokenState("invalid");
        setTokenError("Could not validate the reset link. Please try again.");
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to reset password. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => setLocation("/login?reset=success");

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      {/* Subtle background blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          style={{
            position: "absolute",
            width: 480,
            height: 480,
            borderRadius: "50%",
            top: -160,
            left: -120,
            background:
              "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.55) 0%, transparent 30%), radial-gradient(circle at 50% 50%, rgba(224,247,254,0.32) 0%, rgba(79,195,247,0.04) 70%, transparent 100%)",
            border: "1px solid rgba(179,229,252,0.30)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            bottom: -70,
            right: -60,
            background:
              "radial-gradient(circle at 26% 24%, rgba(255,255,255,0.45) 0%, transparent 30%), radial-gradient(circle at 50% 50%, rgba(79,195,247,0.06) 0%, transparent 65%)",
            border: "1px solid rgba(179,229,252,0.25)",
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <BubbleLogo size="lg" />
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5 bg-card/70 backdrop-blur-xl">
          <CardContent className="pt-7 pb-7">
            {/* Loading */}
            {tokenState === "loading" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Validating your reset link…</p>
              </div>
            )}

            {/* Invalid token */}
            {tokenState === "invalid" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <XCircle className="h-14 w-14 text-destructive" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Link unavailable</h2>
                  <p className="text-sm text-muted-foreground">{tokenError}</p>
                </div>
                <Button className="mt-2 w-full" onClick={() => setLocation("/login")}>
                  Back to login
                </Button>
              </div>
            )}

            {/* Success */}
            {tokenState === "valid" && success && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Password reset!</h2>
                  <p className="text-sm text-muted-foreground">
                    Your password has been reset successfully. You can now log in with your new password.
                  </p>
                </div>
                <Button className="mt-2 w-full" onClick={goToLogin}>
                  Go to login
                </Button>
              </div>
            )}

            {/* Form */}
            {tokenState === "valid" && !success && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="text-center mb-2">
                  <div className="flex justify-center mb-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold">Choose a new password</h2>
                  <p className="text-sm text-muted-foreground mt-1">Must be at least 8 characters</p>
                </div>

                {/* New password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 bg-background/50 pr-10"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <StrengthBar password={password} />
                </div>

                {/* Confirm password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={cn(
                        "h-12 bg-background/50 pr-10",
                        passwordsMismatch && "border-destructive focus-visible:ring-destructive"
                      )}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordsMatch && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                    </p>
                  )}
                  {passwordsMismatch && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>

                {formError && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5">
                    <p className="text-sm text-destructive">{formError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium shadow-md mt-1"
                  disabled={loading}
                >
                  {loading ? "Resetting…" : "Reset password"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <button
                    type="button"
                    onClick={() => setLocation("/login")}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
