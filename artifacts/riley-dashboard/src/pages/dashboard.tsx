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

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-destructive text-destructive bg-destructive/10",
  high: "border-orange-500 text-orange-500 bg-orange-500/10",
  medium: "border-yellow-500 text-yellow-500 bg-yellow-500/10",
  low: "border-primary text-primary bg-primary/10",
};

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
    const headers = [
      "alertId", "title", "severity", "status", "mitreTactic", "source",
      "assetName", "confidence", "createdAt", "description",
    ];
    const rows = alerts.map((a) => [
      a.alertId, a.title, a.severity, a.status, a.mitreTactic, a.source,
      a.assetName, a.confidence, a.createdAt, a.description,
    ].map(toCsvValue).join(","));
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
        <div className="h-8 w-48 bg-muted mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted border border-border"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">SYSTEM STATUS</h1>
          <p className="text-muted-foreground font-mono mt-2">REAL-TIME TELEMETRY / LAST 24 HOURS</p>
        </div>
        <Button
          variant="outline"
          className="rounded-none font-mono text-xs tracking-wider border-border hover:bg-primary/10 hover:text-primary"
          onClick={handleExportCsv}
          disabled={!alerts || alerts.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          EXPORT REPORT (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border border-l-4 border-l-primary rounded-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal">ALERTS PROCESSED</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground">{summary.alertsProcessed24h}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border border-l-4 border-l-accent rounded-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal">NOISE REDUCTION</CardTitle>
            <Zap className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground">{summary.noiseReductionPct}%</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-4 border-l-primary rounded-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal">AVG TRIAGE TIME</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground">{summary.avgTriageSeconds}s</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-4 border-l-primary rounded-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal">AUTO-RESOLVED</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground">{summary.autoResolvedPct}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-card border-border rounded-none lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal tracking-wider">SEVERITY BREAKDOWN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-destructive flex items-center gap-2"><ShieldBan className="h-4 w-4"/> CRITICAL</span>
                <span>{summary.severityBreakdown.critical}</span>
              </div>
              <div className="h-2 bg-secondary w-full">
                <div className="h-full bg-destructive" style={{ width: `${Math.min(100, (summary.severityBreakdown.critical / Math.max(1, summary.openAlerts)) * 100)}%` }}></div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-orange-500 flex items-center gap-2"><ShieldAlert className="h-4 w-4"/> HIGH</span>
                <span>{summary.severityBreakdown.high}</span>
              </div>
              <div className="h-2 bg-secondary w-full">
                <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, (summary.severityBreakdown.high / Math.max(1, summary.openAlerts)) * 100)}%` }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-yellow-500 flex items-center gap-2"><ShieldAlert className="h-4 w-4"/> MEDIUM</span>
                <span>{summary.severityBreakdown.medium}</span>
              </div>
              <div className="h-2 bg-secondary w-full">
                <div className="h-full bg-yellow-500" style={{ width: `${Math.min(100, (summary.severityBreakdown.medium / Math.max(1, summary.openAlerts)) * 100)}%` }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-primary flex items-center gap-2"><Shield className="h-4 w-4"/> LOW</span>
                <span>{summary.severityBreakdown.low}</span>
              </div>
              <div className="h-2 bg-secondary w-full">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (summary.severityBreakdown.low / Math.max(1, summary.openAlerts)) * 100)}%` }}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal tracking-wider">RECENT ALERTS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.recentAlerts.map(alert => (
                <div key={alert.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-border bg-background/50 gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono px-2 py-0.5 border ${
                        alert.severity === 'critical' ? 'border-destructive text-destructive bg-destructive/10' :
                        alert.severity === 'high' ? 'border-orange-500 text-orange-500 bg-orange-500/10' :
                        alert.severity === 'medium' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                        'border-primary text-primary bg-primary/10'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="font-mono text-muted-foreground text-sm">{alert.alertId}</span>
                    </div>
                    <h3 className="text-foreground font-medium mt-2">{alert.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{alert.description}</p>
                  </div>
                  <div className="flex flex-col md:items-end gap-1 text-sm font-mono">
                    <span className="text-muted-foreground">CONFIDENCE: <span className="text-foreground">{(alert.confidence * 100).toFixed(0)}%</span></span>
                    <span className="text-muted-foreground">SOURCE: <span className="text-foreground">{alert.source}</span></span>
                  </div>
                </div>
              ))}
              {summary.recentAlerts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground font-mono">NO RECENT ALERTS</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-card border-border rounded-none lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal tracking-wider">TRIAGE STATUS</CardTitle>
            <CircleDot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-yellow-500 flex items-center gap-2"><CircleDot className="h-4 w-4" /> PENDING</span>
                <span>{statusBreakdown.pending}</span>
              </div>
              <div className="h-2 bg-secondary w-full">
                <div className="h-full bg-yellow-500" style={{ width: `${Math.min(100, (statusBreakdown.pending / totalStatus) * 100)}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-destructive flex items-center gap-2"><CircleCheck className="h-4 w-4" /> TRUE POSITIVE</span>
                <span>{statusBreakdown.true_positive}</span>
              </div>
              <div className="h-2 bg-secondary w-full">
                <div className="h-full bg-destructive" style={{ width: `${Math.min(100, (statusBreakdown.true_positive / totalStatus) * 100)}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><CircleX className="h-4 w-4" /> FALSE POSITIVE</span>
                <span>{statusBreakdown.false_positive}</span>
              </div>
              <div className="h-2 bg-secondary w-full">
                <div className="h-full bg-muted-foreground" style={{ width: `${Math.min(100, (statusBreakdown.false_positive / totalStatus) * 100)}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-primary flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> RESOLVED</span>
                <span>{statusBreakdown.resolved}</span>
              </div>
              <div className="h-2 bg-secondary w-full">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (statusBreakdown.resolved / totalStatus) * 100)}%` }}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-none lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal tracking-wider">ALERT SOURCES</CardTitle>
            <Radio className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO DATA</div>
            ) : (
              sourceBreakdown.map(([source, count]) => (
                <div key={source} className="space-y-2">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-foreground">{source}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 bg-secondary w-full">
                    <div className="h-full bg-accent" style={{ width: `${(count / maxSourceCount) * 100}%` }}></div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-none lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono text-muted-foreground font-normal tracking-wider">TOP AFFECTED ASSETS</CardTitle>
            <Server className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4">
            {assetBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO DATA</div>
            ) : (
              assetBreakdown.map(([asset, count]) => (
                <div key={asset} className="space-y-2">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-foreground">{asset}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 bg-secondary w-full">
                    <div className="h-full bg-primary" style={{ width: `${(count / maxAssetCount) * 100}%` }}></div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border rounded-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-mono text-muted-foreground font-normal tracking-wider">ACTIVE CAMPAIGNS</CardTitle>
          <Link href="/patterns" className="text-xs font-mono text-primary flex items-center gap-1 hover:underline">
            VIEW ALL <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {topPatterns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO PATTERNS DETECTED</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {topPatterns.map((pattern) => (
                <div key={pattern.id} className="p-4 border border-border bg-background/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <Network className="h-4 w-4 text-primary" />
                    <span className={`text-xs font-mono px-2 py-0.5 border ${SEVERITY_STYLES[pattern.severity] ?? SEVERITY_STYLES.low}`}>
                      {pattern.severity.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-foreground font-medium text-sm">{pattern.name}</h4>
                  <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                    <span>{pattern.mitreTactic}</span>
                    <span className="text-foreground">{pattern.alertCount} ALERTS</span>
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