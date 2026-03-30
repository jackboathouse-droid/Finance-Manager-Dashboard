import { Link } from "wouter";
import { BubbleLogo } from "@/components/bubble-logo";
import { Button } from "@/components/ui/button";
import {
  ReceiptText,
  Target,
  Sparkles,
  Landmark,
  ChevronRight,
  UserPlus,
  BarChart2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

// ── Glass orb decoration (reused from login page) ────────────────────────────

interface OrbProps {
  size: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  opacity?: number;
  blur?: number;
}

function GlassOrb({ size, top, left, right, bottom, opacity = 1, blur = 0 }: OrbProps) {
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
          "radial-gradient(circle at 27% 24%, rgba(255,255,255,0.62) 0%, transparent 30%)",
          "radial-gradient(circle at 55% 60%, rgba(179,229,252,0.30) 0%, transparent 38%)",
          "radial-gradient(circle at 42% 38%, rgba(224,247,254,0.38) 0%, rgba(79,195,247,0.05) 60%, transparent 100%)",
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

// ── Feature card ─────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  accentColor?: string;
}

function FeatureCard({ icon: Icon, title, description, accentColor = "#4FC3F7" }: FeatureCardProps) {
  return (
    <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-6 shadow-sm hover:shadow-md transition-shadow">
      <div
        className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: `${accentColor}1A` }}
      >
        <Icon className="h-5 w-5" style={{ color: accentColor }} />
      </div>
      <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────

interface StepProps {
  number: number;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="flex gap-4 items-start">
      <div
        className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
        style={{ background: "linear-gradient(135deg, #4FC3F7 0%, #0288D1 100%)" }}
      >
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <BubbleLogo size="md" />
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="font-medium">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="font-medium shadow-sm">
                Get started
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-20 text-center">
        {/* Decorative orbs */}
        <GlassOrb size={340} top={-100} left={-120} opacity={0.7} blur={1} />
        <GlassOrb size={220} top={-60} right={-80} opacity={0.65} />
        <GlassOrb size={90} bottom={40} left="20%" opacity={0.55} />
        <GlassOrb size={56} top="30%" right="8%" opacity={0.50} />
        <GlassOrb size={36} bottom={100} right="25%" opacity={0.45} />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Personal finance, reimagined
          </div>

          {/* Headline */}
          <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Balance, Budget,{" "}
            <span style={{ color: "#4FC3F7" }}>and Breathe.</span>
          </h1>

          {/* Sub-headline */}
          <p className="mb-10 mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
            Bubble brings your transactions, budgets, AI insights, and net worth
            into one calm, focused view — so money stops feeling overwhelming.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-all">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
                Sign in
              </Button>
            </Link>
          </div>

          {/* Social proof micro-copy */}
          <p className="mt-6 text-xs text-muted-foreground/70">
            No credit card required · Your data stays private
          </p>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-muted/30">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Everything you need to take control
            </h2>
            <p className="mt-3 text-muted-foreground">
              Four core tools that work together to give you a complete financial picture.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={ReceiptText}
              title="Transaction Tracking"
              description="Log income and expenses, import CSV files, and tag every transaction with categories and people."
              accentColor="#4FC3F7"
            />
            <FeatureCard
              icon={Target}
              title="Smart Budgeting"
              description="Set monthly budgets per category and watch live progress bars tell you exactly where you stand."
              accentColor="#10B981"
            />
            <FeatureCard
              icon={Sparkles}
              title="AI Insights"
              description="Get personalised spending insights powered by AI — patterns, anomalies, and actionable suggestions."
              accentColor="#8B5CF6"
            />
            <FeatureCard
              icon={Landmark}
              title="Net Worth"
              description="Track account balances, manual assets, and liabilities in one number that updates in real time."
              accentColor="#F59E0B"
            />
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Up and running in minutes
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three simple steps to financial clarity.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            <Step
              number={1}
              title="Create your account"
              description="Sign up with your email or Google account — no credit card, no friction."
            />
            <Step
              number={2}
              title="Add accounts & transactions"
              description="Manually add your bank accounts and log transactions, or import a CSV export from your bank."
            />
            <Step
              number={3}
              title="Set budgets and explore"
              description="Configure your monthly budgets and let Bubble's dashboard and AI do the rest."
            />
          </div>

          {/* Feature checklist */}
          <div className="mt-14 mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card/70 p-8">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Multi-person household tracking",
                "Weekly & monthly views",
                "Savings projects & goals",
                "Manual assets & liabilities",
                "Budget alerts via email",
                "Weekly spending digest",
                "AI financial insights",
                "Export your data anytime",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-muted/30">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 flex justify-center">
            <BubbleLogo size="lg" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to find your financial calm?
          </h2>
          <p className="mt-3 mb-8 text-muted-foreground">
            Join Bubble and start making sense of your money today.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-12 px-10 text-base font-semibold shadow-lg hover:shadow-xl transition-all">
              <UserPlus className="mr-2 h-4 w-4" />
              Create your free account
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-background px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <BubbleLogo size="sm" />
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">
              Privacy Policy
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">
              Sign up
            </Link>
            <span>© {new Date().getFullYear()} Bubble Finance</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
