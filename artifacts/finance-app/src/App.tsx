import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "./lib/auth-context";
import { Layout } from "./components/layout";

// Pages
import Login from "./pages/login";
import Signup from "./pages/signup";
import Dashboard from "./pages/dashboard";
import Transactions from "./pages/transactions";
import Accounts from "./pages/accounts";
import Budget from "./pages/budget";
import Categories from "./pages/categories";
import Reports from "./pages/reports";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

// A wrapper to protect routes that require authentication
function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading application...</div>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background">Loading application...</div>;

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>

      <Route path="/signup">
        {isAuthenticated ? <Redirect to="/" /> : <Signup />}
      </Route>
      
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/transactions" component={() => <ProtectedRoute component={Transactions} />} />
      <Route path="/accounts" component={() => <ProtectedRoute component={Accounts} />} />
      <Route path="/budget" component={() => <ProtectedRoute component={Budget} />} />
      <Route path="/categories" component={() => <ProtectedRoute component={Categories} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
