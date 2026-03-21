import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { username, password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          setLocation("/");
        },
        onError: () => {
          toast({
            title: "Login failed",
            description: "Please check your credentials and try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background relative z-10">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex items-center gap-3 mb-10 justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Wallet className="h-6 w-6" />
            </div>
            <span className="font-display text-3xl font-bold tracking-tight text-foreground">
              Bubble
            </span>
          </div>

          <Card className="border-border/50 shadow-xl shadow-black/5 bg-card/50 backdrop-blur-xl">
            <CardHeader className="space-y-2 text-center pb-6">
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription className="text-base">
                Sign in to manage your finances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 bg-background/50"
                    placeholder="Enter your username"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-background/50"
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              <div className="mt-8 text-center text-sm text-muted-foreground">
                <p>Demo credentials: admin / admin</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Abstract Art */}
      <div className="hidden lg:block lg:flex-1 relative bg-slate-900 overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Abstract fintech background"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent"></div>
        <div className="absolute bottom-16 left-16 right-16 z-20">
          <h2 className="text-4xl font-display font-bold text-white mb-4">
            Master your money.
          </h2>
          <p className="text-lg text-slate-300 max-w-lg">
            Track expenses, manage budgets, and achieve your financial goals with absolute clarity.
          </p>
        </div>
      </div>
    </div>
  );
}
