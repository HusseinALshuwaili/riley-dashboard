import { useState, useEffect, useRef, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import {
  ReconStartResponse,
  ReconScanSummary,
  ReconScanDetail,
  ListReconScansResponse,
} from "@workspace/api-zod";
import type { z } from "zod";
import {
  Radar,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Globe,
  Hash,
  Wifi,
  Link2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Minus,
} from "lucide-react";

type ScanSummary = z.infer<typeof ReconScanSummary>;
type ScanDetail = z.infer<typeof ReconScanDetail>;

// ---------------------------------------------------------------------------
// Types matching the SSE events from recon-agent.ts
// ---------------------------------------------------------------------------
type LogEvent =
  | { type: "osint_start"; tools: string[]; target: string; targetType: string }
  | { type: "osint_result"; tool: string; toolStatus: "ok" | "error" | "skipped" }
  | { type: "agent_step"; agent: "synthesizer" | "investigator" | "assessor"; message: string }
  | { type: "scan_complete"; riskScore: number; riskLevel: string; threatSummary: string; iocs: string[] }
  | { type: "scan_error"; error: string };

interface LogLine {
  id: number;
  timestamp: string;
  text: string;
  kind: "info" | "ok" | "error" | "agent" | "complete";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function riskColor(level: string | null): string {
  if (!level) return "text-muted-foreground";
  if (level === "critical") return "text-red-400";
  if (level === "high") return "text-orange-400";
  if (level === "medium") return "text-yellow-400";
  return "text-emerald-400";
}

function riskBg(level: string | null): string {
  if (!level) return "bg-muted/30 border-border";
  if (level === "critical") return "bg-red-500/10 border-red-500/30";
  if (level === "high") return "bg-orange-500/10 border-orange-500/30";
  if (level === "medium") return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-emerald-500/10 border-emerald-500/30";
}

function riskIcon(level: string | null) {
  if (level === "critical") return <ShieldX className="w-5 h-5 text-red-400" />;
  if (level === "high") return <ShieldAlert className="w-5 h-5 text-orange-400" />;
  if (level === "medium") return <Shield className="w-5 h-5 text-yellow-400" />;
  if (level === "low") return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
  return <Shield className="w-5 h-5 text-muted-foreground" />;
}

function targetIcon(type: string) {
  if (type === "ip") return <Wifi className="w-4 h-4" />;
  if (type === "domain") return <Globe className="w-4 h-4" />;
  if (type === "hash") return <Hash className="w-4 h-4" />;
  return <Link2 className="w-4 h-4" />;
}

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function detectType(target: string): string {
  const t = target.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(t)) return "ip";
  if (/^[0-9a-fA-F:]+$/.test(t) && t.includes(":")) return "ip";
  if (/^[0-9a-fA-F]{32}$/.test(t) || /^[0-9a-fA-F]{40}$/.test(t) || /^[0-9a-fA-F]{64}$/.test(t)) return "hash";
  if (/^https?:\/\//i.test(t)) return "url";
  return "domain";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RiskMeter({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 80 ? "#f87171" : pct >= 60 ? "#fb923c" : pct >= 35 ? "#facc15" : "#34d399";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}80` }}
        />
      </div>
      <span className="font-mono text-sm font-bold" style={{ color }}>
        {Math.round(pct)}/100
      </span>
    </div>
  );
}

function ToolBadge({ tool, status }: { tool: string; status: "ok" | "error" | "skipped" | "pending" }) {
  const icons = {
    ok: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
    error: <XCircle className="w-3 h-3 text-red-400" />,
    skipped: <Minus className="w-3 h-3 text-muted-foreground" />,
    pending: <Loader2 className="w-3 h-3 text-primary animate-spin" />,
  };
  const colors = {
    ok: "border-emerald-500/30 text-emerald-300",
    error: "border-red-500/30 text-red-300",
    skipped: "border-border text-muted-foreground",
    pending: "border-primary/30 text-primary",
  };
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono ${colors[status]}`}>
      {icons[status]}
      {tool}
    </div>
  );
}

function LogTerminal({ lines }: { lines: LogLine[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const color = (kind: LogLine["kind"]) => {
    if (kind === "ok") return "text-emerald-400";
    if (kind === "error") return "text-red-400";
    if (kind === "agent") return "text-primary";
    if (kind === "complete") return "text-yellow-300";
    return "text-muted-foreground";
  };

  return (
    <div
      className="rounded-xl border border-border bg-black/60 backdrop-blur-sm p-4 h-64 overflow-y-auto font-mono text-xs space-y-1"
      style={{ scrollbarWidth: "thin" }}
    >
      {lines.length === 0 && (
        <span className="text-muted-foreground/50">Waiting for target…</span>
      )}
      {lines.map((line) => (
        <div key={line.id} className="flex gap-2 leading-relaxed">
          <span className="text-muted-foreground/40 shrink-0">{line.timestamp}</span>
          <span className={color(line.kind)}>{line.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function ScanCard({
  scan,
  onSelect,
  isActive,
}: {
  scan: ScanSummary;
  onSelect: () => void;
  isActive: boolean;
}) {
  const type = scan.targetType as string;
  return (
    <button
      onClick={onSelect}
      className={[
        "w-full text-left rounded-xl border p-4 transition-all duration-200",
        isActive
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card/60 hover:border-border/80 hover:bg-card/80",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground">{targetIcon(type)}</span>
          <span className="font-mono text-sm text-foreground truncate">{scan.target}</span>
        </div>
        {scan.status === "running" ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        ) : (
          riskIcon(scan.riskLevel ?? null)
        )}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs font-mono text-muted-foreground uppercase">{type}</span>
        {scan.riskLevel && (
          <span className={`text-xs font-mono uppercase font-bold ${riskColor(scan.riskLevel)}`}>
            {scan.riskLevel}
          </span>
        )}
        {scan.riskScore !== null && scan.riskScore !== undefined && (
          <span className="text-xs font-mono text-muted-foreground">{Math.round(scan.riskScore)}/100</span>
        )}
        <span className="text-xs text-muted-foreground/50 ml-auto">
          {new Date(scan.createdAt).toLocaleTimeString()}
        </span>
      </div>
      {scan.threatSummary && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {scan.threatSummary}
        </p>
      )}
    </button>
  );
}

function DetailPanel({ scan }: { scan: ScanDetail }) {
  const [showOsint, setShowOsint] = useState(false);

  const iocs = (scan.iocs as string[] | null) ?? [];
  const mitre = (scan.mitreTechniques as string[] | null) ?? [];

  return (
    <div className="space-y-4">
      {/* Risk header */}
      <div className={`rounded-xl border p-5 ${riskBg(scan.riskLevel ?? null)}`}>
        <div className="flex items-center gap-3 mb-3">
          {riskIcon(scan.riskLevel ?? null)}
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-mono font-bold uppercase text-sm ${riskColor(scan.riskLevel ?? null)}`}>
                {scan.riskLevel ?? "—"}
              </span>
              <span className="text-muted-foreground text-xs font-mono">RISK</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{scan.target}</p>
          </div>
        </div>
        <RiskMeter score={scan.riskScore ?? null} />
      </div>

      {/* Threat Summary */}
      {scan.threatSummary && (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Threat Summary</h4>
          <p className="text-sm text-foreground/90 leading-relaxed">{scan.threatSummary}</p>
        </div>
      )}

      {/* MITRE ATT&CK */}
      {mitre.length > 0 && (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">MITRE ATT&CK</h4>
          <div className="flex flex-wrap gap-2">
            {mitre.map((t, i) => (
              <span key={i} className="px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* IOCs */}
      {iocs.length > 0 && (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Indicators of Compromise ({iocs.length})
          </h4>
          <div className="space-y-1">
            {iocs.map((ioc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono text-red-300">
                <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                {ioc}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {scan.recommendations && (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Recommendations</h4>
          <div className="text-sm text-foreground/80 leading-relaxed prose prose-invert prose-sm max-w-none">
            {scan.recommendations.split("\n").map((line, i) => (
              <p key={i} className="text-sm text-foreground/80 mb-1">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Analyst Rationale */}
      {scan.analystRationale && (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Analyst Rationale</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{scan.analystRationale}</p>
        </div>
      )}

      {/* Raw OSINT (collapsible) */}
      {scan.osintData && (
        <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
          <button
            onClick={() => setShowOsint((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="uppercase tracking-wider">Raw OSINT Data</span>
            {showOsint ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {showOsint && (
            <pre className="px-4 pb-4 text-xs text-muted-foreground overflow-auto max-h-64" style={{ scrollbarWidth: "thin" }}>
              {JSON.stringify(scan.osintData, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ReconPage() {
  const [target, setTarget] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [toolStatuses, setToolStatuses] = useState<Record<string, "ok" | "error" | "skipped" | "pending">>({});
  const [expectedTools, setExpectedTools] = useState<string[]>([]);
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ScanDetail | null>(null);
  const lineCounter = useRef(0);

  const addLog = useCallback((text: string, kind: LogLine["kind"] = "info") => {
    setLogLines((prev) => [
      ...prev,
      { id: lineCounter.current++, timestamp: now(), text, kind },
    ]);
  }, []);

  // Load recent scans on mount
  useEffect(() => {
    customFetch<z.infer<typeof ListReconScansResponse>>("/recon/scans")
      .then((data) => setScans(data.scans))
      .catch(() => {});
  }, []);

  // Load detail when a scan is selected
  useEffect(() => {
    if (!selectedId) return;
    customFetch<ScanDetail>(`/recon/scans/${selectedId}`)
      .then((data) => setSelectedDetail(data))
      .catch(() => {});
  }, [selectedId]);

  const handleScan = async () => {
    const trimmed = target.trim();
    if (!trimmed || isScanning) return;

    setIsScanning(true);
    setLogLines([]);
    setToolStatuses({});
    setExpectedTools([]);
    setSelectedDetail(null);

    try {
      // Start scan
      const start = await customFetch<z.infer<typeof ReconStartResponse>>("/recon/scan", {
        method: "POST",
        body: JSON.stringify({ target: trimmed }),
        headers: { "Content-Type": "application/json" },
      });

      addLog(`► Recon started for ${start.target} (${start.targetType.toUpperCase()}) — scan #${start.scanId}`, "info");
      setSelectedId(start.scanId);

      // Open SSE stream
      const es = new EventSource(
        `${(window as { __RILEY_BASE_URL__?: string }).__RILEY_BASE_URL__ ?? ""}/recon/scans/${start.scanId}/stream`
      );

      es.onmessage = (e) => {
        const event = JSON.parse(e.data) as LogEvent;

        if (event.type === "osint_start") {
          setExpectedTools(event.tools);
          setToolStatuses(Object.fromEntries(event.tools.map((t) => [t, "pending"])));
          addLog(`▸ Querying ${event.tools.length} OSINT sources in parallel…`, "info");
        } else if (event.type === "osint_result") {
          setToolStatuses((prev) => ({ ...prev, [event.tool]: event.toolStatus }));
          const icon = event.toolStatus === "ok" ? "✓" : event.toolStatus === "error" ? "✗" : "—";
          addLog(`  ${icon} ${event.tool}: ${event.toolStatus}`, event.toolStatus === "ok" ? "ok" : event.toolStatus === "error" ? "error" : "info");
        } else if (event.type === "agent_step") {
          const label = event.agent === "synthesizer" ? "SYNTH" : event.agent === "investigator" ? "INVEST" : "ASSESS";
          addLog(`▸ [${label}] ${event.message}`, "agent");
        } else if (event.type === "scan_complete") {
          addLog(`✓ Scan complete — Risk: ${(event.riskLevel ?? "").toUpperCase()} (${event.riskScore}/100)`, "complete");
          if (event.iocs?.length) {
            addLog(`  ${event.iocs.length} IOC(s) identified`, "error");
          }
          es.close();
          setIsScanning(false);
          // Refresh scan list + detail
          customFetch<z.infer<typeof ListReconScansResponse>>("/recon/scans")
            .then((data) => setScans(data.scans))
            .catch(() => {});
          customFetch<ScanDetail>(`/recon/scans/${start.scanId}`)
            .then((data) => setSelectedDetail(data))
            .catch(() => {});
        } else if (event.type === "scan_error") {
          addLog(`✗ Error: ${event.error}`, "error");
          es.close();
          setIsScanning(false);
          customFetch<z.infer<typeof ListReconScansResponse>>("/recon/scans")
            .then((data) => setScans(data.scans))
            .catch(() => {});
        }
      };

      es.onerror = () => {
        addLog("✗ SSE connection lost", "error");
        es.close();
        setIsScanning(false);
      };
    } catch (err) {
      addLog(`✗ Failed to start scan: ${err}`, "error");
      setIsScanning(false);
    }
  };

  const detectedType = target.trim() ? detectType(target) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{
            background: "linear-gradient(135deg, hsl(172 100% 20%) 0%, hsl(172 100% 32%) 100%)",
            boxShadow: "0 0 16px hsl(172 100% 42% / 0.25)",
          }}
        >
          <Radar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-mono font-bold text-foreground">Recon Agent</h2>
          <p className="text-xs font-mono text-muted-foreground">
            Real OSINT intelligence — VirusTotal · AbuseIPDB · Shodan · OTX · GreyNoise · ipinfo.io
          </p>
        </div>
      </div>

      {/* Target Input */}
      <div
        className="rounded-xl border border-border p-5 backdrop-blur-sm"
        style={{ background: "hsl(228 38% 7% / 0.7)" }}
      >
        <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
          Target — IP Address, Domain, File Hash, or URL
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="e.g. 8.8.8.8 · evil.example.com · d41d8cd98f00b204e9800998ecf8427e"
              className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 pr-32 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {detectedType && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                {targetIcon(detectedType)}
                <span className="uppercase">{detectedType}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleScan}
            disabled={!target.trim() || isScanning}
            className="flex items-center gap-2 px-5 py-3 rounded-lg font-mono text-sm font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, hsl(172 100% 32%) 0%, hsl(172 100% 22%) 100%)",
              boxShadow: "0 0 12px hsl(172 100% 42% / 0.2)",
              color: "hsl(172 100% 92%)",
            }}
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Scan
              </>
            )}
          </button>
        </div>

        {/* OSINT tool status badges */}
        {expectedTools.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            {expectedTools.map((tool) => (
              <ToolBadge key={tool} tool={tool} status={toolStatuses[tool] ?? "pending"} />
            ))}
          </div>
        )}
      </div>

      {/* Main content: Log + Detail / History */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column: Terminal + History */}
        <div className="space-y-4">
          {/* Live terminal */}
          <div
            className="rounded-xl border border-border p-4 backdrop-blur-sm"
            style={{ background: "hsl(228 38% 7% / 0.7)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-xs font-mono text-muted-foreground/60 ml-1">riley-recon — live</span>
              {isScanning && (
                <span className="ml-auto flex items-center gap-1.5 text-xs font-mono text-primary">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                  </span>
                  LIVE
                </span>
              )}
            </div>
            <LogTerminal lines={logLines} />
          </div>

          {/* Scan history */}
          <div
            className="rounded-xl border border-border backdrop-blur-sm overflow-hidden"
            style={{ background: "hsl(228 38% 7% / 0.7)" }}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Recent Scans
              </span>
              <span className="text-xs font-mono text-muted-foreground/50">{scans.length} total</span>
            </div>
            <div className="p-3 space-y-2 max-h-96 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {scans.length === 0 && (
                <div className="py-8 text-center text-xs font-mono text-muted-foreground/40">
                  No scans yet. Enter a target above.
                </div>
              )}
              {scans.map((scan) => (
                <ScanCard
                  key={scan.id}
                  scan={scan}
                  isActive={selectedId === scan.id}
                  onSelect={() => {
                    setSelectedId(scan.id);
                    customFetch<ScanDetail>(`/recon/scans/${scan.id}`)
                      .then((data) => setSelectedDetail(data))
                      .catch(() => {});
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Detail panel */}
        <div
          className="rounded-xl border border-border backdrop-blur-sm overflow-hidden"
          style={{ background: "hsl(228 38% 7% / 0.7)" }}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Intelligence Report
            </span>
            {selectedDetail && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Clock className="w-3 h-3" />
                {selectedDetail.durationMs ? `${(selectedDetail.durationMs / 1000).toFixed(1)}s` : "—"}
              </div>
            )}
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(100vh-20rem)]" style={{ scrollbarWidth: "thin" }}>
            {!selectedDetail && !isScanning && (
              <div className="py-16 text-center space-y-3">
                <Radar className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                <p className="text-xs font-mono text-muted-foreground/40">
                  Enter a target and run a scan to see intelligence here.
                </p>
                <div className="text-xs font-mono text-muted-foreground/30 space-y-1 mt-4">
                  <p>Supports: IPv4/IPv6 · Domain · MD5/SHA1/SHA256 · URL</p>
                </div>
              </div>
            )}

            {!selectedDetail && isScanning && (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-xs font-mono text-primary/60">Gathering intelligence…</p>
              </div>
            )}

            {selectedDetail && selectedDetail.status === "running" && (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-xs font-mono text-primary/60">Analysis in progress…</p>
              </div>
            )}

            {selectedDetail && selectedDetail.status === "failed" && (
              <div className="py-12 text-center space-y-3">
                <XCircle className="w-8 h-8 text-red-400 mx-auto" />
                <p className="text-sm font-mono text-red-400">Scan failed</p>
                <p className="text-xs text-muted-foreground">{selectedDetail.errorMessage}</p>
              </div>
            )}

            {selectedDetail && selectedDetail.status === "completed" && (
              <DetailPanel scan={selectedDetail} />
            )}
          </div>
        </div>
      </div>

      {/* Info footer */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-border/50 bg-card/30 text-xs font-mono text-muted-foreground/60">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Configure OSINT API keys in Render environment: <code className="text-primary/70">VIRUSTOTAL_API_KEY</code>,{" "}
          <code className="text-primary/70">ABUSEIPDB_API_KEY</code>,{" "}
          <code className="text-primary/70">SHODAN_API_KEY</code>,{" "}
          <code className="text-primary/70">OTX_API_KEY</code>,{" "}
          <code className="text-primary/70">GREYNOISE_API_KEY</code>.
          Tools without keys are auto-skipped.
        </span>
      </div>
    </div>
  );
}
