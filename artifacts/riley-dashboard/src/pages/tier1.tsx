/**
 * Tier 1 Autonomous SOC Agent — dashboard page
 * Shows live agent activity, incident reports, and run history.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import {
  Cpu, Play, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Clock, Shield, Activity
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentStatus {
  status: "idle" | "running";
  activeRunId: number | null;
  nextRunAt: string | null;
}

interface RunSummary {
  id: number;
  status: "running" | "completed" | "failed";
  alertsProcessed: number;
  truePositives: number;
  falsePositives: number;
  skipped: number;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface IncidentSummary {
  id: number;
  alertId: number;
  agentRunId: number;
  severity: string;
  title: string;
  threatSummary: string;
  affectedAsset: string;
  mitreTactic: string | null;
  confidence: number;
  incidentRef: string;
  createdAt: string;
}

interface IncidentDetail extends IncidentSummary {
  attackVector: string;
  potentialImpact: string;
  correlationNotes: string;
  analystRationale: string;
  remediationRunbook: string;
}

interface LogLine {
  ts: string;
  text: string;
  kind: "info" | "success" | "error" | "step";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function severityColor(s: string) {
  switch (s) {
    case "critical": return { border: "#ff2244", badge: "bg-red-600/20 text-red-400 border-red-600/40" };
    case "high":     return { border: "#ff6600", badge: "bg-orange-600/20 text-orange-400 border-orange-600/40" };
    case "medium":   return { border: "#ffcc00", badge: "bg-yellow-600/20 text-yellow-400 border-yellow-600/40" };
    default:         return { border: "#00ffb4", badge: "bg-emerald-600/20 text-emerald-400 border-emerald-600/40" };
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function nowStr() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

// ---------------------------------------------------------------------------
// Live log terminal
// ---------------------------------------------------------------------------

function LogTerminal({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      className="font-mono text-xs rounded-xl border border-border overflow-y-auto"
      style={{ background: "hsl(228 38% 5%)", height: 220, padding: "12px 16px" }}
    >
      {lines.length === 0 ? (
        <span className="text-muted-foreground">Waiting for agent activity…</span>
      ) : (
        lines.map((l, i) => (
          <div key={i} className="leading-5">
            <span className="text-muted-foreground mr-2">[{l.ts}]</span>
            <span className={
              l.kind === "success" ? "text-primary" :
              l.kind === "error"   ? "text-red-400" :
              l.kind === "step"    ? "text-yellow-300" :
              "text-foreground"
            }>
              {l.text}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incident card + detail modal
// ---------------------------------------------------------------------------

function IncidentCard({ incident }: { incident: IncidentSummary }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const colors = severityColor(incident.severity);

  const loadDetail = async () => {
    if (detail) return;
    try {
      const res = await customFetch(`${API_BASE}/tier1-agent/incidents/${incident.id}`);
      if (res.ok) setDetail(await res.json() as IncidentDetail);
    } catch { /* silently fail */ }
  };

  const handleToggle = () => {
    setOpen(v => !v);
    if (!open) void loadDetail();
  };

  return (
    <div
      className="rounded-xl border border-border overflow-hidden"
      style={{ borderLeftColor: colors.border, borderLeftWidth: 3, background: "hsl(228 38% 8%)" }}
    >
      <div className="p-4 flex items-start justify-between gap-3 cursor-pointer" onClick={handleToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-primary font-bold">{incident.incidentRef}</span>
            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border uppercase ${colors.badge}`}>
              {incident.severity}
            </span>
            {incident.mitreTactic && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border">
                {incident.mitreTactic}
              </span>
            )}
          </div>
          <p className="font-mono text-sm text-foreground font-semibold truncate">{incident.title}</p>
          <p className="font-mono text-xs text-muted-foreground mt-0.5 line-clamp-2">{incident.threatSummary}</p>
          <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-muted-foreground">
            <span>Asset: <span className="text-foreground">{incident.affectedAsset}</span></span>
            <span>Confidence: <span className="text-primary">{(incident.confidence * 100).toFixed(0)}%</span></span>
            <span>{timeAgo(incident.createdAt)}</span>
          </div>
        </div>
        <button className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {!detail ? (
            <p className="font-mono text-xs text-muted-foreground animate-pulse">Loading full report…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <p className="text-muted-foreground mb-1">Attack Vector</p>
                  <p className="text-foreground">{detail.attackVector}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Potential Impact</p>
                  <p className="text-foreground">{detail.potentialImpact}</p>
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Correlation Notes</p>
                <p className="font-mono text-xs text-foreground">{detail.correlationNotes}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Analyst Rationale</p>
                <p className="font-mono text-xs text-foreground">{detail.analystRationale}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Remediation Runbook</p>
                <div
                  className="font-mono text-xs text-foreground rounded-lg p-3 border border-border whitespace-pre-wrap"
                  style={{ background: "hsl(228 38% 5%)" }}
                >
                  {detail.remediationRunbook}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run history row
// ---------------------------------------------------------------------------

function RunRow({ run }: { run: RunSummary }) {
  const statusColor = run.status === "completed" ? "text-primary" : run.status === "failed" ? "text-red-400" : "text-yellow-400";
  const StatusIcon = run.status === "completed" ? CheckCircle2 : run.status === "failed" ? XCircle : Activity;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 font-mono text-xs hover:bg-secondary/10 transition-colors">
      <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${statusColor}`} />
      <span className="text-muted-foreground w-24 shrink-0">{new Date(run.startedAt).toLocaleTimeString()}</span>
      <span className="text-foreground w-8 text-center">{run.alertsProcessed}</span>
      <span className="text-primary w-6 text-center">{run.truePositives}</span>
      <span className="text-red-400 w-6 text-center">{run.falsePositives}</span>
      <span className="text-muted-foreground w-16 text-right">{fmtDuration(run.durationMs)}</span>
      <span className={`ml-auto ${statusColor} capitalize`}>{run.status}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Tier1Page() {
  const [status, setStatus]       = useState<AgentStatus | null>(null);
  const [runs, setRuns]           = useState<RunSummary[]>([]);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [logLines, setLogLines]   = useState<LogLine[]>([]);
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState<string>("—");
  const sseRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendLog = useCallback((text: string, kind: LogLine["kind"] = "info") => {
    setLogLines(prev => [...prev.slice(-200), { ts: nowStr(), text, kind }]);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, runsRes, incidentsRes] = await Promise.all([
        customFetch(`${API_BASE}/tier1-agent/status`),
        customFetch(`${API_BASE}/tier1-agent/runs`),
        customFetch(`${API_BASE}/tier1-agent/incidents`),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json() as AgentStatus);
      if (runsRes.ok)   setRuns(((await runsRes.json()) as { runs: RunSummary[] }).runs);
      if (incidentsRes.ok) setIncidents(((await incidentsRes.json()) as { incidents: IncidentSummary[] }).incidents);
    } catch { /* silently fail */ }
  }, []);

  // Poll status every 5s
  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => { void fetchAll(); }, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Countdown timer to next run
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!status?.nextRunAt) { setCountdown("—"); return; }
    const tick = () => {
      const diff = new Date(status.nextRunAt!).getTime() - Date.now();
      if (diff <= 0) { setCountdown("now"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}m ${s}s`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status?.nextRunAt]);

  // Open SSE for a run
  const connectSSE = useCallback((runId: number) => {
    if (sseRef.current) sseRef.current.close();
    setLogLines([]);
    appendLog(`→ Connected to run #${runId}`, "info");

    const es = new EventSource(`${API_BASE}/tier1-agent/runs/${runId}/stream`);
    sseRef.current = es;

    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as Record<string, unknown>;
        switch (event.type) {
          case "run_start":
            appendLog(`▶ Run #${event.runId as number} started — ${event.alertsTotal as number} pending alerts`, "info");
            break;
          case "alert_start":
            appendLog(`  [${event.alertIndex as number}] ${event.title as string} | ${event.severity as string} | ${event.assetName as string}`, "info");
            break;
          case "agent_step":
            appendLog(`    ▸ ${event.agent as string}: ${event.message as string}`, "step");
            break;
          case "alert_done":
            if (event.verdict === "true_positive") {
              appendLog(`  ✓ ${event.incidentRef as string} created (confidence ${((event.confidence as number) * 100).toFixed(0)}%)`, "success");
            } else {
              appendLog(`  ✗ false_positive — cleared (confidence ${((event.confidence as number) * 100).toFixed(0)}%)`, "info");
            }
            break;
          case "run_complete":
            appendLog(`✓ Run complete — ${event.truePositives as number} incidents, ${event.falsePositives as number} cleared, ${fmtDuration(event.durationMs as number)}`, "success");
            void fetchAll();
            es.close();
            break;
          case "run_error":
            appendLog(`✗ Error: ${event.message as string}`, "error");
            es.close();
            break;
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      appendLog("SSE connection lost", "error");
      es.close();
    };
  }, [appendLog, fetchAll]);

  const handleRunNow = async () => {
    if (loading || status?.status === "running") return;
    setLoading(true);
    try {
      const res = await customFetch(`${API_BASE}/tier1-agent/run`, { method: "POST" });
      if (res.ok) {
        const { runId } = await res.json() as { runId: number };
        connectSSE(runId);
        void fetchAll();
      } else {
        const err = await res.json() as { error: string };
        appendLog(`Error: ${err.error}`, "error");
      }
    } catch (e) {
      appendLog(`Error: ${String(e)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Auto-connect SSE if already running
  useEffect(() => {
    if (status?.status === "running" && status.activeRunId && !sseRef.current) {
      connectSSE(status.activeRunId);
    }
  }, [status, connectSSE]);

  const isRunning = status?.status === "running";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: "linear-gradient(135deg, hsl(172 100% 20%) 0%, hsl(172 100% 32%) 100%)", boxShadow: "0 0 16px hsl(172 100% 42% / 0.3)" }}>
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold tracking-wider text-foreground">TIER 1 AGENT</h1>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Autonomous SOC Analyst</p>
          </div>
        </div>
        <button
          onClick={() => { void handleRunNow(); }}
          disabled={loading || isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isRunning ? "hsl(228 38% 12%)" : "linear-gradient(135deg, hsl(172 100% 25%), hsl(172 100% 38%))",
            color: isRunning ? "hsl(172 100% 42%)" : "hsl(228 38% 7%)",
            boxShadow: isRunning ? "none" : "0 0 16px hsl(172 100% 42% / 0.25)",
          }}
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isRunning ? "RUNNING…" : "RUN NOW"}
        </button>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Agent Status",
            value: isRunning ? "ACTIVE" : "IDLE",
            icon: <Activity className="w-4 h-4" />,
            color: isRunning ? "text-yellow-400" : "text-primary",
          },
          {
            label: "Next Scan",
            value: isRunning ? "In progress" : countdown,
            icon: <Clock className="w-4 h-4" />,
            color: "text-foreground",
          },
          {
            label: "Total Incidents",
            value: incidents.length,
            icon: <AlertTriangle className="w-4 h-4" />,
            color: "text-orange-400",
          },
          {
            label: "Last Run Alerts",
            value: runs[0]?.alertsProcessed ?? "—",
            icon: <Shield className="w-4 h-4" />,
            color: "text-foreground",
          },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl border border-border p-4" style={{ background: "hsl(228 38% 8%)" }}>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              {icon}
              <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
            </div>
            <p className={`font-mono text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Live log */}
      <div className="rounded-xl border border-border overflow-hidden" style={{ background: "hsl(228 38% 8%)" }}>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-yellow-400 animate-pulse" : "bg-muted-foreground"}`} />
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Live Agent Log</span>
        </div>
        <div className="p-3">
          <LogTerminal lines={logLines} />
        </div>
      </div>

      {/* Incidents */}
      <div>
        <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          Confirmed Incidents ({incidents.length})
        </h2>
        {incidents.length === 0 ? (
          <div className="rounded-xl border border-border p-6 text-center" style={{ background: "hsl(228 38% 8%)" }}>
            <p className="font-mono text-sm text-muted-foreground">No incidents yet. Run the agent to start triaging pending alerts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.slice(0, 20).map(i => <IncidentCard key={i.id} incident={i} />)}
          </div>
        )}
      </div>

      {/* Run history */}
      <div>
        <h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Run History
        </h2>
        <div className="rounded-xl border border-border overflow-hidden" style={{ background: "hsl(228 38% 8%)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            <span className="w-4 shrink-0" />
            <span className="w-24 shrink-0">Time</span>
            <span className="w-8 text-center">Total</span>
            <span className="w-6 text-center text-primary">TP</span>
            <span className="w-6 text-center text-red-400">FP</span>
            <span className="w-16 text-right">Duration</span>
            <span className="ml-auto">Status</span>
          </div>
          {runs.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">No runs yet.</div>
          ) : (
            runs.slice(0, 20).map(r => <RunRow key={r.id} run={r} />)
          )}
        </div>
      </div>
    </div>
  );
}
