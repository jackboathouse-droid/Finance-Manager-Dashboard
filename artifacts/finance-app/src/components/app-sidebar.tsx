import { Link, useLocation } from "wouter";
import { LayoutDashboard, ReceiptText, Landmark, Target, Tag, BarChart2, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BubbleLogo } from "@/components/bubble-logo";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ReceiptText },
  { title: "Accounts", url: "/accounts", icon: Landmark },
  { title: "Budget", url: "/budget", icon: Target },
  { title: "Projects", url: "/projects", icon: Rocket },
  { title: "Reports", url: "/reports", icon: BarChart2 },
  { title: "Categories", url: "/categories", icon: Tag },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-border/50 bg-card">
      <SidebarHeader className="p-6">
        <div className="px-2">
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
    </Sidebar>
  );
}
