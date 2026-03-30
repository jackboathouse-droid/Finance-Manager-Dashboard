import { Link, useLocation } from "wouter";
import { LayoutDashboard, ReceiptText, Landmark, Target, Tag, BarChart2, Rocket, Settings, Scale, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BubbleLogo } from "@/components/bubble-logo";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ReceiptText },
  { title: "Accounts", url: "/accounts", icon: Landmark },
  { title: "Assets & Liabilities", url: "/assets", icon: Scale },
  { title: "Budget", url: "/budget", icon: Target },
  { title: "Projects", url: "/projects", icon: Rocket },
  { title: "Reports", url: "/reports", icon: BarChart2 },
  { title: "Categories", url: "/categories", icon: Tag },
];

const bottomNavItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    fetch(`${BASE}/api/billing/status`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.plan) setPlan(d.plan); })
      .catch(() => {});
  }, [user]);

  const isPro = plan === "pro";

  return (
    <Sidebar className="border-r border-border/50 bg-card">
      <SidebarHeader className="p-6">
        <div className="px-2 flex items-center gap-3">
          <div
            style={{
              display: "inline-block",
              transform: "scale(1.15)",
              transformOrigin: "left center",
              transition: "transform 0.35s ease",
            }}
          >
            <BubbleLogo size="md" />
          </div>
          {isPro && (
            <span className="ml-1 inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full border border-primary/20">
              <Zap className="h-3 w-3" />
              Pro
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.url}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                        {item.title}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Settings + upgrade CTA pinned at bottom */}
      <SidebarFooter className="px-4 pb-4">
        <SidebarMenu>
          {bottomNavItems.map((item) => {
            const isActive = location === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <Link
                    href={item.url}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                    {item.title}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {!isPro && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-foreground mb-0.5">Upgrade to Pro</p>
            <p className="text-xs text-muted-foreground mb-2">Unlimited accounts, transactions & more.</p>
            <Link href="/pricing">
              <button className="w-full text-xs font-semibold bg-primary text-primary-foreground rounded-lg py-1.5 px-3 flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors">
                <Zap className="h-3 w-3" />
                View plans
              </button>
            </Link>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
