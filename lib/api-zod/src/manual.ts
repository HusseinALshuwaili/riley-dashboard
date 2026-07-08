/**
 * Manually maintained schemas (not orval-generated).
 * Add new endpoints here when not covered by the OpenAPI spec.
 */
import * as zod from "zod";

// ---- RILEY AI Chat ----

export const RileyChatHistoryItem = zod.object({
  role: zod.enum(["user", "assistant"]),
  content: zod.string(),
});

export const RileyChatBody = zod.object({
  message: zod.string().min(1),
  history: zod.array(RileyChatHistoryItem).optional().default([]),
  context: zod
    .object({
      page: zod.string(),
    })
    .optional(),
});

export const RileyChatActionItem = zod.object({
  tool: zod.string(),
  args: zod.record(zod.unknown()),
  result: zod.unknown(),
});

export const RileyChatResponse = zod.object({
  reply: zod.string(),
  toolCallsUsed: zod.array(zod.string()),
  actionsPerformed: zod.array(RileyChatActionItem),
  iterations: zod.number(),
});

// ---- Recon Agent ----

export const ReconTargetType = zod.enum(["ip", "domain", "hash", "url"]);

export const ReconOsintToolResult = zod.object({
  tool: zod.string(),
  status: zod.enum(["ok", "error", "skipped"]),
  data: zod.unknown().optional(),
  error: zod.string().optional(),
});

export const ReconStartBody = zod.object({
  target: zod.string().min(1),
});

export const ReconStartResponse = zod.object({
  scanId: zod.number(),
  target: zod.string(),
  targetType: ReconTargetType,
});

export const ReconScanSummary = zod.object({
  id: zod.number(),
  target: zod.string(),
  targetType: ReconTargetType,
  status: zod.enum(["running", "completed", "failed"]),
  riskScore: zod.number().nullable(),
  riskLevel: zod.string().nullable(),
  threatSummary: zod.string().nullable(),
  durationMs: zod.number().nullable(),
  createdAt: zod.string(),
});

export const ReconScanDetail = ReconScanSummary.extend({
  osintData: zod.unknown().nullable(),
  iocs: zod.array(zod.string()).nullable(),
  mitreTechniques: zod.array(zod.string()).nullable(),
  recommendations: zod.string().nullable(),
  analystRationale: zod.string().nullable(),
  errorMessage: zod.string().nullable(),
});

export const ListReconScansResponse = zod.object({
  scans: zod.array(ReconScanSummary),
});

// ---- Bulk Alert Update ----

export const BulkUpdateAlertsBody = zod.object({
  ids: zod.array(zod.number()).min(1),
  status: zod.enum(["pending", "true_positive", "false_positive", "resolved"]),
});

export const BulkUpdateAlertsResponse = zod.object({
  updatedCount: zod.number(),
  status: zod.enum(["pending", "true_positive", "false_positive", "resolved"]),
});

// ---- Tier 1 Autonomous SOC Agent ----

export const Tier1RunResponse = zod.object({
  runId: zod.number(),
});

export const Tier1AgentStatus = zod.object({
  status: zod.enum(["idle", "running"]),
  nextRunAt: zod.string().optional(),
  activeRunId: zod.number().nullable(),
});

export const Tier1RunSummary = zod.object({
  id: zod.number(),
  status: zod.enum(["running", "completed", "failed"]),
  alertsProcessed: zod.number(),
  truePositives: zod.number(),
  falsePositives: zod.number(),
  skipped: zod.number(),
  durationMs: zod.number().nullable(),
  errorMessage: zod.string().nullable(),
  startedAt: zod.string(),
  completedAt: zod.string().nullable(),
});

export const ListTier1RunsResponse = zod.object({
  runs: zod.array(Tier1RunSummary),
});

export const IncidentSummary = zod.object({
  id: zod.number(),
  alertId: zod.number(),
  agentRunId: zod.number(),
  severity: zod.string(),
  title: zod.string(),
  threatSummary: zod.string(),
  affectedAsset: zod.string(),
  mitreTactic: zod.string().nullable(),
  confidence: zod.number(),
  incidentRef: zod.string(),
  createdAt: zod.string(),
});

export const IncidentDetail = IncidentSummary.extend({
  attackVector: zod.string(),
  potentialImpact: zod.string(),
  correlationNotes: zod.string(),
  analystRationale: zod.string(),
  remediationRunbook: zod.string(),
});

export const ListIncidentsResponse = zod.object({
  incidents: zod.array(IncidentSummary),
});
