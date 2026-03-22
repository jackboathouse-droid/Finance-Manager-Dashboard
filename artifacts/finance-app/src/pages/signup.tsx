import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
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

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [, setLocation] = useLocation();
  const registerMutation = useRegister();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!fullName.trim()) {
      setValidationError("Please enter your full name.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords don't match.");
      return;
    }

    registerMutation.mutate(
      { data: { fullName: fullName.trim(), email: email.trim().toLowerCase(), password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          setLocation("/");
        },
        onError: (err: any) => {
          const message =
            err?.data?.error ??
            err?.message ??
            "Something went wrong. Please try again.";
          toast({
            title: "Sign up failed",
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

        {/* Bubble orb decorations */}
        <GlassOrb size={220} top={-85} left={-70} highlightX="28%" highlightY="22%" opacity={0.85} blur={0.5} />
        <GlassOrb size={140} bottom={-45} right={-40} highlightX="26%" highlightY="26%" opacity={0.80} />
        <GlassOrb size={78} top="10%" right={52} highlightX="30%" highlightY="22%" opacity={0.72} />
        <GlassOrb size={50} top="48%" left={-14} highlightX="25%" highlightY="20%" opacity={0.68} />
        <GlassOrb size={40} bottom="20%" left={68} highlightX="28%" highlightY="24%" opacity={0.65} />
        <GlassOrb size={28} top="6%" left="34%" highlightX="25%" highlightY="22%" opacity={0.62} />
        <GlassOrb size={20} bottom="32%" right={76} highlightX="26%" highlightY="20%" opacity={0.58} />
        <GlassOrb size={14} bottom="14%" left="57%" highlightX="25%" highlightY="22%" opacity={0.52} />

        {/* ── Form content ────────────────────────────────────────────────── */}
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div style={{ display: "inline-block", transform: "scale(1.20)", transformOrigin: "center center", transition: "transform 0.4s ease" }}>
              <BubbleLogo size="lg" />
            </div>
          </div>

          {/* Headline + subheading */}
          <div className="text-center mb-7">
            <h1 className="text-[1.85rem] font-bold tracking-tight text-foreground leading-tight mb-2.5">
              Create your account
            </h1>
            <p className="text-[0.95rem] text-muted-foreground leading-relaxed">
              Start managing your money inside your&nbsp;Bubble
            </p>
          </div>

          {/* Sign-up card */}
          <Card className="border-border/50 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl">
            <CardContent className="pt-7 pb-7">
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-12 bg-background/50"
                    placeholder="Jane Smith"
                    autoComplete="name"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-background/50"
                    placeholder="jane@example.com"
                    autoComplete="email"
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
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 bg-background/50"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>

                {validationError && (
                  <p className="text-sm text-destructive leading-snug pt-0.5">
                    {validationError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all mt-1"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Creating account…" : "Create account"}
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

              <GoogleSignInButton label="Sign up with Google" />

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Right: Hero panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:block lg:flex-1 relative bg-slate-900 overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Abstract fintech background"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/30 to-transparent" />

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

        <div className="absolute bottom-16 left-16 right-16 z-20">
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight tracking-tight">
            Your finances,<br />finally in order.
          </h2>
          <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
            Track spending, set budgets, and stay on top of every account — all inside your Bubble.
          </p>
        </div>
      </div>
    </div>
  );
}
