/**
 * OSINT Investigator Page
 * Powered by OpenOSINT-style tool chaining + Groq LLaMA synthesis.
 *
 * Tools: IP geolocation · AbuseIPDB · Shodan · VirusTotal · DNS ·
 *        WHOIS/RDAP · GitHub · HaveIBeenPwned
 */

import { useState, useRef } from "react";
import {
  Eye, Search, AlertTriangle, CheckCircle2, XCircle,
  KeyRound, Globe, Shield, Database, Server, Github,
  Mail, Hash, User, Phone, ChevronRight, Loader2,
  ExternalLink, Copy, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types (mirror backend) ───────────────────────────────────────────────────

type OsintTargetType =
  | "ip" | "domain" | "email" | "username" | "hash" | "phone" | "unknown";
type ThreatLevel = "none" | "low" | "medium" | "high" | "critical";
type ToolStatus  = "ok" | "error" | "skipped" | "no_key";

interface OsintToolResult {
  tool:    string;
  label:   string;
  status:  ToolStatus;
  data?:   Record<string, unknown>;
  error?:  string;
  source?: string;
}

interface OsintReport {
  target:          string;
  targetType:      OsintTargetType;
  tools:           OsintToolResult[];
  synthesis:       string;
  threatLevel:     ThreatLevel;
  iocs:            string[];
  recommendations: string[];
  investigatedAt:  string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

const THREAT_COLORS: Record<ThreatLevel, { bg: string; text: string; border: string; label: string }> = {
  none:     { bg: "rgba(34,197,94,0.08)",  text: "#22c55e",  border: "rgba(34,197,94,0.3)",  label: "NONE" },
  low:      { bg: "rgba(234,179,8,0.08)",  text: "#eab308",  border: "rgba(234,179,8,0.3)",  label: "LOW" },
  medium:   { bg: "rgba(249,115,22,0.08)", text: "#f97316",  border: "rgba(249,115,22,0.3)", label: "MEDIUM" },
  high:     { bg: "rgba(239,68,68,0.08)",  text: "#ef4444",  border: "rgba(239,68,68,0.3)",  label: "HIGH" },
  critical: { bg: "rgba(220,38,38,0.12)",  text: "#dc2626",  border: "rgba(220,38,38,0.5)",  label: "CRITICAL" },
};

const TYPE_META: Record<OsintTargetType, { icon: React.ElementType; label: string; color: string }> = {
  ip:       { icon: Globe,     label: "IP Address", color: "#3b82f6" },
  domain:   { icon: Server,    label: "Domain",     color: "#8b5cf6" },
  email:    { icon: Mail,      label: "Email",      color: "#06b6d4" },
  username: { icon: User,      label: "Username",   color: "#10b981" },
  hash:     { icon: Hash,      label: "Hash",       color: "#f59e0b" },
  phone:    { icon: Phone,     label: "Phone",      color: "#ec4899" },
  unknown:  { icon: Search,    label: "Unknown",    color: "#6b7280" },
};

const TOOL_ICONS: Record<string, React.ElementType> = {
  ipinfo:     Globe,
  abuseipdb:  AlertTriangle,
  shodan:     Server,
  virustotal: Shield,
  dns:        Database,
  whois:      Globe,
  github:     Github,
  hibp:       Mail,
};

// ── Target type detection (mirrors backend) ──────────────────────────────────

function detectType(t: string): OsintTargetType {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(t))                               return "ip";
  if (/^[0-9a-fA-F:]+:[0-9a-fA-F:]+$/.test(t))                         return "ip";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))                             return "email";
  if (/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(t)) return "hash";
  if (/^\+?[\d\s\-().]{7,20}$/.test(t) && t.replace(/\D/g, "").length >= 7) return "phone";
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(t)) return "domain";
  if (/^[a-zA-Z0-9_.\-]{2,39}$/.test(t))                                return "username";
  return "unknown";
}

// ── Tool result card ─────────────────────────────────────────────────────────

function ToolCard({ result }: { result: OsintToolResult }) {
  const [expanded, setExpanded] = useState(false);
  const Icon   = TOOL_ICONS[result.tool] ?? Shield;
  const status = result.status;

  const statusIcon =
    status === "ok"     ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /> :
    status === "error"  ? <XCircle      className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /> :
    status === "no_key" ? <KeyRound     className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} /> :
                          <Loader2      className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;

  const borderColor =
    status === "ok"     ? "rgba(34,197,94,0.2)"  :
    status === "error"  ? "rgba(239,68,68,0.2)"  :
    status === "no_key" ? "rgba(234,179,8,0.15)" :
                          "rgba(255,255,255,0.06)";

  // Render key data highlights
  const highlights: string[] = [];
  if (result.data) {
    const d = result.data;
    if (result.tool === "ipinfo") {
      if (d.org)     highlights.push(String(d.org));
      if (d.city)    highlights.push(`${d.city}, ${d.country}`);
      if (d.bogon)   highlights.push("⚠ BOGON address");
    } else if (result.tool === "abuseipdb") {
      if (typeof d.abuseConfidenceScore === "number")
        highlights.push(`Abuse score: ${d.abuseConfidenceScore}%`);
      if (d.totalReports)   highlights.push(`${d.totalReports} reports`);
      if (d.isp)             highlights.push(String(d.isp));
    } else if (result.tool === "shodan") {
      if (Array.isArray(d.ports) && d.ports.length)
        highlights.push(`Ports: ${(d.ports as number[]).slice(0, 6).join(", ")}`);
      if (Array.isArray(d.vulns) && d.vulns.length)
        highlights.push(`CVEs: ${(d.vulns as string[]).slice(0, 3).join(", ")}`);
    } else if (result.tool === "virustotal") {
      if (typeof d.malicious === "number" && d.malicious > 0)
        highlights.push(`🚨 ${d.malicious} engines flagged malicious`);
      else if (typeof d.harmless === "number")
        highlights.push(`✓ ${d.harmless} engines clean`);
    } else if (result.tool === "dns") {
      if (Array.isArray(d.a)) highlights.push(`A: ${(d.a as string[]).slice(0, 3).join(", ")}`);
      if (d.spf)  highlights.push("SPF configured");
      if (d.dmarc) highlights.push("DMARC configured");
    } else if (result.tool === "whois") {
      if (d.registrar)  highlights.push(`Registrar: ${d.registrar}`);
      if (d.registered) highlights.push(`Registered: ${String(d.registered).split("T")[0]}`);
      if (d.expires)    highlights.push(`Expires: ${String(d.expires).split("T")[0]}`);
    } else if (result.tool === "github") {
      if (d.found === false) {
        highlights.push("Not found on GitHub");
      } else {
        if (d.name)        highlights.push(String(d.name));
        if (d.publicRepos) highlights.push(`${d.publicRepos} repos`);
        if (d.followers)   highlights.push(`${d.followers} followers`);
        if (d.email)       highlights.push(String(d.email));
      }
    } else if (result.tool === "hibp") {
      if (typeof d.count === "number") {
        if (d.count === 0) highlights.push("✓ No breaches found");
        else highlights.push(`⚠ Found in ${d.count} breach${d.count > 1 ? "es" : ""}`);
      }
    }
  }

  return (
    <div
      className="rounded-lg border transition-all duration-200 cursor-pointer hover:border-opacity-60"
      style={{
        background:   "rgba(255,255,255,0.02)",
        borderColor,
        backdropFilter: "blur(4px)",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md shrink-0"
          style={{ background: "rgba(132,0,255,0.1)", border: "1px solid rgba(132,0,255,0.2)" }}
        >
          <Icon className="w-4 h-4" style={{ color: "hsl(272,100%,62%)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-foreground">{result.label}</span>
            {statusIcon}
          </div>
          {result.source && (
            <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
              {result.source}
            </span>
          )}
        </div>
        <ChevronRight
          className="w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0"
          style={{ transform: expanded ? "rotate(90deg)" : undefined }}
        />
      </div>

      {/* Highlights */}
      {highlights.length > 0 && !expanded && (
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          {highlights.map((h, i) => (
            <span
              key={i}
              className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{
                background: "rgba(255,255,255,0.04)",
                border:     "1px solid rgba(255,255,255,0.08)",
                color:      "hsl(272,60%,70%)",
              }}
            >
              {h}
            </span>
          ))}
        </div>
      )}

      {/* Status messages for no_key / error */}
      {status === "no_key" && !expanded && (
        <div className="px-3 pb-3 text-[10px] font-mono text-yellow-500/60">
          API key not configured — add to Render env vars
        </div>
      )}
      {status === "error" && !expanded && (
        <div className="px-3 pb-3 text-[10px] font-mono text-red-500/60 truncate">
          {result.error ?? "Request failed"}
        </div>
      )}

      {/* Expanded raw JSON */}
      {expanded && (
        <div
          className="px-3 pb-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
          onClick={e => e.stopPropagation()}
        >
          <pre
            className="text-[10px] font-mono text-muted-foreground mt-3 overflow-x-auto max-h-64"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
          >
            {result.data
              ? JSON.stringify(result.data, null, 2)
              : result.error ?? "No data"}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function OsintPage() {
  const [target,   setTarget]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [report,   setReport]   = useState<OsintReport | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [history,  setHistory]  = useState<OsintReport[]>([]);
  const [copied,   setCopied]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const detectedType = target.trim() ? detectType(target.trim()) : null;
  const TypeIcon     = detectedType ? TYPE_META[detectedType].icon : Eye;

  async function runScan() {
    if (!target.trim() || loading) return;
    setLoading(true);
    setReport(null);
    setError(null);
    try {
      const res = await fetch(`${API}/osint`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ target: target.trim() }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as OsintReport;
      setReport(data);
      setHistory(h => [data, ...h].slice(0, 10));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyReport() {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const threat = report ? THREAT_COLORS[report.threatLevel] : null;

  // Group tools: ok/error first, no_key last
  const sortedTools = report?.tools.slice().sort((a, b) => {
    const order: Record<ToolStatus, number> = { ok: 0, error: 1, skipped: 2, no_key: 3 };
    return order[a.status] - order[b.status];
  }) ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ background: "rgba(132,0,255,0.15)", border: "1px solid rgba(132,0,255,0.3)" }}
            >
              <Eye className="w-5 h-5" style={{ color: "hsl(272,100%,62%)" }} />
            </div>
            <h1 className="text-xl font-bold font-mono tracking-widest text-foreground uppercase">
              OSINT Investigator
            </h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground/60 ml-12">
            IP · Domain · Email · Username · Hash · Phone — powered by OpenOSINT + Groq LLaMA
          </p>
        </div>
        {report && (
          <button
            onClick={copyReport}
            className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "COPIED" : "EXPORT JSON"}
          </button>
        )}
      </div>

      {/* ── Target input ── */}
      <div
        className="rounded-xl border p-4"
        style={{
          background:   "rgba(255,255,255,0.02)",
          borderColor:  "rgba(132,0,255,0.2)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
            Target
          </span>
          {detectedType && (
            <span
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{
                background: `${TYPE_META[detectedType].color}18`,
                border:     `1px solid ${TYPE_META[detectedType].color}40`,
                color:      TYPE_META[detectedType].color,
              }}
            >
              <TypeIcon className="w-2.5 h-2.5" />
              {TYPE_META[detectedType].label}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <TypeIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: detectedType ? TYPE_META[detectedType].color : "rgba(255,255,255,0.2)" }}
            />
            <Input
              ref={inputRef}
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runScan()}
              placeholder="1.1.1.1  ·  example.com  ·  user@email.com  ·  johndoe99  ·  deadbeef…"
              className="pl-9 font-mono text-sm h-11 bg-transparent border-border/50 focus:border-purple-500/50"
            />
          </div>
          <Button
            onClick={runScan}
            disabled={!target.trim() || loading}
            className="h-11 px-6 font-mono text-xs tracking-widest"
            style={{
              background: "hsl(272,100%,50%)",
              border:     "none",
              opacity:    (!target.trim() || loading) ? 0.5 : 1,
            }}
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />SCANNING</>
            ) : (
              <><Search className="w-3.5 h-3.5 mr-2" />RUN OSINT</>
            )}
          </Button>
        </div>

        {/* Suggestions */}
        {!target && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {["8.8.8.8", "google.com", "user@example.com", "torvalds", "44d88612fea8a8f36de82e1278abb02f"].map(s => (
              <button
                key={s}
                onClick={() => { setTarget(s); inputRef.current?.focus(); }}
                className="text-[10px] font-mono px-2 py-0.5 rounded border text-muted-foreground/50 hover:text-foreground hover:border-purple-500/30 transition-colors"
                style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-lg border p-4 flex items-center gap-3"
          style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.3)" }}
        >
          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm font-mono text-red-400">{error}</span>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div
          className="rounded-xl border p-6 space-y-3"
          style={{ background: "rgba(255,255,255,0.01)", borderColor: "rgba(132,0,255,0.15)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "hsl(272,100%,62%)" }} />
            <span className="text-xs font-mono text-muted-foreground animate-pulse">
              Running OSINT tools in parallel…
            </span>
          </div>
          {["IP Geolocation", "Abuse Reputation", "Open Ports / CVEs", "VirusTotal Scan", "DNS Records"].map(t => (
            <div
              key={t}
              className="h-14 rounded-lg animate-pulse"
              style={{ background: "rgba(132,0,255,0.05)", border: "1px solid rgba(132,0,255,0.1)" }}
            />
          ))}
        </div>
      )}

      {/* ── Report ── */}
      {report && !loading && (
        <div className="space-y-5">
          {/* Target summary bar */}
          <div
            className="rounded-xl border p-4 flex flex-wrap items-center gap-4"
            style={{
              background:  `linear-gradient(135deg, rgba(132,0,255,0.06) 0%, rgba(0,0,0,0) 100%)`,
              borderColor: "rgba(132,0,255,0.25)",
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {(() => {
                const TIcon = TYPE_META[report.targetType].icon;
                return (
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: `${TYPE_META[report.targetType].color}20`,
                      border:     `1px solid ${TYPE_META[report.targetType].color}40`,
                    }}
                  >
                    <TIcon className="w-4 h-4" style={{ color: TYPE_META[report.targetType].color }} />
                  </div>
                );
              })()}
              <div className="min-w-0">
                <div className="text-sm font-mono font-bold text-foreground truncate">{report.target}</div>
                <div className="text-[10px] font-mono text-muted-foreground/50 uppercase">
                  {TYPE_META[report.targetType].label} · Scanned {new Date(report.investigatedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
            {/* Threat level */}
            {threat && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-lg border shrink-0"
                style={{ background: threat.bg, borderColor: threat.border }}
              >
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: threat.text }}
                />
                <span
                  className="text-xs font-mono font-bold tracking-widest"
                  style={{ color: threat.text }}
                >
                  THREAT: {threat.label}
                </span>
              </div>
            )}
            <button
              onClick={() => { setTarget(report.target); runScan(); }}
              className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              RESCAN
            </button>
          </div>

          {/* AI Synthesis */}
          <div
            className="rounded-xl border p-5"
            style={{
              background:  "rgba(132,0,255,0.04)",
              borderColor: "rgba(132,0,255,0.2)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5" style={{ color: "hsl(272,100%,62%)" }} />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                AI Synthesis · Groq LLaMA
              </span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{report.synthesis}</p>
          </div>

          {/* Two-column: IOCs + Recommendations */}
          {(report.iocs.length > 0 || report.recommendations.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* IOCs */}
              {report.iocs.length > 0 && (
                <div
                  className="rounded-xl border p-4"
                  style={{
                    background:  "rgba(239,68,68,0.03)",
                    borderColor: "rgba(239,68,68,0.15)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500/70" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-red-500/60">
                      Indicators of Compromise
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {report.iocs.map((ioc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-500/40 text-xs font-mono shrink-0 mt-0.5">→</span>
                        <span className="text-xs font-mono text-foreground/70">{ioc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div
                  className="rounded-xl border p-4"
                  style={{
                    background:  "rgba(34,197,94,0.03)",
                    borderColor: "rgba(34,197,94,0.15)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500/70" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-green-500/60">
                      SOC Recommendations
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {report.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-500/40 text-xs font-mono shrink-0 mt-0.5">{i + 1}.</span>
                        <span className="text-xs font-mono text-foreground/70">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Tool results grid */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40">
                Tool Results ({sortedTools.filter(t => t.status === "ok").length}/{sortedTools.length} OK)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedTools.map((t, i) => (
                <ToolCard key={`${t.tool}-${i}`} result={t} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── History sidebar strip ── */}
      {history.length > 1 && (
        <div
          className="rounded-xl border p-4"
          style={{
            background:  "rgba(255,255,255,0.01)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-3.5 h-3.5 text-muted-foreground/30" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40">
              Recent investigations
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => {
              const HIcon = TYPE_META[h.targetType].icon;
              const tc    = THREAT_COLORS[h.threatLevel];
              return (
                <button
                  key={i}
                  onClick={() => { setTarget(h.target); setReport(h); }}
                  className="flex items-center gap-2 text-[10px] font-mono px-3 py-1.5 rounded-lg border hover:border-purple-500/30 transition-colors"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                    background:  "rgba(255,255,255,0.02)",
                  }}
                >
                  <HIcon className="w-3 h-3" style={{ color: TYPE_META[h.targetType].color }} />
                  <span className="text-foreground/60">{h.target}</span>
                  <span
                    className="px-1 rounded text-[9px] font-bold"
                    style={{ background: tc.bg, color: tc.text }}
                  >
                    {tc.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!report && !loading && !error && (
        <div className="text-center py-16 space-y-3">
          <Eye className="w-10 h-10 mx-auto text-muted-foreground/20" />
          <p className="text-sm font-mono text-muted-foreground/30">
            Enter any target to begin OSINT investigation
          </p>
          <p className="text-xs font-mono text-muted-foreground/20">
            IP addresses · Domains · Emails · Usernames · File hashes
          </p>
        </div>
      )}
    </div>
  );
}
