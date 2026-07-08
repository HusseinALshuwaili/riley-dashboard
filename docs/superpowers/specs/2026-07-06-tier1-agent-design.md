# Tier 1 Autonomous Vulnerability Detection Agent — Design Spec
**Date:** 2026-07-06  
**Status:** Approved  
**Scope:** Autonomous SOC Tier 1 analyst — background agent that sweeps pending alerts, triages with a 4-agent adversarial pipeline, and generates incident reports with remediation runbooks.

---

## Overview

A proactive background agent that acts as a first-line SOC analyst. Unlike the RILEY chat agent (reactive, user-driven), this agent runs autonomously on a schedule and processes every unreviewed alert through a 4-stage adversarial AI pipeline. Confirmed threats become structured `Incident` records; cleared alerts are marked `false_positive`. A new `/tier1` dashboard page shows live agent activity, incident reports, and run history.

---

## Architecture

```
node-cron (every 5 min)  ──────┐
                               ▼
UI "Run Now" button ──→ POST /tier1-agent/run
                               │
                         picks up all pending alerts
                               │
                    ┌──────────▼──────────┐
                    │  4-Agent Pipeline   │  (per alert, sequential)
                    │  1. Threat Analyzer │
                    │  2. Investigator    │
                    │  3. Verdict Agent   │
                    │  4. Remediation*    │  (* only on true positives)
                    └──────────┬──────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
     update alertsTable   create incident   emit SSE events
     (status + verdict)   in incidentsTable  to frontend log
```

---

## Database — 2 New Tables

### `agentRunsTable`

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `status` | text | `running` / `completed` / `failed` |
| `alertsProcessed` | integer | Total alerts swept |
| `truePositives` | integer | Confirmed threats |
| `falsePositives` | integer | Cleared alerts |
| `skipped` | integer | Already triaged (status ≠ pending) |
| `durationMs` | integer | Total run time |
| `errorMessage` | text nullable | Set on failure |
| `startedAt` | timestamp | |
| `completedAt` | timestamp nullable | |

### `incidentsTable`

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `alertId` | integer FK | Reference to `alertsTable.id` |
| `agentRunId` | integer FK | Reference to `agentRunsTable.id` |
| `severity` | text | Inherited from alert |
| `title` | text | AI-generated incident title |
| `threatSummary` | text | 1-2 sentence summary |
| `affectedAsset` | text | Asset name from alert |
| `mitreTactic` | text nullable | MITRE ATT&CK tactic |
| `attackVector` | text | How the attack is occurring |
| `potentialImpact` | text | What could be damaged |
| `correlationNotes` | text | What the Investigator found |
| `analystRationale` | text | Verdict Agent's reasoning |
| `remediationRunbook` | text | Step-by-step containment instructions |
| `confidence` | real | Final verdict confidence (0–1) |
| `incidentRef` | text | Human-readable e.g. `INC-0001` |
| `createdAt` | timestamp | |

---

## 4-Agent Pipeline

Each pending alert is processed sequentially through 4 Groq LLaMA-3.3-70b calls.

### Agent 1 — Threat Analyzer
**Input:** Alert fields (title, description, severity, source, confidence, assetName, mitreTactic)  
**Task:** Analyze the threat. What is the attack technique? What's the attacker's likely objective? What is the blast radius if real?  
**Output JSON:** `{ threatContext, attackTechnique, likelyObjective, potentialImpact, riskRating: "low"|"medium"|"high"|"critical" }`

### Agent 2 — Threat Investigator
**Input:** Analyzer output + DB snapshot (last 24h alerts from same asset + same MITRE tactic)  
**Task:** Correlate. Does this alert fit a known pattern? Are there supporting or contradicting signals in the alert queue?  
**Output JSON:** `{ correlationFindings, supportingEvidence: string[], contradictingEvidence: string[], contextualRisk: "isolated"|"corroborated"|"campaign" }`

### Agent 3 — Verdict Agent
**Input:** Alert + Analyzer output + Investigator output  
**Task:** Adversarially challenge the evidence. Make the final determination.  
**Output JSON:** `{ verdict: "true_positive"|"false_positive", confidence: 0–1, rationale, incidentTitle?, threatSummary?, attackVector? }`  
**Decision gate:** If `verdict === "false_positive"` → update alert status, skip Agent 4. If `verdict === "true_positive"` → continue to Agent 4.

### Agent 4 — Remediation Planner (true positives only)
**Input:** All prior outputs  
**Task:** Generate an actionable remediation runbook.  
**Output JSON:** `{ remediationRunbook: string }` — markdown-formatted step-by-step containment and recovery instructions (isolate asset, rotate credentials, block IPs, escalation path, post-incident review checklist).

---

## API Routes

New file: `artifacts/api-server/src/routes/tier1-agent.ts`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tier1-agent/run` | Start an agent sweep. Returns `{ runId }` immediately. |
| `GET` | `/tier1-agent/runs` | List last 50 agent runs |
| `GET` | `/tier1-agent/runs/:id` | Full run detail + per-alert results |
| `GET` | `/tier1-agent/runs/:id/stream` | **SSE** — real-time log stream for active run |
| `GET` | `/tier1-agent/incidents` | List all incidents (newest first) |
| `GET` | `/tier1-agent/incidents/:id` | Full incident with remediation runbook |
| `GET` | `/tier1-agent/status` | Current agent status (running/idle, next scheduled run) |

---

## SSE Log Events

`GET /tier1-agent/runs/:id/stream` emits these event types:

```typescript
type LogEvent =
  | { type: "run_start"; alertsTotal: number; runId: number }
  | { type: "alert_start"; alertIndex: number; alertId: number; title: string; severity: string; assetName: string }
  | { type: "agent_step"; agent: "analyzer" | "investigator" | "verdict" | "remediation"; message: string }
  | { type: "alert_done"; alertId: number; verdict: "true_positive" | "false_positive"; confidence: number; incidentRef?: string }
  | { type: "run_complete"; truePositives: number; falsePositives: number; durationMs: number }
  | { type: "run_error"; message: string }
```

SSE connection closes automatically on `run_complete` or `run_error`.

---

## Scheduling

`node-cron` installed in `api-server`. Scheduler initialized at startup in `app.ts`:

```typescript
if (process.env.GROQ_API_KEY) {
  const interval = process.env.TIER1_AGENT_INTERVAL_MINUTES ?? "5";
  cron.schedule(`*/${interval} * * * *`, () => runTier1AgentSweep());
}
```

Guard: if a run is already in progress, the cron tick is skipped (prevents overlapping runs).

---

## New Files

```
artifacts/api-server/src/
  lib/tier1-agent.ts          ← 4-agent pipeline + orchestrator
  routes/tier1-agent.ts       ← API routes + SSE handler

lib/db/src/schema/
  incidents.ts                ← incidentsTable schema
  agentRuns.ts                ← agentRunsTable schema
  index.ts                    ← export both new tables

artifacts/riley-dashboard/src/
  pages/tier1.tsx             ← new /tier1 dashboard page
```

---

## Frontend — `/tier1` Page

Added as a new sidebar nav item: **Tier 1 Agent** (icon: `Cpu` or `Bot`), positioned between Patterns and Bug Scanner.

**Page layout (top to bottom):**

### 1. Agent Status Bar
- Status chip: `ACTIVE` (teal, pulsing) / `RUNNING` (yellow, spinning) / `IDLE` (gray)
- "Next scan in: 4m 32s" countdown
- "Run Now" button → triggers `POST /tier1-agent/run`, then opens live log stream

### 2. Live Log Stream
- Terminal-style scrolling log (monospace font, dark background, teal timestamps)
- Visible while a run is in progress; collapses to "Last run: 2 min ago" when idle
- Each log line: `[HH:MM:SS] → asset/alert info` or `  ▸ agent: message` or `  ✓ INC-XXXX created`

### 3. Incidents Panel
- Cards for each confirmed true positive (same severity-border system as Alert Queue)
- Card shows: `INC-XXXX` ref, severity badge, incident title, asset, MITRE tactic, threat summary
- "View Full Report" expands to show full incident with remediation runbook (in a side panel or modal)

### 4. Run History
- Table: date/time, alerts processed, TP count, FP count, duration
- Row expand: per-alert verdict breakdown

---

## Zod Schemas (lib/api-zod/src/manual.ts additions)

```typescript
Tier1RunResponse = z.object({ runId: z.number() })
Tier1AgentStatus = z.object({ status: z.enum(["idle","running"]), nextRunAt: z.string().optional(), activeRunId: z.number().nullable() })
Tier1RunSummary = z.object({ id, status, alertsProcessed, truePositives, falsePositives, durationMs, startedAt, completedAt })
IncidentSummary = z.object({ id, alertId, agentRunId, severity, title, threatSummary, affectedAsset, mitreTactic, confidence, incidentRef, createdAt })
IncidentDetail = IncidentSummary + { attackVector, potentialImpact, correlationNotes, analystRationale, remediationRunbook }
```

---

## Security Constraints

- `GROQ_API_KEY` stays server-side only
- Agent only processes alerts with `status = 'pending'` — no reprocessing
- Incident records are append-only (no update/delete endpoints)
- SSE streams are closed server-side after `run_complete` to prevent resource leaks

---

## Implementation Order

1. DB schema — add `incidents.ts`, `agentRuns.ts`, export from `lib/db/src/schema/index.ts`
2. Run `drizzle-kit push` to create tables (or user runs manually)
3. Zod schemas in `lib/api-zod/src/manual.ts`
4. `lib/tier1-agent.ts` — 4-agent pipeline + orchestrator
5. `routes/tier1-agent.ts` — REST routes + SSE endpoint
6. Register new route + cron in `app.ts` / `routes/index.ts`
7. `pages/tier1.tsx` — frontend page
8. Add nav item to `App.tsx`
9. TypeScript check + commit
