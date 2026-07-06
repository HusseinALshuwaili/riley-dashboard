import { useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useGetDashboardSummary, useListAlerts, useListPatterns } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Zap, Clock, ShieldCheck, Activity, ShieldBan, Shield, Network, Server, Radio, CircleCheck, CircleX, CircleDot, ArrowRight, Download } from "lucide-react";

function toCsvValue(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Returns Tailwind + inline style for severity badges */
function severityBadgeClass(sev: string) {
  switch (sev) {
    case "critical": return "border-destructive text-destructive bg-destructive/10";
    case "high":     return "border-orange-500 text-orange-400 bg-orange-500/10";
    case "medium":   return "border-yellow-500 text-yellow-400 bg-yellow-500/10";
    default:         return "border-primary text-primary bg-primary/10";
  }
}

/** Gradient progress bar track + fill */
function ProgressBar({ pct, variant = "primary" }: { pct: number; variant?: "primary" | "destructive" | "orange" | "yellow" | "accent" | "muted" }) {
  return (
    <div className="progress-track">
      <div className={`progress-fill-${variant}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: alerts } = useListAlerts();
  const { data: patterns } = useListPatterns();

  const sourceBreakdown = useMemo(() => {
    if (!alerts) return [];
    const counts = new Map<string, number>();
    for (const a of alerts) counts.set(a.source, (counts.get(a.source) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [alerts]);

  const assetBreakdown = useMemo(() => {
    if (!alerts) return [];
    const counts = new Map<string, number>();
    for (const a of alerts) counts.set(a.assetName, (counts.get(a.assetName) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [alerts]);

  const statusBreakdown = useMemo(() => {
    if (!alerts) return { pending: 0, true_positive: 0, false_positive: 0, resolved: 0 };
    const counts = { pending: 0, true_positive: 0, false_positive: 0, resolved: 0 };
    for (const a of alerts) {
      if (a.status in counts) counts[a.status as keyof typeof counts] += 1;
    }
    return counts;
  }, [alerts]);

  const topPatterns = useMemo(() => {
    if (!patterns) return [];
    return [...patterns].sort((a, b) => b.alertCount - a.alertCount).slice(0, 4);
  }, [patterns]);

  const maxSourceCount = Math.max(1, ...sourceBreakdown.map((s) => s[1]));
  const maxAssetCount = Math.max(1, ...assetBreakdown.map((a) => a[1]));
  const totalStatus = Math.max(1, alerts?.length ?? 0);

  const handleExportCsv = useCallback(() => {
    if (!alerts || alerts.length === 0) return;
    const headers = ["alertId", "title", "severity", "status", "mitreTactic", "source", "assetName", "confidence", "createdAt", "description"];
    const rows = alerts.map((a) =>
      [a.alertId, a.title, a.severity, a.status, a.mitreTactic, a.source, a.assetName, a.confidence, a.createdAt, a.description]
        .map(toCsvValue).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `riley-alert-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [alerts]);

  if (isLoading || !summary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted mb-8 rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted border border-border rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">
            SYSTEM STATUS
          </h1>
          <p className="text-muted-foreground font-mono mt-2 text-sm">
            REAL-TIME TELEMETRY / LAST 24 HOURS
          </p>
        </div>
        <Button
          variant="outline"
          className="font-mono text-xs tracking-wider hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all"
          onClick={handleExportCsv}
          disabled={!alerts || alerts.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          EXPORT REPORT (CSV)
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "ALERTS PROCESSED", value: summary.alertsProcessed24h, Icon: Activity, accent: "primary" as const },
          { label: "NOISE REDUCTION", value: `${summary.noiseReductionPct}%`, Icon: Zap, accent: "accent" as const },
          { label: "AVG TRIAGE TIME", value: `${summary.avgTriageSeconds}s`, Icon: Clock, accent: "primary" as const },
          { label: "AUTO-RESOLVED", value: `${summary.autoResolvedPct}%`, Icon: ShieldCheck, accent: "primary" as const },
        ].map(({ label, value, Icon, accent }) => (
          <Card
            key={label}
            className="border-border card-glow-hover"
            style={{
              borderTop: `2px solid hsl(${accent === "accent" ? "192, 100%, 50%" : "172, 100%, 42%"})`,
              boxShadow: `0 0 0 0 transparent, 0 4px 24px rgba(0,0,0,0.5)`,
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground font-normal tracking-wider">
                {label}
              </CardTitle>
              <div
                className="p-1.5 rounded-md"
                style={{
                  background: `hsl(${accent === "accent" ? "192 100% 50% / 0.12" : "172 100% 42% / 0.12"})`,
                }}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  style={{ color: `hsl(${accent === "accent" ? "192, 100%, 52%" : "172, 100%, 46%"})` }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-mono font-bold text-foreground">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Severity + Recent Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Severity Breakdown */}
        <Card className="border-border lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xs font-mono text-muted-foreground font-normal tracking-widest">
              SEVERITY BREAKDOWN
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: "CRITICAL", icon: ShieldBan,   color: "text-destructive", count: summary.severityBreakdown.critical, variant: "destructive" as const },
              { label: "HIGH",     icon: ShieldAlert,  color: "text-orange-400",  count: summary.severityBreakdown.high,     variant: "orange" as const },
              { label: "MEDIUM",   icon: ShieldAlert,  color: "text-yellow-400",  count: summary.severityBreakdown.medium,   variant: "yellow" as const },
              { label: "LOW",      icon: Shield,       color: "text-primary",     count: summary.severityBreakdown.low,      variant: "primary" as const },
            ].map(({ label, icon: Icon, color, count, variant }) => (
              <div key={label} className="space-y-2">
                <div className="flex justify-between font-mono text-sm">
                  <span className={`${color} flex items-center gap-2`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                  <span className="text-foreground tabular-nums">{count}</span>
                </div>
                <ProgressBar
                  pct={(count / Math.max(1, summary.openAlerts)) * 100}
                  variant={variant}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xs font-mono text-muted-foreground font-normal tracking-widest">
              RECENT ALERTS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.recentAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-border bg-secondary/30 gap-4 rounded-lg hover:border-border/60 hover:bg-secondary/50 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono px-2 py-0.5 border rounded-md ${severityBadgeClass(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="font-mono text-muted-foreground text-xs">{alert.alertId}</span>
                    </div>
                    <h3 className="text-foreground font-medium mt-2 text-sm">{alert.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{alert.description}</p>
                  </div>
                  <div className="flex flex-col md:items-end gap-1 text-xs font-mono shrink-0">
                    <span className="text-muted-foreground">
                      CONFIDENCE: <span className="text-primary font-bold">{(alert.confidence * 100).toFixed(0)}%</span>
                    </span>
                    <span className="text-muted-foreground">
                      SOURCE: <span className="text-foreground">{alert.source}</span>
                    </span>
                  </div>
                </div>
              ))}
              {summary.recentAlerts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                  NO RECENT ALERTS
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Triage Status + Sources + Assets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Triage Status */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground font-normal tracking-widest">
              TRIAGE STATUS
            </CardTitle>
            <CircleDot className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: "PENDING",       icon: CircleDot,   color: "text-yellow-400",  count: statusBreakdown.pending,        variant: "yellow" as const },
              { label: "TRUE POSITIVE", icon: CircleCheck, color: "text-destructive",  count: statusBreakdown.true_positive,  variant: "destructive" as const },
              { label: "FALSE POSITIVE",icon: CircleX,     color: "text-muted-foreground", count: statusBreakdown.false_positive, variant: "muted" as const },
              { label: "RESOLVED",      icon: ShieldCheck, color: "text-primary",      count: statusBreakdown.resolved,       variant: "primary" as const },
            ].map(({ label, icon: Icon, color, count, variant }) => (
              <div key={label} className="space-y-2">
                <div className="flex justify-between font-mono text-sm">
                  <span className={`${color} flex items-center gap-2`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                  <span className="text-foreground tabular-nums">{count}</span>
                </div>
                <ProgressBar pct={(count / totalStatus) * 100} variant={variant} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Alert Sources */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground font-normal tracking-widest">
              ALERT SOURCES
            </CardTitle>
            <Radio className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO DATA</div>
            ) : (
              sourceBreakdown.map(([source, count]) => (
                <div key={source} className="space-y-2">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-foreground">{source}</span>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
                  </div>
                  <ProgressBar pct={(count / maxSourceCount) * 100} variant="accent" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Assets */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground font-normal tracking-widest">
              TOP AFFECTED ASSETS
            </CardTitle>
            <Server className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4">
            {assetBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO DATA</div>
            ) : (
              assetBreakdown.map(([asset, count]) => (
                <div key={asset} className="space-y-2">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-foreground">{asset}</span>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
                  </div>
                  <ProgressBar pct={(count / maxAssetCount) * 100} variant="primary" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Active Campaigns ── */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-mono text-muted-foreground font-normal tracking-widest">
            ACTIVE CAMPAIGNS
          </CardTitle>
          <Link href="/patterns" className="text-xs font-mono text-primary flex items-center gap-1 hover:underline">
            VIEW ALL <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {topPatterns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              NO PATTERNS DETECTED
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {topPatterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="p-4 border border-border bg-secondary/30 space-y-3 rounded-lg card-glow-hover hover:bg-secondary/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="p-1.5 rounded-md"
                      style={{ background: "hsl(172 100% 42% / 0.1)" }}
                    >
                      <Network className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 border rounded-md ${severityBadgeClass(pattern.severity)}`}>
                      {pattern.severity.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-foreground font-medium text-sm leading-snug">{pattern.name}</h4>
                  <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                    <span className="truncate mr-2">{pattern.mitreTactic}</span>
                    <span className="text-primary font-bold shrink-0">{pattern.alertCount} ALERTS</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
