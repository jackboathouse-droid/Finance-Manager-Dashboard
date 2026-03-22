import { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/";
      },
      onError: () => {
        toast({
          title: "Logout failed",
          description: "There was a problem logging out.",
          variant: "destructive",
        });
      },
    });
  };

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background/50">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-40 relative flex h-16 shrink-0 items-center gap-x-4 border-b border-border/50 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            {/* Centred slogan — only visible for logged-in users (this layout is auth-only) */}
            <span
              aria-hidden="false"
              className="hidden sm:block pointer-events-none select-none absolute left-1/2 -translate-x-1/2"
              style={{
                fontFamily: "'Dancing Script', cursive",
                fontWeight: 700,
                fontSize: "22px",
                color: "#4FC3F7",
                whiteSpace: "nowrap",
                letterSpacing: "0.1px",
                opacity: 0.85,
                transition: "font-size 0.4s ease",
              }}
            >
              Balance, Budget and Breathe
            </span>
            <div className="flex flex-1 items-center justify-end gap-x-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                  {user?.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
