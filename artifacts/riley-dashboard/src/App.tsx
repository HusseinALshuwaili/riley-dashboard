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
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside
        className="w-full md:w-64 border-r border-border flex flex-col shrink-0"
        style={{
          background: "linear-gradient(180deg, hsl(228 38% 7%) 0%, hsl(228 35% 6%) 100%)",
        }}
      >
        {/* Logo / Header */}
        <div
          className="p-6 border-b border-border flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, hsl(228 45% 9%) 0%, hsl(228 38% 7%) 100%)",
          }}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{
              background: "linear-gradient(135deg, hsl(172 100% 20%) 0%, hsl(172 100% 32%) 100%)",
              boxShadow: "0 0 16px hsl(172 100% 42% / 0.3)",
            }}
          >
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1
              className="font-mono text-xl font-bold tracking-wider"
              style={{
                background: "linear-gradient(90deg, hsl(172, 100%, 52%), hsl(192, 100%, 60%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              RILEY
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                AGENT ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 px-4 py-3 text-sm font-mono transition-all duration-200 rounded-lg",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(90deg, hsl(172 100% 42% / 0.12) 0%, transparent 100%)",
                        borderLeft: "2px solid hsl(172, 100%, 42%)",
                        paddingLeft: "14px",
                        boxShadow: "0 0 20px hsl(172 100% 42% / 0.07)",
                      }
                    : {
                        borderLeft: "2px solid transparent",
                      }
                }
              >
                <Icon
                  className="w-4 h-4 shrink-0"
                  style={isActive ? { filter: "drop-shadow(0 0 4px hsl(172, 100%, 42%))" } : {}}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div
          className="p-4 border-t border-border space-y-3"
          style={{ background: "hsl(228 38% 6% / 0.8)" }}
        >
          <a
            href="https://riley-frontend-psi.vercel.app"
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK TO HOME
          </a>
          <p className="px-4 text-[9px] font-mono text-muted-foreground/50 tracking-wider">
            v1.0.0 · Riley Security
          </p>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────── */}
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
