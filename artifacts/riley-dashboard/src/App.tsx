import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shield, Activity, List, Play, Bug, Network, Radar, Globe, Cpu, ArrowLeft, Search, Eye } from "lucide-react";
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
import OsintPage from "@/pages/osint";
import LandingPage from "@/pages/landing";
import { useEffect } from "react";

const queryClient = new QueryClient();

// Nav item groups — CyFocus style: Detection top, Tools middle, Intel bottom
const NAV_GROUPS = [
  {
    label: "MONITORING",
    items: [
      { href: "/",        label: "Dashboard",   icon: Activity, urgency: false },
      { href: "/alerts",  label: "Alert Queue", icon: List,     urgency: true  },
      { href: "/patterns",label: "Patterns",    icon: Network,  urgency: true  },
    ],
  },
  {
    label: "AGENTS",
    items: [
      { href: "/tier1",        label: "Tier 1 Agent", icon: Cpu,    urgency: false },
      { href: "/investigate/0",label: "Investigate",  icon: Search, urgency: false },
      { href: "/bugscan",      label: "Bug Scanner",  icon: Bug,    urgency: false },
      { href: "/simulate",     label: "Simulate",     icon: Play,   urgency: false },
    ],
  },
  {
    label: "INTEL",
    items: [
      { href: "/recon",      label: "Recon Agent", icon: Radar,  urgency: false },
      { href: "/osint",      label: "OSINT",       icon: Eye,    urgency: false },
      { href: "/threat-map", label: "Threat Globe", icon: Globe,  urgency: false },
    ],
  },
];

function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row dark scanline-overlay">
      <AnimatedBackground />

      {/* ── Sidebar ── */}
      <aside
        className="w-full md:w-56 border-r flex flex-col shrink-0 relative z-10"
        style={{
          background: "rgba(9,11,18,0.97)",
          borderColor: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Logo */}
        <div
          className="px-4 py-4 border-b flex items-center gap-3"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{
              background: "rgba(132,0,255,0.2)",
              border: "1px solid rgba(132,0,255,0.4)",
              boxShadow: "0 0 16px rgba(132,0,255,0.2)",
            }}
          >
            <Shield className="w-4 h-4" style={{ color: "hsl(272,100%,72%)" }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-[0.2em] text-foreground font-mono">RILEY</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#22c55e" }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#22c55e" }} />
              </span>
              <span className="text-[9px] font-mono text-green-500/70 uppercase tracking-widest">SECURE</span>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 py-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-4 mb-1.5">
                <span className="text-[8px] font-mono tracking-[0.25em] text-muted-foreground/30 uppercase">
                  {group.label}
                </span>
              </div>
              <div className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href ||
                    (item.href.startsWith("/investigate") && location.startsWith("/investigate"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-150"
                      style={
                        isActive
                          ? {
                              background: "rgba(132,0,255,0.12)",
                              color: "hsl(272,100%,72%)",
                              borderLeft: "2px solid hsl(272,100%,60%)",
                              paddingLeft: "10px",
                              boxShadow: "inset 0 0 20px rgba(132,0,255,0.06)",
                            }
                          : {
                              color: "rgba(180,185,200,0.55)",
                              borderLeft: "2px solid transparent",
                            }
                      }
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="tracking-wide">{item.label}</span>
                      {item.urgency && !isActive && (
                        <span
                          className="ml-auto w-1.5 h-1.5 rounded-full threat-pulse-slow"
                          style={{ background: "#f97316" }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="p-3 border-t space-y-1"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <Link
            href="/landing"
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono rounded-lg transition-colors"
            style={{ color: "rgba(180,185,200,0.35)" }}
          >
            <ArrowLeft className="w-3 h-3" />
            HOME PAGE
          </Link>
          <p className="px-3 text-[8px] font-mono text-muted-foreground/20 tracking-wider">
            v1.0.0 · Riley Security AI
          </p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative z-10">
        <div className="p-6 md:p-8 flex-1">
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
  "/osint": "OSINT",
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
          <Route path="/osint" component={OsintPage} />
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
