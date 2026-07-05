import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shield, Activity, List, Play, Bug, Network, ArrowLeft } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Alerts from "@/pages/alerts";
import Simulate from "@/pages/simulate";
import Patterns from "@/pages/patterns";
import BugScan from "@/pages/bugscan";
import { useEffect } from "react";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/alerts", label: "Alert Queue", icon: List },
    { href: "/simulate", label: "Simulate", icon: Play },
    { href: "/patterns", label: "Patterns", icon: Network },
    { href: "/bugscan", label: "Bug Scanner", icon: Bug },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row dark">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="font-mono text-xl font-bold tracking-wider text-primary">RILEY</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">AGENT ONLINE</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-3 text-sm font-mono transition-colors ${isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground border-l-2 border-transparent"}`}>
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border space-y-3">
          <a
            href="/"
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK TO HOME
          </a>
          <p className="px-4 text-[10px] font-mono text-muted-foreground/60 tracking-wider">
            v1.0.0 · Riley Security
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <div className="p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/simulate" component={Simulate} />
        <Route path="/patterns" component={Patterns} />
        <Route path="/bugscan" component={BugScan} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;