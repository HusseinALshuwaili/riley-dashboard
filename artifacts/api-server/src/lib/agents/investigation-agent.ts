/**
 * Investigation Agent
 *
 * Deep-dives a single alert through a 3-stage adversarial pipeline:
 *   1. MITRE ATT&CK Mapper   — tactic → technique → sub-technique chain
 *   2. Attack Path Tracer    — kill-chain reconstruction (7-phase model)
 *   3. Root Cause Analyzer   — blast radius, affected assets, priority
 *
 * Designed to be called on-demand from the /investigate/:alertId endpoint.
 * Returns a rich investigation report as a single JSON object.
 */

import { db, alertsTable, incidentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { callGroq } from "./runtime";

// ---------------------------------------------------------------------------
// Output types (exported for route + frontend)
// ---------------------------------------------------------------------------

export interface MitreMapping {
  tactic:          string;   // e.g. "Initial Access"
  technique:       string;   // e.g. "T1566 — Phishing"
  subTechnique:    string;   // e.g. "T1566.001 — Spearphishing Attachment"
  tacticId:        string;   // e.g. "TA0001"
  techniqueId:     string;   // e.g. "T1566"
  confidence:      number;   // 0-1
  evidenceNotes:   string;
  relatedTactics:  string[]; // other ATT&CK tactics that may be active
}

export interface KillChainPhase {
  phase:       string;   // e.g. "Reconnaissance" | "Weaponization" | ...
  status:      "confirmed" | "likely" | "possible" | "not_applicable";
  indicators:  string[];
  toolsUsed:   string[];
  timestamp?:  string;   // inferred timeline marker
}

export interface AttackPath {
  killChain:         KillChainPhase[];
  attackerObjective: string;
  lateralMovement:   boolean;
  dataExfilRisk:     boolean;
  persistenceRisk:   boolean;
  estimatedDwell:    string;  // e.g. "hours" | "days" | "weeks"
  ttpSummary:        string;  // narrative of tactics/techniques/procedures
}

export interface BlastRadiusAsset {
  name:         string;
  type:         string;   // e.g. "endpoint" | "server" | "identity" | "network"
  riskLevel:    "critical" | "high" | "medium" | "low";
  exposureType: string;   // e.g. "direct compromise" | "lateral movement risk"
}

export interface RootCauseAnalysis {
  rootCause:             string;
  immediateActions:      string[];
  affectedAssets:        BlastRadiusAsset[];
  remediationPriority:   "p0" | "p1" | "p2" | "p3";
  estimatedRemediationH: number;  // hours
  preventionRecommendations: string[];
  threatActorProfile:    string;
  iocList:               string[];  // indicators of compromise
}

export interface InvestigationReport {
  alertId:      number;
  alertTitle:   string;
  severity:     string;
  assetName:    string;
  source:       string;
  mitre:        MitreMapping;
  attackPath:   AttackPath;
  rootCause:    RootCauseAnalysis;
  incidentRef:  string | null;  // linked INC-XXXX if already triaged
  investigatedAt: string;
}

// ---------------------------------------------------------------------------
// Stage 1 — MITRE ATT&CK Mapper
// ---------------------------------------------------------------------------

async function runMitreMapper(alert: {
  title: string;
  description: string;
  severity: string;
  source: string;
  mitreTactic: string | null;
}): Promise<MitreMapping> {
  const raw = await callGroq(
    `You are a MITRE ATT&CK expert. Given a security alert, map it precisely to the ATT&CK framework.
Return ONLY valid JSON matching this exact shape:
{
  "tactic": string,
  "technique": string,
  "subTechnique": string,
  "tacticId": string,
  "techniqueId": string,
  "confidence": number (0-1),
  "evidenceNotes": string,
  "relatedTactics": string[]
}
Use real MITRE ATT&CK IDs (e.g. TA0001, T1566, T1566.001). Be precise.`,
    `Alert: ${alert.title}
Description: ${alert.description}
Severity: ${alert.severity}
Detection Source: ${alert.source}
Reported MITRE tactic: ${alert.mitreTactic ?? "unknown"}`,
    { temperature: 0.1, maxTokens: 800 }
  );
  return JSON.parse(raw) as MitreMapping;
}

// ---------------------------------------------------------------------------
// Stage 2 — Attack Path Tracer (Cyber Kill Chain model)
// ---------------------------------------------------------------------------

async function runAttackPathTracer(
  alert: { title: string; description: string; assetName: string },
  mitre: MitreMapping
): Promise<AttackPath> {
  const raw = await callGroq(
    `You are a threat intelligence analyst specializing in attack path reconstruction.
Map the attack across the Lockheed Martin Cyber Kill Chain (7 phases):
  Reconnaissance → Weaponization → Delivery → Exploitation → Installation → C2 → Actions on Objectives

For each phase, assess: confirmed / likely / possible / not_applicable.
Return ONLY valid JSON:
{
  "killChain": [
    { "phase": string, "status": "confirmed"|"likely"|"possible"|"not_applicable", "indicators": string[], "toolsUsed": string[], "timestamp": string|null }
  ],
  "attackerObjective": string,
  "lateralMovement": boolean,
  "dataExfilRisk": boolean,
  "persistenceRisk": boolean,
  "estimatedDwell": "hours"|"days"|"weeks"|"unknown",
  "ttpSummary": string
}`,
    `Alert: ${alert.title}
Description: ${alert.description}
Affected Asset: ${alert.assetName}
MITRE Tactic: ${mitre.tactic} (${mitre.tacticId})
MITRE Technique: ${mitre.technique} (${mitre.techniqueId})
Sub-technique: ${mitre.subTechnique}
Related tactics: ${mitre.relatedTactics.join(", ")}
Evidence: ${mitre.evidenceNotes}`,
    { temperature: 0.15, maxTokens: 1200 }
  );
  return JSON.parse(raw) as AttackPath;
}

// ---------------------------------------------------------------------------
// Stage 3 — Root Cause + Blast Radius Analyzer
// ---------------------------------------------------------------------------

async function runRootCauseAnalyzer(
  alert: { title: string; description: string; severity: string; assetName: string; source: string },
  mitre: MitreMapping,
  attackPath: AttackPath
): Promise<RootCauseAnalysis> {
  const raw = await callGroq(
    `You are a senior SOC analyst performing root cause analysis and impact assessment.
Identify the root cause, blast radius, and remediation priorities.

Return ONLY valid JSON:
{
  "rootCause": string,
  "immediateActions": string[],
  "affectedAssets": [
    { "name": string, "type": "endpoint"|"server"|"identity"|"network"|"cloud"|"data", "riskLevel": "critical"|"high"|"medium"|"low", "exposureType": string }
  ],
  "remediationPriority": "p0"|"p1"|"p2"|"p3",
  "estimatedRemediationH": number,
  "preventionRecommendations": string[],
  "threatActorProfile": string,
  "iocList": string[]
}
P0 = active breach requiring immediate isolation. P1 = confirmed threat < 1 hour to remediate. P2 = high risk, remediate within 24h. P3 = medium/low risk, schedule fix.`,
    `Alert: ${alert.title}
Description: ${alert.description}
Severity: ${alert.severity}
Asset: ${alert.assetName}
Source: ${alert.source}
MITRE: ${mitre.tactic} / ${mitre.technique}
Attacker objective: ${attackPath.attackerObjective}
Lateral movement: ${attackPath.lateralMovement}
Data exfil risk: ${attackPath.dataExfilRisk}
Persistence risk: ${attackPath.persistenceRisk}
Dwell time estimate: ${attackPath.estimatedDwell}
Kill chain summary: ${attackPath.ttpSummary}`,
    { temperature: 0.2, maxTokens: 1400 }
  );
  return JSON.parse(raw) as RootCauseAnalysis;
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

export async function runInvestigationAgent(alertId: number): Promise<InvestigationReport> {
  // Fetch alert from DB
  const alertRows = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.id, alertId))
    .limit(1);

  const alert = alertRows[0];
  if (!alert) throw new Error(`Alert ${alertId} not found`);

  // Check if there's an existing incident linked to this alert
  const incidentRows = await db
    .select({ incidentRef: incidentsTable.incidentRef })
    .from(incidentsTable)
    .where(eq(incidentsTable.alertId, alertId))
    .orderBy(desc(incidentsTable.createdAt))
    .limit(1);
  const incidentRef = incidentRows[0]?.incidentRef ?? null;

  // Stage 1 — MITRE mapping
  const mitre = await runMitreMapper({
    title:       alert.title,
    description: alert.description,
    severity:    alert.severity,
    source:      alert.source,
    mitreTactic: alert.mitreTactic,
  });

  // Stage 2 — Kill chain reconstruction
  const attackPath = await runAttackPathTracer(
    { title: alert.title, description: alert.description, assetName: alert.assetName },
    mitre
  );

  // Stage 3 — Root cause + blast radius
  const rootCause = await runRootCauseAnalyzer(
    {
      title:       alert.title,
      description: alert.description,
      severity:    alert.severity,
      assetName:   alert.assetName,
      source:      alert.source,
    },
    mitre,
    attackPath
  );

  return {
    alertId:        alert.id,
    alertTitle:     alert.title,
    severity:       alert.severity,
    assetName:      alert.assetName,
    source:         alert.source,
    mitre,
    attackPath,
    rootCause,
    incidentRef,
    investigatedAt: new Date().toISOString(),
  };
}
