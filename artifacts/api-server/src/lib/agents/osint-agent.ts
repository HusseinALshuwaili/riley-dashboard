/**
 * OSINT Agent — Riley SOC Platform
 *
 * Inspired by OpenOSINT (github.com/OpenOSINT/OpenOSINT) — 18-tool
 * AI-powered OSINT framework. Adapts core tools for Riley's SOC context
 * using Groq LLaMA for synthesis.
 *
 * Tools (graceful degradation — all external keys optional):
 *   Always:   IP geolocation (ipinfo.io), DNS (built-in), WHOIS (RDAP), GitHub public API
 *   Optional: VirusTotal, Shodan, AbuseIPDB, HaveIBeenPwned
 *
 * Env vars (all optional):
 *   IPINFO_TOKEN, VIRUSTOTAL_API_KEY, SHODAN_API_KEY,
 *   ABUSEIPDB_API_KEY, HIBP_API_KEY, GITHUB_TOKEN
 */

import dns from "dns/promises";
import { callGroq } from "./runtime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OsintTargetType =
  | "ip" | "domain" | "email" | "username" | "hash" | "phone" | "unknown";

export type ThreatLevel = "none" | "low" | "medium" | "high" | "critical";

export interface OsintToolResult {
  tool:    string;
  label:   string;
  status:  "ok" | "error" | "skipped" | "no_key";
  data?:   Record<string, unknown>;
  error?:  string;
  source?: string;
}

export interface OsintReport {
  target:          string;
  targetType:      OsintTargetType;
  tools:           OsintToolResult[];
  synthesis:       string;
  threatLevel:     ThreatLevel;
  iocs:            string[];
  recommendations: string[];
  investigatedAt:  string;
}

// ---------------------------------------------------------------------------
// Target-type detection
// ---------------------------------------------------------------------------

export function detectTargetType(target: string): OsintTargetType {
  const t = target.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(t))                               return "ip";
  if (/^[0-9a-fA-F:]+:[0-9a-fA-F:]+$/.test(t))                         return "ip";   // IPv6
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))                             return "email";
  if (/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(t)) return "hash";
  if (/^\+?[\d\s\-().]{7,20}$/.test(t) && t.replace(/\D/g, "").length >= 7) return "phone";
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(t)) return "domain";
  if (/^[a-zA-Z0-9_.\-]{2,39}$/.test(t))                                return "username";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Individual tools
// ---------------------------------------------------------------------------

async function toolIpInfo(ip: string): Promise<OsintToolResult> {
  try {
    const token = process.env.IPINFO_TOKEN;
    const url   = token
      ? `https://ipinfo.io/${ip}?token=${token}`
      : `https://ipinfo.io/${ip}/json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json() as Record<string, unknown>;
    return {
      tool:   "ipinfo",
      label:  "IP Geolocation",
      status: "ok",
      source: "ipinfo.io",
      data: {
        ip:       d.ip,
        hostname: d.hostname ?? null,
        org:      d.org ?? null,
        city:     d.city ?? null,
        region:   d.region ?? null,
        country:  d.country ?? null,
        loc:      d.loc ?? null,
        timezone: d.timezone ?? null,
        bogon:    (d.bogon as boolean) ?? false,
      },
    };
  } catch (e) {
    return { tool: "ipinfo", label: "IP Geolocation", status: "error", error: String(e) };
  }
}

async function toolAbuseIpdb(ip: string): Promise<OsintToolResult> {
  const key = process.env.ABUSEIPDB_API_KEY;
  if (!key) return { tool: "abuseipdb", label: "Abuse Reputation", status: "no_key", source: "abuseipdb.com" };
  try {
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      { headers: { Key: key, Accept: "application/json" }, signal: AbortSignal.timeout(9000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = (await res.json() as { data: Record<string, unknown> }).data;
    return {
      tool:   "abuseipdb",
      label:  "Abuse Reputation",
      status: "ok",
      source: "abuseipdb.com",
      data: {
        abuseConfidenceScore: d.abuseConfidenceScore,
        totalReports:         d.totalReports,
        countryCode:          d.countryCode,
        isp:                  d.isp,
        usageType:            d.usageType,
        isPublic:             d.isPublic,
        isWhitelisted:        d.isWhitelisted,
        lastReportedAt:       d.lastReportedAt ?? null,
      },
    };
  } catch (e) {
    return { tool: "abuseipdb", label: "Abuse Reputation", status: "error", error: String(e) };
  }
}

async function toolShodan(ip: string): Promise<OsintToolResult> {
  const key = process.env.SHODAN_API_KEY;
  if (!key) return { tool: "shodan", label: "Open Ports / CVEs", status: "no_key", source: "shodan.io" };
  try {
    const res = await fetch(
      `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${key}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json() as Record<string, unknown>;
    return {
      tool:   "shodan",
      label:  "Open Ports / CVEs",
      status: "ok",
      source: "shodan.io",
      data: {
        org:        d.org ?? null,
        isp:        d.isp ?? null,
        country:    d.country_name ?? null,
        city:       d.city ?? null,
        os:         d.os ?? null,
        ports:      Array.isArray(d.ports)     ? (d.ports as number[]).slice(0, 20)   : [],
        vulns:      d.vulns ? Object.keys(d.vulns as object).slice(0, 10) : [],
        hostnames:  Array.isArray(d.hostnames) ? (d.hostnames as string[]).slice(0, 5) : [],
        tags:       Array.isArray(d.tags)      ? d.tags as string[]                    : [],
        lastUpdate: d.last_update ?? null,
      },
    };
  } catch (e) {
    return { tool: "shodan", label: "Open Ports / CVEs", status: "error", error: String(e) };
  }
}

async function toolVirusTotal(
  target: string,
  kind:   "ip" | "domain" | "hash",
): Promise<OsintToolResult> {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) return { tool: "virustotal", label: "VirusTotal Scan", status: "no_key", source: "virustotal.com" };
  try {
    const endpoint =
      kind === "ip"     ? `ip_addresses/${encodeURIComponent(target)}` :
      kind === "domain" ? `domains/${encodeURIComponent(target)}`      :
                          `files/${encodeURIComponent(target)}`;
    const res = await fetch(`https://www.virustotal.com/api/v3/${endpoint}`, {
      headers: { "x-apikey": key },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { data: { attributes: Record<string, unknown> } };
    const a = json.data.attributes;
    const stats = a.last_analysis_stats as Record<string, number> | undefined;
    return {
      tool:   "virustotal",
      label:  "VirusTotal Scan",
      status: "ok",
      source: "virustotal.com",
      data: {
        malicious:  stats?.malicious  ?? 0,
        suspicious: stats?.suspicious ?? 0,
        harmless:   stats?.harmless   ?? 0,
        undetected: stats?.undetected ?? 0,
        reputation: a.reputation ?? null,
        country:    a.country    ?? null,
        asOwner:    a.as_owner   ?? null,
        tags:       Array.isArray(a.tags) ? a.tags : [],
      },
    };
  } catch (e) {
    return { tool: "virustotal", label: "VirusTotal Scan", status: "error", error: String(e) };
  }
}

async function toolDns(domain: string): Promise<OsintToolResult> {
  try {
    const [aRes, mxRes, nsRes, txtRes] = await Promise.allSettled([
      dns.resolve4(domain),
      dns.resolveMx(domain),
      dns.resolveNs(domain),
      dns.resolveTxt(domain),
    ]);
    const aRecords   = aRes.status   === "fulfilled" ? aRes.value   : [];
    const mxRecords  = mxRes.status  === "fulfilled" ? mxRes.value  : [];
    const nsRecords  = nsRes.status  === "fulfilled" ? nsRes.value  : [];
    const txtRecords = txtRes.status === "fulfilled" ? txtRes.value.flat() : [];
    const spf   = txtRecords.find(r => r.startsWith("v=spf1"))   ?? null;
    const dmarc = txtRecords.find(r => r.startsWith("v=DMARC1")) ?? null;
    return {
      tool:   "dns",
      label:  "DNS Records",
      status: "ok",
      source: "system resolver",
      data: {
        a:        aRecords.slice(0, 10),
        mx:       mxRecords.slice(0, 5).map(r => `${r.priority} ${r.exchange}`),
        ns:       nsRecords.slice(0, 5),
        spf,
        dmarc,
        txtCount: txtRecords.length,
      },
    };
  } catch (e) {
    return { tool: "dns", label: "DNS Records", status: "error", error: String(e) };
  }
}

async function toolWhois(domain: string): Promise<OsintToolResult> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json() as Record<string, unknown>;
    const events   = (d.events   as { eventAction: string; eventDate: string }[] | undefined) ?? [];
    const entities = (d.entities as { roles: string[]; vcardArray?: unknown[][] }[] | undefined) ?? [];
    const getDate  = (action: string) =>
      events.find(e => e.eventAction === action)?.eventDate ?? null;
    const registrar = entities.find(e => e.roles?.includes("registrar"));
    const regName = registrar?.vcardArray?.[1]?.[3] as string | undefined;
    return {
      tool:   "whois",
      label:  "WHOIS / RDAP",
      status: "ok",
      source: "rdap.org",
      data: {
        registered:  getDate("registration"),
        expires:     getDate("expiration"),
        lastChanged: getDate("last changed"),
        status:      Array.isArray(d.status) ? (d.status as string[]).slice(0, 5) : [],
        registrar:   regName ?? "Unknown",
        nameservers: (d.nameservers as { ldhName: string }[] | undefined)?.map(n => n.ldhName) ?? [],
      },
    };
  } catch (e) {
    return { tool: "whois", label: "WHOIS / RDAP", status: "error", error: String(e) };
  }
}

async function toolGitHub(username: string): Promise<OsintToolResult> {
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      { headers, signal: AbortSignal.timeout(9000) },
    );
    if (res.status === 404) {
      return { tool: "github", label: "GitHub Profile", status: "ok", source: "github.com",
               data: { found: false } };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json() as Record<string, unknown>;
    return {
      tool:   "github",
      label:  "GitHub Profile",
      status: "ok",
      source: "github.com",
      data: {
        found:       true,
        login:       d.login,
        name:        d.name       ?? null,
        company:     d.company    ?? null,
        blog:        d.blog       ?? null,
        location:    d.location   ?? null,
        email:       d.email      ?? null,
        bio:         d.bio        ?? null,
        publicRepos: d.public_repos,
        followers:   d.followers,
        following:   d.following,
        createdAt:   d.created_at,
        profileUrl:  d.html_url,
        type:        d.type,
        suspended:   d.suspended_at ?? null,
      },
    };
  } catch (e) {
    return { tool: "github", label: "GitHub Profile", status: "error", error: String(e) };
  }
}

async function toolHibp(email: string): Promise<OsintToolResult> {
  const key = process.env.HIBP_API_KEY;
  if (!key) return { tool: "hibp", label: "Breach Check (HIBP)", status: "no_key", source: "haveibeenpwned.com" };
  try {
    const res = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      { headers: { "hibp-api-key": key, "User-Agent": "Riley-SOC-Dashboard" },
        signal: AbortSignal.timeout(9000) },
    );
    if (res.status === 404) {
      return { tool: "hibp", label: "Breach Check (HIBP)", status: "ok", source: "haveibeenpwned.com",
               data: { count: 0, breaches: [] } };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json() as { Name: string; BreachDate: string; PwnCount: number; DataClasses: string[] }[];
    return {
      tool:   "hibp",
      label:  "Breach Check (HIBP)",
      status: "ok",
      source: "haveibeenpwned.com",
      data: {
        count:    raw.length,
        breaches: raw.slice(0, 10).map(b => ({
          name:      b.Name,
          date:      b.BreachDate,
          pwnCount:  b.PwnCount,
          dataTypes: b.DataClasses.slice(0, 5),
        })),
      },
    };
  } catch (e) {
    return { tool: "hibp", label: "Breach Check (HIBP)", status: "error", error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// Tool routing
// ---------------------------------------------------------------------------

async function runTools(target: string, type: OsintTargetType): Promise<OsintToolResult[]> {
  const tasks: Promise<OsintToolResult>[] = [];

  if (type === "ip") {
    tasks.push(toolIpInfo(target), toolAbuseIpdb(target), toolShodan(target), toolVirusTotal(target, "ip"));
  } else if (type === "domain") {
    tasks.push(toolDns(target), toolWhois(target), toolVirusTotal(target, "domain"));
  } else if (type === "email") {
    tasks.push(toolHibp(target));
    const domainPart = target.split("@")[1];
    if (domainPart) tasks.push(toolDns(domainPart), toolWhois(domainPart));
  } else if (type === "username") {
    tasks.push(toolGitHub(target));
  } else if (type === "hash") {
    tasks.push(toolVirusTotal(target, "hash"));
  } else {
    // unknown — try GitHub as a best-effort username guess
    tasks.push(toolGitHub(target));
  }

  return Promise.all(tasks);
}

// ---------------------------------------------------------------------------
// Groq synthesis
// ---------------------------------------------------------------------------

async function synthesize(
  target:     string,
  targetType: OsintTargetType,
  tools:      OsintToolResult[],
): Promise<{ synthesis: string; threatLevel: ThreatLevel; iocs: string[]; recommendations: string[] }> {
  const toolSummaries = tools
    .filter(t => t.status === "ok" && t.data)
    .map(t => `[${t.label}]\n${JSON.stringify(t.data, null, 2)}`)
    .join("\n\n");

  const noKey = tools.filter(t => t.status === "no_key").map(t => t.label);
  const skippedNote = noKey.length
    ? `\nNote: ${noKey.join(", ")} skipped — API keys not configured.`
    : "";

  const raw = await callGroq(
    `You are a senior SOC analyst performing OSINT threat assessment.
Analyze the tool results and return ONLY valid JSON:
{
  "synthesis": string (2-3 sentences describing key findings and threat context),
  "threatLevel": "none"|"low"|"medium"|"high"|"critical",
  "iocs": string[] (max 10 specific indicators of compromise found — e.g. "IP reported 143 times for abuse", "Domain expires in 7 days"),
  "recommendations": string[] (max 5 actionable SOC recommendations)
}`,
    `OSINT Target: ${target}
Target Type: ${targetType}
${skippedNote}

TOOL RESULTS:
${toolSummaries || "No tool results with data — all tools failed or had no keys."}`,
    { temperature: 0.1, maxTokens: 1000 },
  );

  return JSON.parse(raw) as {
    synthesis: string;
    threatLevel: ThreatLevel;
    iocs: string[];
    recommendations: string[];
  };
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

export async function runOsintAgent(target: string): Promise<OsintReport> {
  const trimmed    = target.trim();
  const targetType = detectTargetType(trimmed);
  const tools      = await runTools(trimmed, targetType);

  let synthesis:       string      = "Groq synthesis unavailable — check GROQ_API_KEY.";
  let threatLevel:     ThreatLevel = "none";
  let iocs:            string[]    = [];
  let recommendations: string[]    = [];

  try {
    const ai      = await synthesize(trimmed, targetType, tools);
    synthesis       = ai.synthesis;
    threatLevel     = ai.threatLevel;
    iocs            = ai.iocs;
    recommendations = ai.recommendations;
  } catch (e) {
    console.error("[osint-agent] synthesis failed:", e);
  }

  return {
    target: trimmed,
    targetType,
    tools,
    synthesis,
    threatLevel,
    iocs,
    recommendations,
    investigatedAt: new Date().toISOString(),
  };
}
