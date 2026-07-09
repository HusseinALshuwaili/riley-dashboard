/**
 * Dashboard — CyFocus-inspired cybersecurity overview
 * System risk score · KPI strip · Risk heat map · Live incident feed · Campaign tracker
 */

import { useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useGetDashboardSummary, useListAlerts, useListPatterns } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert, Zap, Clock, ShieldCheck, Activity, ShieldBan, Shield,
  Network, Server, Radio, CircleCheck, CircleX, CircleDot, ArrowRight,
  Download, AlertTriangle, TrendingUp, TrendingDown, Minus, Eye,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toCsvValue(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const SEV_CONFIG = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.35)",   label: "CRITICAL" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.35)",  label: "HIGH" },
  medium:   { color: "#eab308", bg: "rgba(234,179,8,0.1)",   border: "rgba(234,179,8,0.3)",    label: "MEDIUM" },
  low:      { color: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)",   label: "LOW" },
} as const;

type Sev = keyof typeof SEV_CONFIG;

function SevBadge({ sev }: { sev: string }) {
  const cfg = SEV_CONFIG[sev as Sev] ?? SEV_CONFIG.low;
  return (
    <span
      className="text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, pct)}%`, background: color }}
      />
    </div>
  );
}

/** Compute system risk score 0–100 */
function computeRiskScore(
  criticals: number,
  highs: number,
  mediums: number,
  total: number
): number {
  if (total === 0) return 0;
  const weighted = criticals * 4 + highs * 2 + mediums;
  const max = total * 4;
  return Math.round(Math.min(100, (weighted / max) * 100));
}

function riskLevel(score: number): { label: string; color: string; glow: string } {
  if (score >= 80) return { label: "CRITICAL", color: "#ef4444", glow: "rgba(239,68,68,0.25)" };
  if (score >= 60) return { label: "HIGH",     color: "#f97316", glow: "rgba(249,115,22,0.2)" };
  if (score >= 35) return { label: "MEDIUM",   color: "#eab308", glow: "rgba(234,179,8,0.18)" };
  if (score >= 10) return { label: "LOW",      color: "#22c55e", glow: "rgba(34,197,94,0.15)" };
  return               { label: "CLEAR",    color: "#3b82f6", glow: "rgba(59,130,246,0.15)" };
}

// ── Components ───────────────────────────────────────────────────────────────

function RiskScoreHero({
  score, criticals, highs, mediums, lows,
}: {
  score: number; criticals: number; highs: number; mediums: number; lows: number;
}) {
  const level = riskLevel(score);
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div
      className="rounded-2xl border p-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse 80% 100% at 0% 50%, ${level.glow}, transparent 70%), rgba(14,17,24,0.9)`,
        borderColor: `${level.color}30`,
        boxShadow: `0 0 60px ${level.glow}`,
      }}
    >
      {/* Decorative grid dots */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, ${level.color}20 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* SVG gauge */}
      <div className="relative shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140" className="rotate-[-90deg]">
          {/* Track */}
          <circle cx="70" cy="70" r="54" fill="none" strokeWidth="10" stroke="rgba(255,255,255,0.05)" />
          {/* Progress */}
          <circle
            cx="70" cy="70" r="54"
            fill="none" strokeWidth="10"
            stroke={level.color}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${level.color})`,
              transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-mono font-black text-foreground">{score}</span>
          <span className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground">RISK SCORE</span>
        </div>
      </div>

      {/* Risk info */}
      <div className="flex-1 space-y-4 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span
              className="text-xs font-mono font-bold tracking-[0.2em] px-3 py-1 rounded-full border"
              style={{ color: level.color, borderColor: `${level.color}50`, background: `${level.color}15` }}
            >
              {level.label}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/50">SYSTEM THREAT LEVEL</span>
          </div>
          <h2 className="text-2xl font-mono font-bold text-foreground">
            Riley SOC Dashboard
          </h2>
          <p className="text-xs font-mono text-muted-foreground/60 mt-1">
            REAL-TIME TELEMETRY · LAST 24 HOURS
          </p>
        </div>

        {/* Severity breakdown bars */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {[
            { label: "CRITICAL", count: criticals, color: "#ef4444" },
            { label: "HIGH",     count: highs,     color: "#f97316" },
            { label: "MEDIUM",   count: mediums,   color: "#eab308" },
            { label: "LOW",      count: lows,      color: "#22c55e" },
          ].map(({ label, count, color }) => {
            const total = criticals + highs + mediums + lows;
            return (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span style={{ color }} className="opacity-80">{label}</span>
                  <span className="text-foreground font-bold tabular-nums">{count}</span>
                </div>
                <ProgressBar pct={total ? (count / total) * 100 : 0} color={color} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: alerts } = useListAlerts();
  const { data: patterns } = useListPatterns();

  const sourceBreakdown = useMemo(() => {
    if (!alerts) return [];
    const counts = new Map<string, number>();
    for (const a of alerts) counts.set(a.source, (counts.get(a.source) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [alerts]);

  const assetBreakdown = useMemo(() => {
    if (!alerts) return [];
    const counts = new Map<string, number>();
    for (const a of alerts) counts.set(a.assetName, (counts.get(a.assetName) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
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

  // Risk heat map — per-tactic severity distribution
  const tacticHeatMap = useMemo(() => {
    if (!alerts) return [];
    const tactics = new Map<string, { critical: number; high: number; medium: number; low: number; total: number }>();
    for (const a of alerts) {
      const t = a.mitreTactic ?? "Unknown";
      const existing = tactics.get(t) ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      existing[a.severity as Sev] = (existing[a.severity as Sev] ?? 0) + 1;
      existing.total += 1;
      tactics.set(t, existing);
    }
    return Array.from(tactics.entries())
      .sort((a, b) => b[1].critical * 4 + b[1].high * 2 - (a[1].critical * 4 + a[1].high * 2))
      .slice(0, 8);
  }, [alerts]);

  const riskScore = useMemo(() => {
    if (!summary) return 0;
    return computeRiskScore(
      summary.severityBreakdown.critical,
      summary.severityBreakdown.high,
      summary.severityBreakdown.medium,
      summary.openAlerts
    );
  }, [summary]);

  const maxSourceCount = Math.max(1, ...sourceBreakdown.map((s) => s[1]));
  const maxAssetCount  = Math.max(1, ...assetBreakdown.map((a)  => a[1]));
  const totalStatus    = Math.max(1, alerts?.length ?? 0);

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
    link.href = url; link.download = `riley-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  }, [alerts]);

  if (isLoading || !summary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 bg-card border border-border rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-card border border-border rounded-xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-card border border-border rounded-xl" />)}
        </div>
      </div>
    );
  }

  const level = riskLevel(riskScore);

  return (
    <div className="space-y-6">

      {/* ── Export button ── */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          className="font-mono text-xs tracking-wider hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all h-8 px-4"
          onClick={handleExportCsv}
          disabled={!alerts || alerts.length === 0}
        >
          <Download className="h-3.5 w-3.5 mr-2" />
          EXPORT CSV
        </Button>
      </div>

      {/* ── RISK SCORE HERO ── */}
      <RiskScoreHero
        score={riskScore}
        criticals={summary.severityBreakdown.critical}
        highs={summary.severityBreakdown.high}
        mediums={summary.severityBreakdown.medium}
        lows={summary.severityBreakdown.low}
      />

      {/* ── KPI STRIP ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "OPEN ALERTS",
            value: summary.openAlerts,
            sub: "requires attention",
            Icon: AlertTriangle,
            kpiClass: summary.openAlerts > 50 ? "kpi-danger" : summary.openAlerts > 20 ? "kpi-warning" : "kpi-safe",
            color: summary.openAlerts > 50 ? "#ef4444" : summary.openAlerts > 20 ? "#f97316" : "#22c55e",
            trend: <TrendingUp className="w-3.5 h-3.5" />,
          },
          {
            label: "ALERTS 24H",
            value: summary.alertsProcessed24h,
            sub: "processed & triaged",
            Icon: Activity,
            kpiClass: "kpi-info",
            color: "#3b82f6",
            trend: <Minus className="w-3.5 h-3.5" />,
          },
          {
            label: "NOISE REDUCED",
            value: `${summary.noiseReductionPct}%`,
            sub: "false-positive filtered",
            Icon: Zap,
            kpiClass: "kpi-brand",
            color: "hsl(272,100%,62%)",
            trend: <TrendingUp className="w-3.5 h-3.5" />,
          },
          {
            label: "AUTO-RESOLVED",
            value: `${summary.autoResolvedPct}%`,
            sub: "no analyst needed",
            Icon: ShieldCheck,
            kpiClass: "kpi-safe",
            color: "#22c55e",
            trend: <TrendingUp className="w-3.5 h-3.5" />,
          },
        ].map(({ label, value, sub, Icon, kpiClass, color, trend }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 card-glow-hover ${kpiClass}`}
            style={{ background: "rgba(14,17,24,0.8)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-mono tracking-widest text-muted-foreground/60 uppercase">{label}</span>
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: `${color}18` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <div className="text-3xl font-mono font-black text-foreground">{value}</div>
            <div className="flex items-center gap-1.5 mt-2">
              <span style={{ color }} className="opacity-60">{trend}</span>
              <span className="text-[10px] font-mono text-muted-foreground/40">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── ROW: Risk Heat Map + Incident Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Risk Heat Map — MITRE tactic × severity */}
        <div
          className="lg:col-span-2 rounded-xl border"
          style={{ background: "rgba(14,17,24,0.8)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div
              className="w-1.5 h-1.5 rounded-full threat-pulse"
              style={{ background: level.color }}
            />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              Risk Heat Map · MITRE Tactics
            </span>
          </div>
          <div className="p-4 space-y-2">
            {tacticHeatMap.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground/30 font-mono text-xs">NO ALERTS YET</div>
            ) : (
              tacticHeatMap.map(([tactic, counts]) => {
                const dominantSev: Sev = counts.critical > 0 ? "critical"
                  : counts.high > 0 ? "high"
                  : counts.medium > 0 ? "medium" : "low";
                const cfg = SEV_CONFIG[dominantSev];
                return (
                  <div
                    key={tactic}
                    className="flex items-center gap-3 p-2.5 rounded-lg border transition-colors"
                    style={{
                      background: cfg.bg,
                      borderColor: cfg.border,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
                    />
                    <span className="text-xs font-mono text-foreground/80 flex-1 truncate">{tactic}</span>
                    <div className="flex gap-1 shrink-0">
                      {counts.critical > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
                          {counts.critical}C
                        </span>
                      )}
                      {counts.high > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.2)", color: "#f97316" }}>
                          {counts.high}H
                        </span>
                      )}
                      {counts.medium > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(234,179,8,0.2)", color: "#eab308" }}>
                          {counts.medium}M
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 tabular-nums w-6 text-right">
                      {counts.total}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Incident Feed */}
        <div
          className="lg:col-span-3 rounded-xl border flex flex-col"
          style={{ background: "rgba(14,17,24,0.8)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 threat-pulse-slow" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                Live Incident Feed
              </span>
            </div>
            <Link
              href="/alerts"
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              VIEW ALL <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto divide-y" style={{ divideColor: "rgba(255,255,255,0.04)" }}>
            {summary.recentAlerts.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground/30 font-mono text-xs">
                NO INCIDENTS
              </div>
            ) : (
              summary.recentAlerts.map((alert, idx) => {
                const cfg = SEV_CONFIG[alert.severity as Sev] ?? SEV_CONFIG.low;
                return (
                  <div
                    key={alert.id}
                    className={`incident-row sev-${alert.severity} px-4 py-3 flex items-start gap-4`}
                    style={{
                      borderColor: "rgba(255,255,255,0.04)",
                      animationDelay: `${idx * 100}ms`,
                    }}
                  >
                    {/* Severity indicator */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
                      />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SevBadge sev={alert.severity} />
                        <span className="text-[9px] font-mono text-muted-foreground/40">{alert.alertId}</span>
                      </div>
                      <div className="text-xs font-medium text-foreground/90 truncate">{alert.title}</div>
                      <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-muted-foreground/40">
                        <span>{alert.source}</span>
                        <span>·</span>
                        <span style={{ color: cfg.color }}>{(alert.confidence * 100).toFixed(0)}% CONF</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── ROW: Triage Status + Sources + Assets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Triage Status */}
        <div
          className="rounded-xl border p-4"
          style={{ background: "rgba(14,17,24,0.8)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <CircleDot className="w-3.5 h-3.5" style={{ color: "hsl(272,100%,62%)" }} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Triage Status</span>
          </div>
          <div className="space-y-4">
            {[
              { label: "PENDING",        Icon: CircleDot,   color: "#eab308",  count: statusBreakdown.pending },
              { label: "TRUE POSITIVE",  Icon: CircleCheck, color: "#ef4444",  count: statusBreakdown.true_positive },
              { label: "FALSE POSITIVE", Icon: CircleX,     color: "#6b7280",  count: statusBreakdown.false_positive },
              { label: "RESOLVED",       Icon: ShieldCheck, color: "#22c55e",  count: statusBreakdown.resolved },
            ].map(({ label, Icon, color, count }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="flex items-center gap-2" style={{ color }}>
                    <Icon className="w-3 h-3" /> {label}
                  </span>
                  <span className="text-foreground tabular-nums font-bold">{count}</span>
                </div>
                <ProgressBar pct={(count / totalStatus) * 100} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Alert Sources */}
        <div
          className="rounded-xl border p-4"
          style={{ background: "rgba(14,17,24,0.8)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-3.5 h-3.5" style={{ color: "hsl(272,100%,62%)" }} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Alert Sources</span>
          </div>
          <div className="space-y-4">
            {sourceBreakdown.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground/30 font-mono text-xs">NO DATA</div>
            ) : (
              sourceBreakdown.map(([source, count]) => (
                <div key={source} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-foreground/80">{source}</span>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
                  </div>
                  <ProgressBar pct={(count / maxSourceCount) * 100} color="hsl(272,100%,62%)" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Affected Assets */}
        <div
          className="rounded-xl border p-4"
          style={{ background: "rgba(14,17,24,0.8)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-3.5 h-3.5" style={{ color: "#f97316" }} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Top Affected Assets</span>
          </div>
          <div className="space-y-4">
            {assetBreakdown.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground/30 font-mono text-xs">NO DATA</div>
            ) : (
              assetBreakdown.map(([asset, count], i) => (
                <div key={asset} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground/30 tabular-nums w-3">{i + 1}</span>
                      <span className="text-foreground/80">{asset}</span>
                    </div>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
                  </div>
                  <ProgressBar
                    pct={(count / maxAssetCount) * 100}
                    color={i === 0 ? "#ef4444" : i === 1 ? "#f97316" : "#eab308"}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Active Campaigns ── */}
      <div
        className="rounded-xl border"
        style={{ background: "rgba(14,17,24,0.8)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Network className="w-3.5 h-3.5" style={{ color: "#f97316" }} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              Active Attack Campaigns
            </span>
          </div>
          <Link
            href="/patterns"
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            VIEW ALL <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="p-4">
          {topPatterns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground/30 font-mono text-xs">
              NO PATTERNS DETECTED
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {topPatterns.map((pattern) => {
                const cfg = SEV_CONFIG[pattern.severity as Sev] ?? SEV_CONFIG.low;
                return (
                  <div
                    key={pattern.id}
                    className="p-4 rounded-xl border card-glow-hover space-y-3"
                    style={{
                      background: `${cfg.bg}`,
                      borderColor: cfg.border,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: `${cfg.color}15` }}
                      >
                        <Network className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                      </div>
                      <SevBadge sev={pattern.severity} />
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-foreground/90 leading-snug">{pattern.name}</h4>
                      <p className="text-[10px] font-mono text-muted-foreground/50 mt-1 truncate">{pattern.mitreTactic}</p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground/40">ALERTS</span>
                      <span className="font-bold" style={{ color: cfg.color }}>{pattern.alertCount}</span>
                    </div>
                    <ProgressBar pct={Math.min(100, (pattern.alertCount / 20) * 100)} color={cfg.color} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
