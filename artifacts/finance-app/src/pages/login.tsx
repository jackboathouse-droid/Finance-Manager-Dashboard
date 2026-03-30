import { useState, useEffect } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BubbleLogo } from "@/components/bubble-logo";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle2 } from "lucide-react";

// ── Glass bubble decoration ───────────────────────────────────────────────────

interface BubbleProps {
  size: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  highlightX?: string;
  highlightY?: string;
  opacity?: number;
  blur?: number;
}

function GlassOrb({
  size,
  top,
  left,
  right,
  bottom,
  highlightX = "27%",
  highlightY = "24%",
  opacity = 1,
  blur = 0,
}: BubbleProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        pointerEvents: "none",
        top,
        left,
        right,
        bottom,
        opacity,
        filter: blur ? `blur(${blur}px)` : undefined,
        background: [
          `radial-gradient(circle at ${highlightX} ${highlightY}, rgba(255,255,255,0.62) 0%, transparent 30%)`,
          `radial-gradient(circle at 55% 60%, rgba(179,229,252,0.30) 0%, transparent 38%)`,
          `radial-gradient(circle at 42% 38%, rgba(224,247,254,0.38) 0%, rgba(79,195,247,0.05) 60%, transparent 100%)`,
        ].join(", "),
        border: "1px solid rgba(179,229,252,0.38)",
        boxShadow: [
          "inset 0 1px 8px rgba(255,255,255,0.32)",
          "0 4px 24px rgba(79,195,247,0.06)",
        ].join(", "),
      }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_failed: "Google sign-in failed. Please try again or use your email and password.",
  google_not_configured: "Google sign-in is not yet configured. Please use your email and password.",
  session_error: "A session error occurred. Please try again.",
};

// ── Forgot Password dialog ────────────────────────────────────────────────────

function ForgotPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      setSent(true);
      if (data._dev_reset_url) setDevUrl(data._dev_reset_url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => { setEmail(""); setSent(false); setDevUrl(null); setError(""); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Reset your password
          </DialogTitle>
          <DialogDescription>
            Enter the email address for your account and we'll send you a reset link.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="py-4 space-y-4">
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                If an account with that email exists, a reset link has been sent. Please check your inbox.
              </p>
            </div>
            {devUrl && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Dev mode — no SMTP configured</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 break-all">
                  <a href={devUrl} className="underline underline-offset-2 hover:text-amber-800">{devUrl}</a>
                </p>
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>Back to login</Button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                autoComplete="email"
                autoFocus
                className="h-11"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();

  // Show toasts for OAuth errors or successful password reset redirect
  useEffect(() => {
    const params = new URLSearchParams(search);
    const error = params.get("error");
    const reset = params.get("reset");

    if (error && OAUTH_ERROR_MESSAGES[error]) {
      toast({
        title: "Sign-in failed",
        description: OAUTH_ERROR_MESSAGES[error],
        variant: "destructive",
      });
    } else if (reset === "success") {
      toast({
        title: "Password reset successfully",
        description: "Your password has been updated. Please log in with your new password.",
      });
    }

    if (error || reset) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { username, password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          setLocation("/");
        },
        onError: (err: any) => {
          const message =
            err?.data?.error ??
            err?.message ??
            "Please check your credentials and try again.";
          toast({
            title: "Login failed",
            description: message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* ── Left: Form side ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background relative overflow-hidden">

        {/* Bubble orb decorations — positioned around the edges */}

        {/* Large orb — top-left, partially off-screen */}
        <GlassOrb
          size={260} top={-110} left={-90}
          highlightX="28%" highlightY="22%"
          opacity={0.85} blur={0.5}
        />

        {/* Medium-large orb — bottom-right, partially off-screen */}
        <GlassOrb
          size={160} bottom={-55} right={-50}
          highlightX="26%" highlightY="26%"
          opacity={0.80}
        />

        {/* Medium orb — upper-right, fully visible */}
        <GlassOrb
          size={88} top="12%" right={48}
          highlightX="30%" highlightY="22%"
          opacity={0.75}
        />

        {/* Small orb — left edge, middle-ish */}
        <GlassOrb
          size={54} top="52%" left={-16}
          highlightX="25%" highlightY="20%"
          opacity={0.70}
        />

        {/* Small orb — lower-left area */}
        <GlassOrb
          size={44} bottom="18%" left={72}
          highlightX="28%" highlightY="24%"
          opacity={0.68}
        />

        {/* Tiny orb — top center scatter */}
        <GlassOrb
          size={30} top="7%" left="32%"
          highlightX="25%" highlightY="22%"
          opacity={0.65}
        />

        {/* Mini orb — right side mid-lower */}
        <GlassOrb
          size={22} bottom="30%" right={80}
          highlightX="26%" highlightY="20%"
          opacity={0.60}
        />

        {/* Micro orb — bottom scatter */}
        <GlassOrb
          size={16} bottom="12%" left="55%"
          highlightX="25%" highlightY="22%"
          opacity={0.55}
        />

        {/* ── Form content ──────────────────────────────────────────────── */}
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

          {/* Logo */}
          <div className="flex justify-center mb-9">
            <div style={{ display: "inline-block", transform: "scale(1.20)", transformOrigin: "center center", transition: "transform 0.4s ease" }}>
              <BubbleLogo size="lg" />
            </div>
          </div>

          {/* Headline + subheading */}
          <div className="text-center mb-8">
            <h1 className="text-[1.85rem] font-bold tracking-tight text-foreground leading-tight mb-2.5">
              Balance, Budget, and Breathe.
            </h1>
            <p className="text-[0.95rem] text-muted-foreground leading-relaxed">
              Money management, simplified&nbsp;&mdash; inside your&nbsp;Bubble
            </p>
          </div>

          {/* Login card */}
          <Card className="border-border/50 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl">
            <CardContent className="pt-7 pb-7">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">Email</Label>
                  <Input
                    id="username"
                    type="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 bg-background/50"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-xs text-primary hover:underline underline-offset-4 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-background/50"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all mt-1"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              {/* ── OR divider ────────────────────────────────────────── */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground/70 tracking-wider">or</span>
                </div>
              </div>

              <GoogleSignInButton />

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Demo:&nbsp;<span className="font-mono text-xs">admin@bubble.app</span>&nbsp;/&nbsp;<span className="font-mono text-xs">admin</span>
              </p>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                  href="/signup"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Sign up
                </Link>
              </p>
              <p className="mt-3 text-center text-xs text-muted-foreground/70">
                <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground">
                  Privacy Policy
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Right: Hero panel ────────────────────────────────────────────── */}
      <div className="hidden lg:block lg:flex-1 relative bg-slate-900 overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Abstract fintech background"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        {/* Gradient overlay from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/30 to-transparent" />

        {/* Subtle bubble hints on the dark side too */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: 320,
            height: 320,
            borderRadius: "50%",
            top: -80,
            right: -80,
            background:
              "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.06) 0%, transparent 30%), radial-gradient(circle at 50% 50%, rgba(79,195,247,0.07) 0%, transparent 65%)",
            border: "1px solid rgba(79,195,247,0.12)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: "50%",
            bottom: 140,
            right: 60,
            background:
              "radial-gradient(circle at 28% 24%, rgba(255,255,255,0.07) 0%, transparent 30%), radial-gradient(circle at 50% 50%, rgba(79,195,247,0.08) 0%, transparent 65%)",
            border: "1px solid rgba(79,195,247,0.14)",
            pointerEvents: "none",
          }}
        />

        {/* Hero copy */}
        <div className="absolute bottom-16 left-16 right-16 z-20">
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight tracking-tight">
            Balance, Budget,<br />and Breathe.
          </h2>
          <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
            Money management, simplified — inside your Bubble
          </p>
        </div>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}
