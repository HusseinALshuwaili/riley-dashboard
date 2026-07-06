# RILEY AI Agent — Design Spec
**Date:** 2026-07-06  
**Status:** Approved  
**Scope:** Central AI agent (floating chat) for all 5 dashboard pages

---

## Overview

RILEY gets a persistent floating AI chat panel visible on every page of the dashboard. Users can ask natural-language questions or give action commands, and RILEY uses a ReAct loop with Groq LLaMA-3.3-70b to fetch live data and take actions on their behalf.

---

## Architecture

### Backend

**New files:**
- `artifacts/api-server/src/lib/riley-agent.ts` — ReAct loop engine
- `artifacts/api-server/src/routes/riley-chat.ts` — `POST /riley-chat` endpoint

**ReAct loop (up to 5 iterations):**
1. Call Groq with system prompt + conversation history + tool definitions
2. If model returns tool_calls → execute each tool, append results to history, loop
3. If model returns a final message (no tool_calls) → return to client

**New endpoint:** `POST /riley-chat`
```
Body:  { message: string, history?: {role, content}[], context?: {page: string} }
Response: { reply: string, toolCallsUsed: string[], actionsPerformed: {tool, result}[] }
```

**Also add:** `PATCH /alerts/bulk` — `{ ids: number[], status: string }` for bulk triage

### Tools RILEY Can Call

| Tool | Args | Action |
|------|------|--------|
| `get_dashboard_summary` | — | Fetches live KPI data |
| `list_alerts` | `{ status?, severity?, search?, limit? }` | Queries alert DB |
| `get_alert` | `{ id: number }` | Single alert detail |
| `update_alert_status` | `{ id: number, status }` | Triages one alert |
| `bulk_update_alerts` | `{ ids: number[], status }` | Triages many alerts |
| `list_patterns` | — | MITRE tactic clusters |
| `simulate_alerts` | `{ count: number }` | Injects synthetic alerts |
| `run_bugscan` | `{ code: string, language: string }` | Triggers 3-agent pipeline |
| `list_recent_bugscans` | `{ limit? }` | Scan history |

### Frontend

**New file:** `artifacts/riley-dashboard/src/components/RileyChat.tsx`

- Floating circular teal toggle button, bottom-right corner, pulsing ring animation
- Slide-up glass panel (380×520px), fixed position, z-50
- Chat history: user bubbles (right, teal), RILEY bubbles (left, dark card + avatar)
- Thinking state: "RILEY is working… (step 2/5)" with animated dots
- Actions log: collapsed section below each RILEY reply showing tools used
- Input bar: Enter to send, Shift+Enter for newline
- State: all local to component (no global store); history array sent on every call

**Wired in App.tsx:** `<RileyChat currentPage={activePage} />`

---

## Zod Schemas (lib/api-zod)

```typescript
export const RileyChatBody = z.object({
  message: z.string(),
  history: z.array(z.object({ role: z.enum(['user','assistant']), content: z.string() })).optional().default([]),
  context: z.object({ page: z.string() }).optional(),
})

export const RileyChatResponse = z.object({
  reply: z.string(),
  toolCallsUsed: z.array(z.string()),
  actionsPerformed: z.array(z.object({
    tool: z.string(),
    result: z.unknown(),
  })),
})
```

---

## System Prompt

RILEY's system prompt establishes its persona:

> You are RILEY, an AI security operations agent embedded in the Riley Security SOC dashboard. You have real-time access to the alert queue, threat patterns, dashboard KPIs, and the bug scanner. You help SOC analysts understand their threat landscape and take action — triaging alerts, identifying false positives, investigating patterns, and running security scans. Be concise, precise, and security-focused. When taking actions (triaging alerts, simulating attacks), always confirm what you did.

---

## Security Constraints

- GROQ_API_KEY stays server-side only (env var on Render). Never exposed to frontend.
- All tool executions go through the same Drizzle/DB layer as existing routes.
- No new auth surface: `/riley-chat` is as open as the existing API (protected only by deployment).

---

## Implementation Order

1. Zod schemas (lib/api-zod)
2. riley-agent.ts (ReAct engine + tools)
3. riley-chat.ts route + bulk_update_alerts in alerts route
4. Register new routes in routes/index.ts
5. RileyChat.tsx component
6. Wire into App.tsx
7. TypeScript check + commit
