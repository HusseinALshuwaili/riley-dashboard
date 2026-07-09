/**
 * Investigation Agent Page
 *
 * Deep-dive view for a single alert — runs 3-stage Groq pipeline:
 *   1. MITRE ATT&CK Mapper
 *   2. Attack Path / Kill Chain Tracer
 *   3. Root Cause + Blast Radius Analyzer
 *
 * Route: /investigate/:id
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import {
  ArrowLeft, Shield, Zap, Target, AlertTriangle, CheckCircle2,
  Clock, Activity, Search, GitBranch, Layers, ChevronRight,
  Terminal, Eye, Network, Server, User, HardDrive, Wifi,
  Cloud, Database
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types (mirrors investigation-agent.ts output)
// ---------------------------------------------------------------------------

interface MitreMapping {
  tactic: string; technique: string; subTechnique: string;
  tacticId: string; techniqueId: string; confidence: number;
  evidenceNotes: string; relatedTactics: string[];
}

interface KillChainPhase {
  phase: string;
  status: "confirmed" | "likely" | "possible" | "not_applicable";
  indicators: string[];
  toolsUsed: string[];
  timestamp?: string;
}

interface AttackPath {
  killChain: KillChainPhase[];
  attackerObjective: string;
  lateralMovement: boolean;
  dataExfilRisk: boolean;
  persistenceRisk: boolean;
  estimatedDwell: string;
  ttpSummary: string;
}

interface BlastRadiusAsset {
  name: string; type: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  exposureType: string;
}

interface RootCauseAnalysis {
  rootCause: string;
  immediateActions: string[];
  affectedAssets: BlastRadiusAsset[];
  remediationPriority: "p0" | "p1" | "p2" | "p3";
  estimatedRemediationH: number;
  preventionRecommendations: string[];
  threatActorProfile: string;
  iocList: string[];
}

interface InvestigationReport {
  alertId: number; alertTitle: string; severity: string;
  assetName: string; source: string;
  mitre: MitreMapping;
  attackPath: AttackPath;
  rootCause: RootCauseAnalysis;
  incidentRef: string | null;
  investigatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KILL_CHAIN_ORDER = [
  "Reconnaissance", "Weaponization", "Delivery",
  "Exploitation", "Installation", "C2", "Actions on Objectives"
];

function killChainStatusColor(status: KillChainPhase["status"]) {
  switch (status) {
    case "confirmed":       return { bg: "bg-destructive/20", border: "border-destructive/60", text: "text-destructive", dot: "bg-destructive" };
    case "likely":          return { bg: "bg-orange-500/15", border: "border-orange-500/50", text: "text-orange-400", dot: "bg-orange-400" };
    case "possible":        return { bg: "bg-yellow-500/10", border: "border-yellow-500/40", text: "text-yellow-400", dot: "bg-yellow-400" };
    case "not_applicable":  return { bg: "bg-secondary/30", border: "border-border", text: "text-muted-foreground/40", dot: "bg-muted-foreground/30" };
  }
}

function priorityBadge(p: string) {
  switch (p) {
    case "p0": return { label: "P0 — CRITICAL", cls: "bg-destructive/20 border-destructive text-destructive" };
    case "p1": return { label: "P1 — HIGH",     cls: "bg-orange-500/15 border-orange-500 text-orange-400" };
    case "p2": return { label: "P2 — MEDIUM",   cls: "bg-yellow-500/10 border-yellow-500 text-yellow-400" };
    default:   return { label: "P3 — LOW",       cls: "bg-primary/10 border-primary text-primary" };
  }
}

function assetIcon(type: string) {
  switch (type) {
    case "endpoint":  return <HardDrive className="w-4 h-4" />;
    case "server":    return <Server className="w-4 h-4" />;
    case "identity":  return <User className="w-4 h-4" />;
    case "network":   return <Wifi className="w-4 h-4" />;
    case "cloud":     return <Cloud className="w-4 h-4" />;
    case "data":      return <Database className="w-4 h-4" />;
    default:          return <Network className="w-4 h-4" />;
  }
}

function assetRiskColor(r: string) {
  switch (r) {
    case "critical": return "border-destructive/60 text-destructive bg-destructive/10";
    case "high":     return "border-orange-500/60 text-orange-400 bg-orange-500/10";
    case "medium":   return "border-yellow-500/50 text-yellow-400 bg-yellow-500/10";
    default:         return "border-primary/40 text-primary bg-primary/10";
  }
}

function severityColor(s: string) {
  switch (s) {
    case "critical": return "text-destructive";
    case "high":     return "text-orange-400";
    case "medium":   return "text-yellow-400";
    default:         return "text-primary";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-md" style={{ background: "rgba(132,0,255,0.12)", border: "1px solid rgba(132,0,255,0.2)" }}>
        <span style={{ color: "hsl(272,100%,62%)" }}>{icon}</span>
      </div>
      <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground">{title}</h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function InvestigationSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 bg-secondary/30 rounded-xl border border-border" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="h-48 bg-secondary/30 rounded-xl border border-border" />
        <div className="h-48 bg-secondary/30 rounded-xl border border-border" />
        <div className="h-48 bg-secondary/30 rounded-xl border border-border" />
      </div>
      <div className="h-64 bg-secondary/30 rounded-xl border border-border" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-56 bg-secondary/30 rounded-xl border border-border" />
        <div className="h-56 bg-secondary/30 rounded-xl border border-border" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function InvestigatePage() {
  const params = useParams<{ id: string }>();
  const alertId = parseInt(params.id ?? "0", 10);

  const [report, setReport]   = useState<InvestigationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [stage, setStage]     = useState(0);

  const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:3001") + "/api";

  // Try GET first (cached), then POST on demand
  useEffect(() => {
    if (!alertId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStage(0);

      try {
        // 1. Check cache
        const cached = await customFetch<InvestigationReport>(
          `${API_BASE}/investigate/${alertId}`, { method: "GET" }
        ).catch(() => null);

        if (cached && !cancelled) {
          setReport(cached);
          setLoading(false);
          return;
        }

        // 2. Run fresh investigation (show fake stage progress)
        const stageTimer = setInterval(() => {
          setStage(s => Math.min(s + 1, 3));
        }, 4000);

        const fresh = await customFetch<InvestigationReport>(
          `${API_BASE}/investigate/${alertId}`, { method: "POST" }
        );

        clearInterval(stageTimer);
        if (!cancelled) {
          setReport(fresh);
          setStage(3);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Investigation failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [alertId]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    const stages = [
      "Mapping to MITRE ATT&CK framework…",
      "Reconstructing kill chain…",
      "Analyzing blast radius & root cause…",
      "Compiling investigation report…",
    ];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/alerts">
            <button className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> BACK TO ALERTS
            </button>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(132,0,255,0.12)", border: "1px solid rgba(132,0,255,0.25)" }}
          >
            <Search className="w-8 h-8 animate-pulse" style={{ color: "hsl(272,100%,62%)" }} />
          </div>
          <div className="text-center">
            <p className="font-mono text-sm text-foreground mb-2">RUNNING INVESTIGATION</p>
            <p className="font-mono text-xs text-muted-foreground">{stages[Math.min(stage, stages.length - 1)]}</p>
          </div>
          <div className="flex gap-2">
            {stages.map((_, i) => (
              <div
                key={i}
                className="h-1 w-12 rounded-full transition-all duration-700"
                style={{ background: i <= stage ? "hsl(272,100%,54%)" : "hsl(var(--border))" }}
              />
            ))}
          </div>
        </div>
        <InvestigationSkeleton />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="space-y-6">
        <Link href="/alerts">
          <button className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> BACK TO ALERTS
          </button>
        </Link>
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <div className="text-center">
              <p className="font-mono text-sm text-foreground">INVESTIGATION FAILED</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">{error}</p>
            </div>
            <Button
              variant="outline"
              className="font-mono text-xs mt-2 border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
              onClick={() => window.location.reload()}
            >
              RETRY
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  const priority = priorityBadge(report.rootCause.remediationPriority);

  // ---------------------------------------------------------------------------
  // Report view
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Back nav */}
      <Link href="/alerts">
        <button className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK TO ALERTS
        </button>
      </Link>

      {/* Hero header */}
      <div
        className="rounded-xl border border-border p-6"
        style={{ background: "hsl(var(--card))", borderLeft: "3px solid hsl(272,100%,54%)" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-mono px-2 py-0.5 border rounded-md uppercase ${assetRiskColor(report.severity)}`}>
                {report.severity}
              </span>
              {report.incidentRef && (
                <span className="text-xs font-mono px-2 py-0.5 border border-primary/40 text-primary bg-primary/10 rounded-md">
                  {report.incidentRef}
                </span>
              )}
              <span className="text-xs font-mono text-muted-foreground/50">
                {new Date(report.investigatedAt).toLocaleString()}
              </span>
            </div>
            <h1 className="text-xl font-medium text-foreground">{report.alertTitle}</h1>
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <span>ASSET: <span className="text-foreground">{report.assetName}</span></span>
              <span>SOURCE: <span className="text-foreground">{report.source}</span></span>
            </div>
          </div>

          {/* Priority badge */}
          <div className={`px-5 py-3 border rounded-xl text-center shrink-0 ${priority.cls}`}>
            <div className="text-xs font-mono tracking-widest">{priority.label}</div>
            <div className="text-lg font-mono font-bold mt-0.5">{report.rootCause.estimatedRemediationH}h</div>
            <div className="text-[10px] font-mono opacity-70 tracking-wider">TO REMEDIATE</div>
          </div>
        </div>
      </div>

      {/* MITRE + Threat flags row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* MITRE ATT&CK */}
        <Card className="border-border xl:col-span-2">
          <CardContent className="p-5">
            <SectionHeader icon={<Target className="w-3.5 h-3.5" />} title="MITRE ATT&CK Mapping" />
            <div className="space-y-3">
              {/* Tactic → Technique chain */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10">
                  <div className="text-[10px] font-mono text-purple-400/70 tracking-wider">{report.mitre.tacticId}</div>
                  <div className="text-xs font-mono text-purple-300 font-medium">{report.mitre.tactic}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <div className="px-3 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10">
                  <div className="text-[10px] font-mono text-orange-400/70 tracking-wider">{report.mitre.techniqueId}</div>
                  <div className="text-xs font-mono text-orange-300 font-medium">{report.mitre.technique}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <div className="px-3 py-1.5 rounded-lg border border-border bg-secondary/40 flex-1 min-w-0">
                  <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider">SUB-TECHNIQUE</div>
                  <div className="text-xs font-mono text-foreground truncate">{report.mitre.subTechnique}</div>
                </div>
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground/60">CONFIDENCE</span>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${report.mitre.confidence * 100}%`,
                      background: "linear-gradient(90deg, hsl(272,100%,54%), hsl(272,100%,70%))"
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-foreground w-10 text-right">
                  {(report.mitre.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Evidence */}
              <p className="text-xs text-muted-foreground font-mono leading-relaxed border-l-2 border-purple-500/30 pl-3 py-1">
                {report.mitre.evidenceNotes}
              </p>

              {/* Related tactics */}
              {report.mitre.relatedTactics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground/50 self-center tracking-wider">RELATED:</span>
                  {report.mitre.relatedTactics.map(t => (
                    <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground bg-secondary/30">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Threat risk flags */}
        <Card className="border-border">
          <CardContent className="p-5">
            <SectionHeader icon={<Zap className="w-3.5 h-3.5" />} title="Risk Flags" />
            <div className="space-y-3">
              {[
                { label: "Lateral Movement", val: report.attackPath.lateralMovement,  icon: <GitBranch className="w-4 h-4" /> },
                { label: "Data Exfil Risk",  val: report.attackPath.dataExfilRisk,    icon: <Eye className="w-4 h-4" /> },
                { label: "Persistence",      val: report.attackPath.persistenceRisk,  icon: <Layers className="w-4 h-4" /> },
              ].map(({ label, val, icon }) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                    val ? "border-destructive/40 bg-destructive/10" : "border-border bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={val ? "text-destructive" : "text-muted-foreground/40"}>{icon}</span>
                    <span className={`text-xs font-mono ${val ? "text-foreground" : "text-muted-foreground/50"}`}>{label}</span>
                  </div>
                  {val
                    ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/30" />
                  }
                </div>
              ))}

              <div className="border border-border rounded-lg px-3 py-2.5 bg-secondary/30">
                <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider mb-0.5">DWELL TIME</div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <span className="text-xs font-mono text-foreground uppercase">{report.attackPath.estimatedDwell}</span>
                </div>
              </div>

              <div className="border border-border rounded-lg px-3 py-2.5 bg-secondary/30">
                <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider mb-1">OBJECTIVE</div>
                <p className="text-xs font-mono text-muted-foreground leading-snug">{report.attackPath.attackerObjective}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kill Chain */}
      <Card className="border-border">
        <CardContent className="p-5">
          <SectionHeader icon={<Activity className="w-3.5 h-3.5" />} title="Kill Chain Reconstruction" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {KILL_CHAIN_ORDER.map((phaseName) => {
              const phase = report.attackPath.killChain.find(p =>
                p.phase.toLowerCase().includes(phaseName.toLowerCase().split(" ")[0])
              ) ?? { phase: phaseName, status: "not_applicable" as const, indicators: [], toolsUsed: [] };
              const colors = killChainStatusColor(phase.status);
              return (
                <div
                  key={phaseName}
                  className={`rounded-lg border p-3 ${colors.bg} ${colors.border} space-y-2`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                    <span className={`text-[10px] font-mono tracking-wider uppercase ${colors.text} leading-tight`}>
                      {phaseName}
                    </span>
                  </div>
                  <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${colors.border} ${colors.text} text-center tracking-wider`}>
                    {phase.status.replace("_", " ")}
                  </div>
                  {phase.indicators.length > 0 && (
                    <ul className="space-y-0.5">
                      {phase.indicators.slice(0, 2).map((ind, i) => (
                        <li key={i} className="text-[9px] font-mono text-muted-foreground/60 leading-snug truncate">
                          · {ind}
                        </li>
                      ))}
                    </ul>
                  )}
                  {phase.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {phase.toolsUsed.slice(0, 2).map(t => (
                        <span key={t} className={`text-[8px] font-mono px-1 py-0 rounded border ${colors.border} ${colors.text}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* TTP narrative */}
          <div className="mt-4 p-3 rounded-lg border border-border bg-secondary/20">
            <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider mb-1">TTP SUMMARY</div>
            <p className="text-xs font-mono text-muted-foreground leading-relaxed">{report.attackPath.ttpSummary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Root Cause + Affected Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Root Cause */}
        <Card className="border-border">
          <CardContent className="p-5">
            <SectionHeader icon={<Search className="w-3.5 h-3.5" />} title="Root Cause Analysis" />
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10">
                <div className="text-[10px] font-mono text-destructive/70 tracking-wider mb-1">ROOT CAUSE</div>
                <p className="text-xs font-mono text-foreground leading-relaxed">{report.rootCause.rootCause}</p>
              </div>

              <div>
                <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider mb-2">IMMEDIATE ACTIONS</div>
                <ul className="space-y-1.5">
                  {report.rootCause.immediateActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-mono text-muted-foreground">
                      <span className="text-destructive shrink-0 mt-0.5">→</span>
                      <span className="leading-snug">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-lg border border-border bg-secondary/20">
                <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider mb-1">THREAT ACTOR PROFILE</div>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">{report.rootCause.threatActorProfile}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blast Radius */}
        <Card className="border-border">
          <CardContent className="p-5">
            <SectionHeader icon={<Shield className="w-3.5 h-3.5" />} title="Blast Radius" />
            <div className="space-y-2 mb-4">
              {report.rootCause.affectedAssets.map((asset, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${assetRiskColor(asset.riskLevel)}`}
                >
                  <span className="shrink-0">{assetIcon(asset.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-medium truncate">{asset.name}</div>
                    <div className="text-[10px] font-mono opacity-70 leading-snug">{asset.exposureType}</div>
                  </div>
                  <span className="text-[9px] font-mono uppercase shrink-0 opacity-70">{asset.riskLevel}</span>
                </div>
              ))}
            </div>

            {report.rootCause.iocList.length > 0 && (
              <div>
                <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider mb-2">
                  INDICATORS OF COMPROMISE ({report.rootCause.iocList.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {report.rootCause.iocList.map((ioc, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      <span className="text-[10px] font-mono text-muted-foreground break-all">{ioc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prevention Recommendations */}
      {report.rootCause.preventionRecommendations.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-5">
            <SectionHeader icon={<CheckCircle2 className="w-3.5 h-3.5" />} title="Prevention Recommendations" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.rootCause.preventionRecommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-mono text-muted-foreground p-3 rounded-lg border border-border bg-secondary/20">
                  <span className="text-primary shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
