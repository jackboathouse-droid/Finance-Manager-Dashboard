import { useState, useEffect } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BubbleLogo } from "@/components/bubble-logo";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { useToast } from "@/hooks/use-toast";

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

export default function Login() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();

  // Show a toast if the user was redirected back with an OAuth error
  useEffect(() => {
    const params = new URLSearchParams(search);
    const error = params.get("error");
    if (error && OAUTH_ERROR_MESSAGES[error]) {
      toast({
        title: "Sign-in failed",
        description: OAUTH_ERROR_MESSAGES[error],
        variant: "destructive",
      });
      // Remove the error param from URL without triggering re-render loop
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
            err?.response?.data?.error ??
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
            <BubbleLogo size="lg" />
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
                  <Label htmlFor="username">Email / Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 bg-background/50"
                    placeholder="Email or username"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
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
                Demo credentials: admin&nbsp;/&nbsp;admin
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
    </div>
  );
}
