/**
 * RILEY Recon Agent
 * Runs parallel OSINT lookups against real external intelligence APIs,
 * then synthesizes findings through a 3-stage Groq LLaMA pipeline.
 *
 * OSINT Tools (all free-tier compatible):
 *   - VirusTotal v3      (VIRUSTOTAL_API_KEY)   — IP/domain/hash malware intel
 *   - AbuseIPDB v2       (ABUSEIPDB_API_KEY)    — IP abuse reputation
 *   - Shodan             (SHODAN_API_KEY)        — Internet exposure / open ports
 *   - AlienVault OTX     (OTX_API_KEY)           — Threat indicators / pulses
 *   - GreyNoise          (GREYNOISE_API_KEY)     — IP noise classification
 *   - ipinfo.io          (IPINFO_TOKEN opt.)     — Geolocation / ASN (no key needed for basic)
 */

import EventEmitter from "events";
import { spawn } from "child_process";
import { db, reconScansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callGroq, fetchWithTimeout, GROQ_FAST_MODEL } from "./agents/runtime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TargetType = "ip" | "domain" | "hash" | "url";

export interface OsintToolResult {
  tool: string;
  status: "ok" | "error" | "skipped";
  data?: unknown;
  error?: string;
}

export interface ReconLogEvent {
  type:
    | "osint_start"
    | "osint_result"
    | "agent_step"
    | "scan_complete"
    | "scan_error";
  // osint_start
  tools?: string[];
  target?: string;
  targetType?: string;
  // osint_result
  tool?: string;
  toolStatus?: "ok" | "error" | "skipped";
  // agent_step
  agent?: "synthesizer" | "investigator" | "assessor";
  message?: string;
  // scan_complete
  riskScore?: number;
  riskLevel?: string;
  threatSummary?: string;
  iocs?: string[];
  // scan_error
  error?: string;
}

export interface ReconResult {
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  threatSummary: string;
  iocs: string[];
  mitreTechniques: string[];
  recommendations: string;
  analystRationale: string;
}

// ---------------------------------------------------------------------------
// Target type detection
// ---------------------------------------------------------------------------

export function detectTargetType(target: string): TargetType {
  const trimmed = target.trim();

  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return "ip";

  // IPv6
  if (/^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(":")) return "ip";

  // MD5 (32 hex), SHA1 (40 hex), SHA256 (64 hex)
  if (/^[0-9a-fA-F]{32}$/.test(trimmed)) return "hash";
  if (/^[0-9a-fA-F]{40}$/.test(trimmed)) return "hash";
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return "hash";

  // URL
  if (/^https?:\/\//i.test(trimmed)) return "url";

  // Domain (fallback)
  return "domain";
}

// ---------------------------------------------------------------------------
// OSINT Fetchers
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 12000;

// --- VirusTotal v3 ---
async function queryVirusTotal(
  target: string,
  targetType: TargetType
): Promise<OsintToolResult> {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) return { tool: "VirusTotal", status: "skipped", error: "No API key" };

  let endpoint = "";
  if (targetType === "ip") endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(target)}`;
  else if (targetType === "domain") endpoint = `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(target)}`;
  else if (targetType === "hash") endpoint = `https://www.virustotal.com/api/v3/files/${encodeURIComponent(target)}`;
  else if (targetType === "url") {
    const id = Buffer.from(target).toString("base64url").replace(/=+$/, "");
    endpoint = `https://www.virustotal.com/api/v3/urls/${id}`;
  }

  try {
    const res = await fetchWithTimeout(endpoint, {
      headers: { "x-apikey": key },
    });
    if (!res.ok) {
      const body = await res.text();
      return { tool: "VirusTotal", status: "error", error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = await res.json() as { data: { attributes: unknown } };
    // Return compact subset
    const attrs = json.data?.attributes as Record<string, unknown> | undefined;
    return {
      tool: "VirusTotal",
      status: "ok",
      data: {
        maliciousCount: (attrs?.last_analysis_stats as Record<string, number>)?.malicious ?? 0,
        suspiciousCount: (attrs?.last_analysis_stats as Record<string, number>)?.suspicious ?? 0,
        harmlessCount: (attrs?.last_analysis_stats as Record<string, number>)?.harmless ?? 0,
        reputation: attrs?.reputation ?? null,
        country: attrs?.country ?? null,
        asOwner: attrs?.as_owner ?? null,
        networkInfo: attrs?.network ?? null,
        categories: attrs?.categories ?? null,
        tags: attrs?.tags ?? [],
        totalVotes: attrs?.total_votes ?? null,
        lastAnalysisDate: attrs?.last_analysis_date ?? null,
        names: attrs?.names ?? null,
        typeDescription: attrs?.type_description ?? null,
        size: attrs?.size ?? null,
      },
    };
  } catch (err) {
    return { tool: "VirusTotal", status: "error", error: String(err) };
  }
}

// --- AbuseIPDB v2 (IP only) ---
async function queryAbuseIPDB(ip: string): Promise<OsintToolResult> {
  const key = process.env.ABUSEIPDB_API_KEY;
  if (!key) return { tool: "AbuseIPDB", status: "skipped", error: "No API key" };

  try {
    const res = await fetchWithTimeout(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`,
      { headers: { Key: key, Accept: "application/json" } }
    );
    if (!res.ok) {
      return { tool: "AbuseIPDB", status: "error", error: `HTTP ${res.status}` };
    }
    const json = await res.json() as { data: unknown };
    const d = json.data as Record<string, unknown>;
    return {
      tool: "AbuseIPDB",
      status: "ok",
      data: {
        abuseConfidenceScore: d.abuseConfidenceScore,
        totalReports: d.totalReports,
        numDistinctUsers: d.numDistinctUsers,
        countryCode: d.countryCode,
        usageType: d.usageType,
        isp: d.isp,
        domain: d.domain,
        hostnames: d.hostnames,
        isTor: d.isTor,
        isWhitelisted: d.isWhitelisted,
        lastReportedAt: d.lastReportedAt,
      },
    };
  } catch (err) {
    return { tool: "AbuseIPDB", status: "error", error: String(err) };
  }
}

// --- Shodan (IP only) ---
async function queryShodan(ip: string): Promise<OsintToolResult> {
  const key = process.env.SHODAN_API_KEY;
  if (!key) return { tool: "Shodan", status: "skipped", error: "No API key" };

  try {
    const res = await fetchWithTimeout(
      `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${key}`,
    );
    if (!res.ok) {
      return { tool: "Shodan", status: "error", error: `HTTP ${res.status}` };
    }
    const json = await res.json() as Record<string, unknown>;
    return {
      tool: "Shodan",
      status: "ok",
      data: {
        org: json.org,
        asn: json.asn,
        country: json.country_name,
        city: json.city,
        isp: json.isp,
        os: json.os,
        ports: json.ports,
        tags: json.tags,
        vulns: json.vulns ? Object.keys(json.vulns as object) : [],
        lastUpdate: json.last_update,
        hostnames: json.hostnames,
        domains: json.domains,
        services: (json.data as Array<{ port: number; transport: string; product?: string; version?: string }> | undefined)?.map(s => ({
          port: s.port,
          transport: s.transport,
          product: s.product,
          version: s.version,
        })),
      },
    };
  } catch (err) {
    return { tool: "Shodan", status: "error", error: String(err) };
  }
}

// --- AlienVault OTX ---
async function queryOTX(
  target: string,
  targetType: TargetType
): Promise<OsintToolResult> {
  const key = process.env.OTX_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["X-OTX-API-KEY"] = key;

  let section = "";
  let otxType = "";
  if (targetType === "ip") { otxType = "IPv4"; section = "general"; }
  else if (targetType === "domain") { otxType = "domain"; section = "general"; }
  else if (targetType === "hash") { otxType = "file"; section = "general"; }
  else { return { tool: "AlienVault OTX", status: "skipped", error: "URL type not supported" }; }

  try {
    const res = await fetchWithTimeout(
      `https://otx.alienvault.com/api/v1/indicators/${otxType}/${encodeURIComponent(target)}/${section}`,
      { headers }
    );
    if (!res.ok) {
      return { tool: "AlienVault OTX", status: "error", error: `HTTP ${res.status}` };
    }
    const json = await res.json() as Record<string, unknown>;
    return {
      tool: "AlienVault OTX",
      status: "ok",
      data: {
        pulseCount: (json.pulse_info as Record<string, unknown>)?.count ?? 0,
        pulseNames: ((json.pulse_info as Record<string, unknown>)?.pulses as Array<{ name: string }>)?.slice(0, 5).map(p => p.name) ?? [],
        reputation: json.reputation,
        asn: json.asn,
        country: json.country_name,
        city: json.city,
        sections: json.sections,
        indicatorType: json.type,
        relatedIndicators: json.related,
        malwareFamilies: ((json.pulse_info as Record<string, unknown>)?.related as Record<string, unknown>)?.malware_families ?? [],
      },
    };
  } catch (err) {
    return { tool: "AlienVault OTX", status: "error", error: String(err) };
  }
}

// --- GreyNoise Community (IP only, no key needed for basic) ---
async function queryGreyNoise(ip: string): Promise<OsintToolResult> {
  const key = process.env.GREYNOISE_API_KEY;
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (key) headers["key"] = key;

  try {
    const res = await fetchWithTimeout(
      `https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`,
      { headers }
    );
    if (res.status === 404) {
      return { tool: "GreyNoise", status: "ok", data: { seen: false, classification: "unknown", noise: false, riot: false } };
    }
    if (!res.ok) {
      return { tool: "GreyNoise", status: "error", error: `HTTP ${res.status}` };
    }
    const json = await res.json() as Record<string, unknown>;
    return {
      tool: "GreyNoise",
      status: "ok",
      data: {
        seen: json.seen,
        classification: json.classification, // "malicious" | "benign" | "unknown"
        noise: json.noise,   // is internet background noise?
        riot: json.riot,     // is common business service (Google, Cloudflare)?
        name: json.name,
        link: json.link,
        lastSeen: json.last_seen,
        message: json.message,
      },
    };
  } catch (err) {
    return { tool: "GreyNoise", status: "error", error: String(err) };
  }
}

// --- ipinfo.io (IP/domain) ---
async function queryIpInfo(ip: string): Promise<OsintToolResult> {
  const token = process.env.IPINFO_TOKEN;
  const url = token
    ? `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${token}`
    : `https://ipinfo.io/${encodeURIComponent(ip)}/json`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { tool: "ipinfo.io", status: "error", error: `HTTP ${res.status}` };
    }
    const json = await res.json() as Record<string, unknown>;
    return {
      tool: "ipinfo.io",
      status: "ok",
      data: {
        ip: json.ip,
        hostname: json.hostname,
        city: json.city,
        region: json.region,
        country: json.country,
        loc: json.loc, // "lat,lng" string — used by threat map
        org: json.org,
        timezone: json.timezone,
        bogon: json.bogon ?? false,
      },
    };
  } catch (err) {
    return { tool: "ipinfo.io", status: "error", error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Python OSINT CLI integration (riley-recon)
// ---------------------------------------------------------------------------

interface PythonToolResult {
  tool: string;
  module: string;
  status: "ok" | "error" | "skipped";
  data?: Record<string, unknown>;
  error?: string;
}

interface PythonReconReport {
  tool_results: PythonToolResult[];
  duration_ms?: number;
  error?: string;
}

// Modules to pass to riley-recon per target type.
// "threat" module is intentionally excluded — handled by the TS Groq pipeline.
function pythonModulesForType(targetType: TargetType): string | null {
  switch (targetType) {
    case "ip":     return "dns,tech";
    case "domain": return "dns,domain,tech,breach";
    case "url":    return "dns,domain,tech";
    case "hash":   return null; // no useful Python modules for file hashes
    default:       return null;
  }
}

// Expected tool names per module set — used to populate osint_start before run.
function pythonToolNamesForModules(modules: string): string[] {
  const names: string[] = [];
  if (modules.includes("dns"))    names.push("DNS Records");
  if (modules.includes("domain")) names.push("crt.sh", "Wayback Machine");
  if (modules.includes("tech"))   names.push("HTTP Tech Fingerprint");
  if (modules.includes("breach")) names.push("HIBP");
  if (modules.includes("email"))  names.push("Email MX Check");
  if (modules.includes("social")) names.push("Username Presence");
  return names;
}

/**
 * Spawn the riley-recon CLI and return its tool results as OsintToolResult[].
 * Gracefully returns [] if the CLI is not installed or errors out.
 */
async function runPythonOsint(
  target: string,
  targetType: TargetType
): Promise<OsintToolResult[]> {
  const modules = pythonModulesForType(targetType);
  if (!modules) return [];

  const execPath = process.env.RILEY_RECON_PATH ?? "riley-recon";

  return new Promise<OsintToolResult[]>((resolve) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(
      execPath,
      ["scan", target, "--json", "--no-ai", "--modules", modules],
      { timeout: 60000 }
    );

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("error", (err) => {
      // CLI not installed or not in PATH — graceful fallback
      console.warn(`[recon] riley-recon unavailable: ${err.message}`);
      resolve([]);
    });

    proc.on("close", (code) => {
      if (code !== 0 || !stdout.trim()) {
        console.warn(`[recon] riley-recon exited ${code ?? "null"}. stderr: ${stderr.slice(0, 200)}`);
        resolve([]);
        return;
      }
      try {
        const report = JSON.parse(stdout) as PythonReconReport;
        const results: OsintToolResult[] = (report.tool_results ?? []).map((r) => ({
          tool: r.tool,
          status: r.status,
          data: r.data,
          error: r.error,
        }));
        resolve(results);
      } catch {
        console.warn("[recon] Failed to parse riley-recon JSON output");
        resolve([]);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// OSINT orchestrator — runs tools in parallel based on target type
// ---------------------------------------------------------------------------

export async function runOsintTools(
  target: string,
  targetType: TargetType,
  emit: (event: ReconLogEvent) => void
): Promise<OsintToolResult[]> {
  // TypeScript tool names per target type
  const tsToolNames: Record<TargetType, string[]> = {
    ip:     ["VirusTotal", "AbuseIPDB", "Shodan", "AlienVault OTX", "GreyNoise", "ipinfo.io"],
    domain: ["VirusTotal", "AlienVault OTX", "ipinfo.io"],
    hash:   ["VirusTotal", "AlienVault OTX"],
    url:    ["VirusTotal"],
  };

  // Python tool names expected for this target type
  const pyModules = pythonModulesForType(targetType);
  const pyToolNames = pyModules ? pythonToolNamesForModules(pyModules) : [];

  emit({
    type: "osint_start",
    tools: [...tsToolNames[targetType], ...pyToolNames],
    target,
    targetType,
  });

  // Build TS OSINT promises
  const tsPromises: Promise<OsintToolResult>[] = [];

  if (targetType === "ip") {
    tsPromises.push(
      queryVirusTotal(target, targetType),
      queryAbuseIPDB(target),
      queryShodan(target),
      queryOTX(target, targetType),
      queryGreyNoise(target),
      queryIpInfo(target)
    );
  } else if (targetType === "domain") {
    tsPromises.push(
      queryVirusTotal(target, targetType),
      queryOTX(target, targetType),
      queryIpInfo(target)
    );
  } else if (targetType === "hash") {
    tsPromises.push(
      queryVirusTotal(target, targetType),
      queryOTX(target, targetType)
    );
  } else {
    tsPromises.push(queryVirusTotal(target, targetType));
  }

  // Run TS tools and Python CLI in parallel
  const [tsSettled, pyResults] = await Promise.all([
    Promise.allSettled(tsPromises),
    runPythonOsint(target, targetType),
  ]);

  // Emit + collect TS results
  const allResults: OsintToolResult[] = tsSettled.map((r, i) => {
    const result: OsintToolResult =
      r.status === "fulfilled"
        ? r.value
        : { tool: tsToolNames[targetType][i] ?? "Unknown", status: "error", error: String(r.reason) };
    emit({ type: "osint_result", tool: result.tool, toolStatus: result.status });
    return result;
  });

  // Emit + collect Python results
  for (const pyResult of pyResults) {
    emit({ type: "osint_result", tool: pyResult.tool, toolStatus: pyResult.status });
    allResults.push(pyResult);
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Groq LLM calls
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Agent 1 — Threat Synthesizer
// ---------------------------------------------------------------------------

interface SynthesizerOutput {
  threatContext: string;
  keyFindings: string[];
  indicators: string[];
  attackTechniques: string[];
  initialRiskRating: "low" | "medium" | "high" | "critical";
}

async function runSynthesizer(
  target: string,
  targetType: string,
  osintResults: OsintToolResult[]
): Promise<SynthesizerOutput> {
  const osintSummary = JSON.stringify(
    osintResults.map(r => ({ tool: r.tool, status: r.status, data: r.data, error: r.error })),
    null,
    2
  ).slice(0, 6000);

  const system = `You are a threat intelligence synthesizer. Analyze raw OSINT data and extract key threat signals.
Return JSON matching: { "threatContext": string, "keyFindings": string[], "indicators": string[], "attackTechniques": string[], "initialRiskRating": "low"|"medium"|"high"|"critical" }`;

  const user = `Target: ${target} (Type: ${targetType})

OSINT Results:
${osintSummary}

Synthesize all data into threat intelligence. List concrete indicators of compromise, techniques, and findings.`;

  const raw = await callGroq(system, user, { model: GROQ_FAST_MODEL });
  return JSON.parse(raw) as SynthesizerOutput;
}

// ---------------------------------------------------------------------------
// Agent 2 — Context Investigator
// ---------------------------------------------------------------------------

interface InvestigatorOutput {
  mitreTechniques: string[];
  threatActorProfile: string;
  attackNarrative: string;
  confidenceFactors: string[];
  contradictions: string[];
}

async function runInvestigator(
  target: string,
  targetType: string,
  synthOutput: SynthesizerOutput
): Promise<InvestigatorOutput> {
  const system = `You are a SOC threat investigator specializing in MITRE ATT&CK mapping and threat actor profiling.
Return JSON matching: { "mitreTechniques": string[], "threatActorProfile": string, "attackNarrative": string, "confidenceFactors": string[], "contradictions": string[] }
MITRE technique IDs should be in format: "T1234 - Technique Name"`;

  const user = `Target: ${target} (${targetType})

Synthesizer findings:
- Threat context: ${synthOutput.threatContext}
- Key findings: ${synthOutput.keyFindings.join("; ")}
- Indicators: ${synthOutput.indicators.join(", ")}
- Attack techniques: ${synthOutput.attackTechniques.join(", ")}
- Risk rating: ${synthOutput.initialRiskRating}

Map to MITRE ATT&CK techniques. Build the attack narrative. Profile the threat actor if possible. Note any contradictions in evidence.`;

  const raw = await callGroq(system, user);
  return JSON.parse(raw) as InvestigatorOutput;
}

// ---------------------------------------------------------------------------
// Agent 3 — Risk Assessor
// ---------------------------------------------------------------------------

interface AssessorOutput {
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  threatSummary: string;
  iocs: string[];
  recommendations: string;
  analystRationale: string;
}

async function runAssessor(
  target: string,
  targetType: string,
  synthOutput: SynthesizerOutput,
  invOutput: InvestigatorOutput
): Promise<AssessorOutput> {
  const system = `You are a senior security analyst delivering final risk assessments and remediation guidance.
Return JSON matching: { "riskScore": number (0-100), "riskLevel": "low"|"medium"|"high"|"critical", "threatSummary": string (2-3 sentences), "iocs": string[], "recommendations": string (markdown list), "analystRationale": string }`;

  const user = `Target: ${target} (${targetType})

Synthesizer: ${synthOutput.threatContext} | Risk: ${synthOutput.initialRiskRating}
Investigator: MITRE: ${invOutput.mitreTechniques.join(", ")} | ${invOutput.attackNarrative}

Provide final risk score (0-100), level, a concise threat summary, IOC list, and actionable recommendations.
Recommendations should be concrete steps (block IP, rotate credentials, investigate host, etc.) formatted as a markdown checklist.`;

  const raw = await callGroq(system, user);
  return JSON.parse(raw) as AssessorOutput;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function runReconScan(
  scanId: number,
  target: string,
  targetType: TargetType,
  emitter: EventEmitter
): Promise<void> {
  const emit = (event: ReconLogEvent) => emitter.emit("log", event);
  const startTime = Date.now();

  try {
    // Step 1 — parallel OSINT
    const osintResults = await runOsintTools(target, targetType, emit);

    // Step 2 — Synthesizer
    emit({ type: "agent_step", agent: "synthesizer", message: "Analyzing OSINT signals and extracting threat indicators…" });
    const synthOutput = await runSynthesizer(target, targetType, osintResults);
    emit({ type: "agent_step", agent: "synthesizer", message: `Risk rating: ${synthOutput.initialRiskRating} | ${synthOutput.keyFindings.length} key findings` });

    // Step 3 — Investigator
    emit({ type: "agent_step", agent: "investigator", message: "Mapping to MITRE ATT&CK and building attack narrative…" });
    const invOutput = await runInvestigator(target, targetType, synthOutput);
    emit({ type: "agent_step", agent: "investigator", message: `MITRE: ${invOutput.mitreTechniques.slice(0, 3).join(", ")}` });

    // Step 4 — Risk Assessor
    emit({ type: "agent_step", agent: "assessor", message: "Calculating final risk score and generating recommendations…" });
    const assessorOutput = await runAssessor(target, targetType, synthOutput, invOutput);

    const durationMs = Date.now() - startTime;

    // Persist to DB
    await db
      .update(reconScansTable)
      .set({
        status: "completed",
        osintData: osintResults,
        threatSummary: assessorOutput.threatSummary,
        riskScore: assessorOutput.riskScore,
        riskLevel: assessorOutput.riskLevel,
        iocs: assessorOutput.iocs,
        mitreTechniques: invOutput.mitreTechniques,
        recommendations: assessorOutput.recommendations,
        analystRationale: assessorOutput.analystRationale,
        durationMs,
      })
      .where(eq(reconScansTable.id, scanId));

    emit({
      type: "scan_complete",
      riskScore: assessorOutput.riskScore,
      riskLevel: assessorOutput.riskLevel,
      threatSummary: assessorOutput.threatSummary,
      iocs: assessorOutput.iocs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(reconScansTable)
      .set({ status: "failed", errorMessage: msg, durationMs: Date.now() - startTime })
      .where(eq(reconScansTable.id, scanId));
    emit({ type: "scan_error", error: msg });
  }
}
