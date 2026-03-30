import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "./lib/auth-context";
import { SettingsProvider } from "./lib/settings-context";
import { Layout } from "./components/layout";

// Pages
import Landing from "./pages/landing";
import Login from "./pages/login";
import Signup from "./pages/signup";
import ResetPassword from "./pages/reset-password";
import Dashboard from "./pages/dashboard";
import Transactions from "./pages/transactions";
import Accounts from "./pages/accounts";
import Budget from "./pages/budget";
import Categories from "./pages/categories";
import Reports from "./pages/reports";
import Projects from "./pages/projects";
import SettingsPage from "./pages/settings";
import AssetsPage from "./pages/assets";
import Privacy from "./pages/privacy";
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
      {/* Root: landing page for visitors, dashboard for authenticated users */}
      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Landing />}
      </Route>

      <Route path="/login">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Login />}
      </Route>

      <Route path="/signup">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Signup />}
      </Route>

      <Route path="/reset-password">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <ResetPassword />}
      </Route>

      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/transactions" component={() => <ProtectedRoute component={Transactions} />} />
      <Route path="/accounts" component={() => <ProtectedRoute component={Accounts} />} />
      <Route path="/budget" component={() => <ProtectedRoute component={Budget} />} />
      <Route path="/categories" component={() => <ProtectedRoute component={Categories} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/projects" component={() => <ProtectedRoute component={Projects} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/assets" component={() => <ProtectedRoute component={AssetsPage} />} />

      {/* Public routes — accessible without authentication */}
      <Route path="/privacy" component={Privacy} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
