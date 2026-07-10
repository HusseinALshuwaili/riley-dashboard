/**
 * Tier 1 Autonomous SOC Agent
 *
 * Sweeps all pending alerts through a 4-stage adversarial AI pipeline:
 *   1. Threat Analyzer  — characterize the attack
 *   2. Investigator     — correlate with alert queue context
 *   3. Verdict Agent    — true_positive or false_positive (adversarial gate)
 *   4. Remediation      — generate runbook (true positives only)
 *
 * Designed to run on a cron schedule (every N minutes) and also on demand
 * via POST /tier1-agent/run. Only one run may be active at a time.
 */

import EventEmitter from "events";
import { db, alertsTable, agentRunsTable, incidentsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { callGroq, GROQ_FAST_MODEL } from "./runtime";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let activeRunId: number | null = null;
let nextRunAt: Date | null = null;

export function getActiveRunId(): number | null { return activeRunId; }
export function getNextRunAt(): Date | null      { return nextRunAt; }
export function setNextRunAt(d: Date): void      { nextRunAt = d; }

// ---------------------------------------------------------------------------
// SSE emitter registry — maps runId → EventEmitter
// ---------------------------------------------------------------------------

const runEmitters = new Map<number, EventEmitter>();

export function getRunEmitter(runId: number): EventEmitter | undefined {
  return runEmitters.get(runId);
}

// ---------------------------------------------------------------------------
// Log event types
// ---------------------------------------------------------------------------

export type Tier1LogEvent =
  | { type: "run_start";    alertsTotal: number; runId: number }
  | { type: "alert_start";  alertIndex: number; alertId: number; title: string; severity: string; assetName: string }
  | { type: "agent_step";   agent: "analyzer" | "investigator" | "verdict" | "remediation"; message: string }
  | { type: "alert_done";   alertId: number; verdict: "true_positive" | "false_positive"; confidence: number; incidentRef?: string }
  | { type: "run_complete"; truePositives: number; falsePositives: number; durationMs: number }
  | { type: "run_error";    message: string };

// ---------------------------------------------------------------------------
// Agent 1 — Threat Analyzer
// ---------------------------------------------------------------------------

interface AnalyzerOutput {
  threatContext:    string;
  attackTechnique:  string;
  likelyObjective:  string;
  potentialImpact:  string;
  riskRating:       "low" | "medium" | "high" | "critical";
}

async function runAnalyzer(alert: {
  title: string; description: string; severity: string;
  source: string; confidence: number; assetName: string; mitreTactic: string | null;
}): Promise<AnalyzerOutput> {
  const raw = await callGroq(
    `You are a SOC Threat Analyzer. Given a security alert, identify the attack technique, attacker objective, and potential blast radius.
Return ONLY valid JSON: { "threatContext": string, "attackTechnique": string, "likelyObjective": string, "potentialImpact": string, "riskRating": "low"|"medium"|"high"|"critical" }`,
    `Alert Title: ${alert.title}
Description: ${alert.description}
Severity: ${alert.severity}
Source: ${alert.source}
Confidence: ${alert.confidence}
Asset: ${alert.assetName}
MITRE Tactic: ${alert.mitreTactic ?? "unknown"}`,
    { temperature: 0.2, model: GROQ_FAST_MODEL }
  );
  return JSON.parse(raw) as AnalyzerOutput;
}

// ---------------------------------------------------------------------------
// Agent 2 — Threat Investigator
// ---------------------------------------------------------------------------

interface InvestigatorOutput {
  correlationFindings:    string;
  supportingEvidence:     string[];
  contradictingEvidence:  string[];
  contextualRisk:         "isolated" | "corroborated" | "campaign";
}

async function runInvestigator(
  alert: { title: string; severity: string; assetName: string; mitreTactic: string | null },
  analyzerOutput: AnalyzerOutput,
  recentAlerts: { title: string; severity: string; assetName: string; mitreTactic: string | null; status: string }[]
): Promise<InvestigatorOutput> {
  const ctx = recentAlerts.map(a =>
    `- [${a.status}] ${a.title} | asset: ${a.assetName} | tactic: ${a.mitreTactic ?? "?"} | ${a.severity}`
  ).join("\n");

  const raw = await callGroq(
    `You are a SOC Threat Investigator. Correlate the current alert with recent alert queue context. Look for patterns, campaigns, or contradictions.
Return ONLY valid JSON: { "correlationFindings": string, "supportingEvidence": string[], "contradictingEvidence": string[], "contextualRisk": "isolated"|"corroborated"|"campaign" }`,
    `Current Alert: ${alert.title} | Asset: ${alert.assetName} | Tactic: ${alert.mitreTactic ?? "?"}
Analyzer: ${analyzerOutput.threatContext} | Technique: ${analyzerOutput.attackTechnique}

Recent alerts (last 24h):
${ctx || "No recent alerts from same asset/tactic."}`,
    { temperature: 0.2, model: GROQ_FAST_MODEL }
  );
  return JSON.parse(raw) as InvestigatorOutput;
}

// ---------------------------------------------------------------------------
// Agent 3 — Verdict Agent (adversarial gate)
// ---------------------------------------------------------------------------

interface VerdictOutput {
  verdict:       "true_positive" | "false_positive";
  confidence:    number;   // 0–1
  rationale:     string;
  incidentTitle?: string;
  threatSummary?: string;
  attackVector?:  string;
}

async function runVerdictAgent(
  alert: { title: string; description: string; severity: string; assetName: string },
  analyzerOutput: AnalyzerOutput,
  investigatorOutput: InvestigatorOutput
): Promise<VerdictOutput> {
  const raw = await callGroq(
    `You are an adversarial SOC Verdict Agent. Critically challenge ALL evidence. Your goal is to avoid false positives.
Return ONLY valid JSON: { "verdict": "true_positive"|"false_positive", "confidence": number (0-1), "rationale": string,
"incidentTitle": string (if true_positive), "threatSummary": string (if true_positive), "attackVector": string (if true_positive) }`,
    `Alert: ${alert.title}
Description: ${alert.description}
Severity: ${alert.severity} | Asset: ${alert.assetName}

Analyzer: ${analyzerOutput.threatContext}
Risk: ${analyzerOutput.riskRating} | Technique: ${analyzerOutput.attackTechnique} | Impact: ${analyzerOutput.potentialImpact}

Investigator correlation: ${investigatorOutput.correlationFindings}
Contextual risk: ${investigatorOutput.contextualRisk}
Supporting evidence: ${investigatorOutput.supportingEvidence.join("; ") || "none"}
Contradicting evidence: ${investigatorOutput.contradictingEvidence.join("; ") || "none"}

Challenge everything. Is this a REAL confirmed threat, or could it be a false positive / benign activity?`,
    { temperature: 0.15 }
  );
  return JSON.parse(raw) as VerdictOutput;
}

// ---------------------------------------------------------------------------
// Agent 4 — Remediation Planner (true positives only)
// ---------------------------------------------------------------------------

interface RemediationOutput {
  remediationRunbook: string;
}

async function runRemediationPlanner(
  alert: { title: string; assetName: string; severity: string },
  analyzerOutput: AnalyzerOutput,
  verdictOutput: VerdictOutput
): Promise<RemediationOutput> {
  const raw = await callGroq(
    `You are a SOC Remediation Planner. Generate a concrete, actionable incident response runbook in markdown format.
Include: immediate containment, investigation steps, remediation actions, escalation path, and a post-incident review checklist.
Return ONLY valid JSON: { "remediationRunbook": string (markdown) }`,
    `Incident: ${verdictOutput.incidentTitle ?? alert.title}
Asset: ${alert.assetName}
Severity: ${alert.severity}
Threat: ${analyzerOutput.threatContext}
Technique: ${analyzerOutput.attackTechnique}
Objective: ${analyzerOutput.likelyObjective}
Impact: ${analyzerOutput.potentialImpact}
Attack Vector: ${verdictOutput.attackVector ?? "unknown"}`,
    { temperature: 0.2, maxTokens: 1500 }
  );
  return JSON.parse(raw) as RemediationOutput;
}

// ---------------------------------------------------------------------------
// Per-alert processor
// ---------------------------------------------------------------------------

interface AlertRow {
  id: number;
  title: string;
  description: string;
  severity: string;
  source: string;
  confidence: number;
  assetName: string;
  mitreTactic: string | null;
}

async function processAlert(
  alert: AlertRow,
  alertIndex: number,
  runId: number,
  emit: (e: Tier1LogEvent) => void
): Promise<"true_positive" | "false_positive"> {
  emit({ type: "alert_start", alertIndex, alertId: alert.id, title: alert.title, severity: alert.severity, assetName: alert.assetName });

  // Fetch last 24h alerts from same asset or same tactic for Investigator context
  const oneDayAgo = new Date(Date.now() - 86_400_000);
  const recentRows = await db
    .select({ title: alertsTable.title, severity: alertsTable.severity, assetName: alertsTable.assetName, mitreTactic: alertsTable.mitreTactic, status: alertsTable.status })
    .from(alertsTable)
    .where(and(
      sql`${alertsTable.createdAt} > ${oneDayAgo}`,
      sql`${alertsTable.id} != ${alert.id}`
    ))
    .orderBy(desc(alertsTable.createdAt))
    .limit(20);

  // Agent 1
  emit({ type: "agent_step", agent: "analyzer", message: `Analyzing "${alert.title}"…` });
  const analyzerOutput = await runAnalyzer(alert);
  emit({ type: "agent_step", agent: "analyzer", message: `Risk: ${analyzerOutput.riskRating} | ${analyzerOutput.attackTechnique}` });

  // Agent 2
  emit({ type: "agent_step", agent: "investigator", message: "Correlating with alert queue…" });
  const investigatorOutput = await runInvestigator(alert, analyzerOutput, recentRows);
  emit({ type: "agent_step", agent: "investigator", message: `Context: ${investigatorOutput.contextualRisk} | ${investigatorOutput.correlationFindings.slice(0, 80)}…` });

  // Agent 3 — Verdict
  emit({ type: "agent_step", agent: "verdict", message: "Running adversarial verdict check…" });
  const verdictOutput = await runVerdictAgent(alert, analyzerOutput, investigatorOutput);
  emit({ type: "agent_step", agent: "verdict", message: `Verdict: ${verdictOutput.verdict} (confidence ${(verdictOutput.confidence * 100).toFixed(0)}%)` });

  // Update alert status in DB
  await db
    .update(alertsTable)
    .set({ status: verdictOutput.verdict })
    .where(eq(alertsTable.id, alert.id));

  if (verdictOutput.verdict === "false_positive") {
    emit({ type: "alert_done", alertId: alert.id, verdict: "false_positive", confidence: verdictOutput.confidence });
    return "false_positive";
  }

  // Agent 4 — Remediation
  emit({ type: "agent_step", agent: "remediation", message: "Generating remediation runbook…" });
  const remediationOutput = await runRemediationPlanner(alert, analyzerOutput, verdictOutput);

  // Compute next incident ref
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incidentsTable);
  const nextNum = (countResult[0]?.count ?? 0) + 1;
  const incidentRef = `INC-${String(nextNum).padStart(4, "0")}`;

  await db.insert(incidentsTable).values({
    alertId:            alert.id,
    agentRunId:         runId,
    severity:           alert.severity,
    title:              verdictOutput.incidentTitle ?? alert.title,
    threatSummary:      verdictOutput.threatSummary ?? analyzerOutput.threatContext,
    affectedAsset:      alert.assetName,
    mitreTactic:        alert.mitreTactic,
    attackVector:       verdictOutput.attackVector ?? analyzerOutput.attackTechnique,
    potentialImpact:    analyzerOutput.potentialImpact,
    correlationNotes:   investigatorOutput.correlationFindings,
    analystRationale:   verdictOutput.rationale,
    remediationRunbook: remediationOutput.remediationRunbook,
    confidence:         verdictOutput.confidence,
    incidentRef,
  });

  emit({ type: "alert_done", alertId: alert.id, verdict: "true_positive", confidence: verdictOutput.confidence, incidentRef });
  return "true_positive";
}

// ---------------------------------------------------------------------------
// Main sweep orchestrator
// ---------------------------------------------------------------------------

export async function runTier1AgentSweep(): Promise<number> {
  if (activeRunId !== null) {
    throw new Error("A Tier 1 agent run is already in progress");
  }

  // Create a DB run record and an SSE emitter
  const [runRow] = await db
    .insert(agentRunsTable)
    .values({ status: "running" })
    .returning();

  if (!runRow) throw new Error("Failed to create agent run record");
  const runId = runRow.id;
  activeRunId = runId;

  const emitter = new EventEmitter();
  runEmitters.set(runId, emitter);
  const emit = (e: Tier1LogEvent) => emitter.emit("log", e);

  // Run in background
  void (async () => {
    const startTime = Date.now();
    let truePositives = 0;
    let falsePositives = 0;
    let skipped = 0;

    try {
      // Fetch all pending alerts
      const pendingAlerts = await db
        .select({
          id:          alertsTable.id,
          title:       alertsTable.title,
          description: alertsTable.description,
          severity:    alertsTable.severity,
          source:      alertsTable.source,
          confidence:  alertsTable.confidence,
          assetName:   alertsTable.assetName,
          mitreTactic: alertsTable.mitreTactic,
        })
        .from(alertsTable)
        .where(eq(alertsTable.status, "pending"))
        .orderBy(desc(alertsTable.createdAt))
        .limit(50); // process max 50 per run to stay within Groq rate limits

      emit({ type: "run_start", alertsTotal: pendingAlerts.length, runId });

      if (pendingAlerts.length === 0) {
        emit({ type: "run_complete", truePositives: 0, falsePositives: 0, durationMs: Date.now() - startTime });
      } else {
        for (let i = 0; i < pendingAlerts.length; i++) {
          const alert = pendingAlerts[i];
          if (!alert) continue;
          try {
            const verdict = await processAlert(alert, i + 1, runId, emit);
            if (verdict === "true_positive") truePositives++;
            else falsePositives++;
          } catch (err) {
            console.error(`[tier1] Alert ${alert.id} failed:`, err);
            skipped++;
          }
        }

        const durationMs = Date.now() - startTime;
        emit({ type: "run_complete", truePositives, falsePositives, durationMs });

        await db
          .update(agentRunsTable)
          .set({
            status: "completed",
            alertsProcessed: pendingAlerts.length,
            truePositives,
            falsePositives,
            skipped,
            durationMs,
            completedAt: new Date(),
          })
          .where(eq(agentRunsTable.id, runId));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit({ type: "run_error", message: msg });
      await db
        .update(agentRunsTable)
        .set({ status: "failed", errorMessage: msg, completedAt: new Date() })
        .where(eq(agentRunsTable.id, runId));
    } finally {
      activeRunId = null;
      // Give SSE clients 2s to receive the final event before cleanup
      setTimeout(() => {
        emitter.removeAllListeners();
        runEmitters.delete(runId);
      }, 2000);
    }
  })();

  return runId;
}
