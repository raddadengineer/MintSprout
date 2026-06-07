import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Navigation } from "@/components/navigation";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import Payments from "@/pages/payments";
import Learn from "@/pages/learn";
import Reports from "@/pages/reports";
import Family from "@/pages/family";
import Spending from "@/pages/spending";
import Donations from "@/pages/donations";
import Savings from "@/pages/savings";
import Activity from "@/pages/activity";
import Controls from "@/pages/controls";
import Login from "@/pages/login";
import Kiosk from "@/pages/kiosk";
import NotFound from "@/pages/not-found";
import { SproutBuddyProvider } from "@/components/sprout-buddy";
import { ParentRoute } from "@/components/parent-route";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isAuthenticated && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4 animate-bounce">
            <span className="text-white font-bold text-lg">🌱</span>
          </div>
          <p className="text-gray-600">Loading MintSprout...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/kiosk" component={Kiosk} />
        <Route component={Kiosk} />
      </Switch>
    );
  }

  return (
    <SproutBuddyProvider>
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        <Navigation />
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/jobs" component={Jobs} />
          <Route path="/payments" component={Payments} />
          <Route path="/savings" component={Savings} />
          <Route path="/spending" component={Spending} />
          <Route path="/donations" component={Donations} />
          <Route path="/activity" component={Activity} />
          <Route path="/controls" component={() => <ParentRoute component={Controls} />} />
          <Route path="/learn" component={Learn} />
          <Route path="/reports" component={Reports} />
          <Route path="/family" component={() => <ParentRoute component={Family} />} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </SproutBuddyProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
