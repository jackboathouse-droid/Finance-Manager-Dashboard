import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Check, Zap, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { BubbleLogo } from "@/components/bubble-logo";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring?: { interval: string };
}

interface Product {
  id: string;
  name: string;
  description: string;
  prices: Price[];
}

const FREE_FEATURES = [
  "2 bank accounts",
  "100 transactions/month",
  "Budget tracking",
  "Basic reports",
  "Categories & subcategories",
];

const PRO_FEATURES = [
  "Unlimited accounts",
  "Unlimited transactions",
  "AI auto-categorisation",
  "Advanced reports & charts",
  "CSV import",
  "Projects & people tracking",
  "Assets & liabilities tracking",
  "Priority support",
];

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>("free");

  useEffect(() => {
    fetchProducts();
    if (isAuthenticated) fetchBillingStatus();
  }, [isAuthenticated]);

  async function fetchProducts() {
    try {
      const res = await fetch(`${BASE}/api/billing/products`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.data || []);
      }
    } catch {
      // No products yet
    } finally {
      setLoading(false);
    }
  }

  async function fetchBillingStatus() {
    try {
      const res = await fetch(`${BASE}/api/billing/status`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUserPlan(data.plan || "free");
      }
    } catch {
      // ignore
    }
  }

  const proProduct = products.find((p) => p.name.toLowerCase().includes("pro"));
  const monthlyPrice = proProduct?.prices.find((p) => p.recurring?.interval === "month");
  const yearlyPrice = proProduct?.prices.find((p) => p.recurring?.interval === "year");
  const selectedPrice = billing === "monthly" ? monthlyPrice : yearlyPrice;

  async function handleUpgrade() {
    if (!isAuthenticated) {
      navigate("/signup");
      return;
    }

    if (!selectedPrice) {
      toast({ title: "No plan available", description: "Please try again later.", variant: "destructive" });
      return;
    }

    setCheckoutLoading(selectedPrice.id);
    try {
      const res = await fetch(`${BASE}/api/billing/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: selectedPrice.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  }

  const yearlySavings =
    monthlyPrice && yearlyPrice
      ? Math.round(100 - (yearlyPrice.unit_amount / (monthlyPrice.unit_amount * 12)) * 100)
      : 17;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <BubbleLogo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to app
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Get started free</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Heading */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Start free. Upgrade when you need more power.
          </p>

          {/* Billing toggle */}
          {(monthlyPrice || yearlyPrice) && (
            <div className="inline-flex items-center gap-2 mt-8 bg-muted rounded-full p-1">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === "monthly"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billing === "yearly"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  Save {yearlySavings}%
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Free</h2>
              <p className="text-muted-foreground text-sm">Perfect for getting started</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground ml-1">/ month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isAuthenticated && userPlan === "free" ? (
              <Button variant="outline" disabled className="w-full">
                Current plan
              </Button>
            ) : !isAuthenticated ? (
              <Link href="/signup">
                <Button variant="outline" className="w-full">
                  Get started free
                </Button>
              </Link>
            ) : null}
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-primary bg-card p-8 flex flex-col relative overflow-hidden shadow-lg shadow-primary/10">
            <div className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Pro
            </div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Pro</h2>
              <p className="text-muted-foreground text-sm">For serious financial tracking</p>
            </div>
            <div className="mb-6">
              {loading ? (
                <div className="h-10 flex items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : selectedPrice ? (
                <>
                  <span className="text-4xl font-bold">
                    {formatPrice(selectedPrice.unit_amount, selectedPrice.currency)}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    / {billing === "monthly" ? "month" : "year"}
                  </span>
                  {billing === "yearly" && monthlyPrice && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatPrice(Math.round(yearlyPrice!.unit_amount / 12), selectedPrice.currency)}/mo billed annually
                    </p>
                  )}
                </>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">Coming soon</span>
              )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isAuthenticated && userPlan === "pro" ? (
              <Button disabled className="w-full">
                Current plan
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleUpgrade}
                disabled={checkoutLoading !== null || (!selectedPrice && isAuthenticated)}
              >
                {checkoutLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isAuthenticated ? "Upgrade to Pro" : "Start free trial"}
              </Button>
            )}
          </div>
        </div>

        {/* FAQ note */}
        <p className="text-center text-sm text-muted-foreground mt-12">
          All plans include secure data encryption. Cancel anytime.{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy policy
          </Link>
        </p>
      </main>
    </div>
  );
}
