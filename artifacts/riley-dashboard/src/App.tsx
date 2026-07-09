import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shield, Activity, List, Play, Bug, Network, Radar, Globe, Cpu, ArrowLeft, Search } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { RileyChat } from "@/components/RileyChat";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Alerts from "@/pages/alerts";
import Simulate from "@/pages/simulate";
import Patterns from "@/pages/patterns";
import BugScan from "@/pages/bugscan";
import Recon from "@/pages/recon";
import ThreatMap from "@/pages/threat-map";
import Tier1 from "@/pages/tier1";
import InvestigatePage from "@/pages/investigate";
import LandingPage from "@/pages/landing";
import { useEffect } from "react";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/alerts", label: "Alert Queue", icon: List },
    { href: "/simulate", label: "Simulate", icon: Play },
    { href: "/patterns", label: "Patterns", icon: Network },
    { href: "/tier1", label: "Tier 1 Agent", icon: Cpu },
    { href: "/investigate/0", label: "Investigate", icon: Search },
    { href: "/bugscan", label: "Bug Scanner", icon: Bug },
    { href: "/recon", label: "Recon Agent", icon: Radar },
    { href: "/threat-map", label: "Threat Globe", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row dark scanline-overlay">
      {/* Animated particle-network background (unicorn.studio-style) */}
      <AnimatedBackground />
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="w-full md:w-60 border-r border-border bg-card flex flex-col shrink-0 relative z-10">
        {/* Logo / Header */}
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md shrink-0"
            style={{ background: "rgba(132, 0, 255, 0.15)", border: "1px solid rgba(132, 0, 255, 0.25)" }}
          >
            <Shield className="w-4 h-4" style={{ color: "hsl(272, 100%, 62%)" }} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.15em] text-foreground font-mono">
              RILEY
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "hsl(272, 100%, 62%)" }}></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "hsl(272, 100%, 62%)" }}></span>
              </span>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-150 rounded-md",
                  isActive
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                ].join(" ")}
                style={
                  isActive
                    ? { borderLeft: "2px solid hsl(272, 100%, 54%)", paddingLeft: "10px" }
                    : { borderLeft: "2px solid transparent" }
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-mono tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-border space-y-1">
          <Link
            href="/landing"
            className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary/60"
          >
            <ArrowLeft className="w-3 h-3" />
            HOME PAGE
          </Link>
          <p className="px-3 text-[9px] font-mono text-muted-foreground/40 tracking-wider">
            v1.0.0 · Riley Security
          </p>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative z-10">
        <div className="p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

const PAGE_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/alerts": "Alert Queue",
  "/simulate": "Simulate",
  "/patterns": "Patterns",
  "/bugscan": "Bug Scanner",
  "/recon": "Recon Agent",
  "/threat-map": "Threat Globe",
  "/tier1": "Tier 1 Agent",
  "/investigate": "Investigate",
};

function Router() {
  const [location] = useLocation();
  const currentPage = PAGE_NAMES[location] ?? "Dashboard";

  return (
    <>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/simulate" component={Simulate} />
          <Route path="/patterns" component={Patterns} />
          <Route path="/bugscan" component={BugScan} />
          <Route path="/recon" component={Recon} />
          <Route path="/threat-map" component={ThreatMap} />
          <Route path="/tier1" component={Tier1} />
          <Route path="/investigate/:id" component={InvestigatePage} />
          <Route path="/landing" component={LandingPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
      {/* RILEY AI Agent — floating chat panel */}
      <RileyChat currentPage={currentPage} />
    </>
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
