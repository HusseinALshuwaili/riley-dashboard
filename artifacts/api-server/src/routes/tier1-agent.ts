import { Router, type IRouter, type Request, type Response } from "express";
import { db, agentRunsTable, incidentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  runTier1AgentSweep,
  getActiveRunId,
  getNextRunAt,
  getRunEmitter,
  type Tier1LogEvent,
} from "../lib/agents/tier1-agent";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /tier1-agent/status
// ---------------------------------------------------------------------------

router.get("/tier1-agent/status", (_req: Request, res: Response): void => {
  const activeRunId = getActiveRunId();
  const nextRunAt = getNextRunAt();
  res.json({
    status: activeRunId !== null ? "running" : "idle",
    activeRunId: activeRunId ?? null,
    nextRunAt: nextRunAt?.toISOString() ?? null,
  });
});

// ---------------------------------------------------------------------------
// POST /tier1-agent/run
// ---------------------------------------------------------------------------

router.post("/tier1-agent/run", async (_req: Request, res: Response): Promise<void> => {
  try {
    const runId = await runTier1AgentSweep();
    res.json({ runId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(409).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// GET /tier1-agent/runs
// ---------------------------------------------------------------------------

router.get("/tier1-agent/runs", async (_req: Request, res: Response): Promise<void> => {
  const runs = await db
    .select()
    .from(agentRunsTable)
    .orderBy(desc(agentRunsTable.startedAt))
    .limit(50);

  res.json({
    runs: runs.map(r => ({
      ...r,
      startedAt:   r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  });
});

// ---------------------------------------------------------------------------
// GET /tier1-agent/runs/:id
// ---------------------------------------------------------------------------

router.get("/tier1-agent/runs/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid run ID" }); return; }

  const [run] = await db
    .select()
    .from(agentRunsTable)
    .where(eq(agentRunsTable.id, id));

  if (!run) { res.status(404).json({ error: "Run not found" }); return; }

  const runIncidents = await db
    .select()
    .from(incidentsTable)
    .where(eq(incidentsTable.agentRunId, id))
    .orderBy(desc(incidentsTable.createdAt));

  res.json({
    run: { ...run, startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null },
    incidents: runIncidents.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })),
  });
});

// ---------------------------------------------------------------------------
// GET /tier1-agent/runs/:id/stream  — SSE
// ---------------------------------------------------------------------------

router.get("/tier1-agent/runs/:id/stream", (req: Request, res: Response): void => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: Tier1LogEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const emitter = getRunEmitter(id);
  if (!emitter) {
    send({ type: "run_error", message: "No active run with that ID" });
    res.end();
    return;
  }

  const onLog = (event: Tier1LogEvent) => {
    send(event);
    if (event.type === "run_complete" || event.type === "run_error") {
      res.end();
    }
  };

  emitter.on("log", onLog);

  req.on("close", () => {
    emitter.off("log", onLog);
  });
});

// ---------------------------------------------------------------------------
// GET /tier1-agent/incidents
// ---------------------------------------------------------------------------

router.get("/tier1-agent/incidents", async (_req: Request, res: Response): Promise<void> => {
  const incidents = await db
    .select({
      id:           incidentsTable.id,
      alertId:      incidentsTable.alertId,
      agentRunId:   incidentsTable.agentRunId,
      severity:     incidentsTable.severity,
      title:        incidentsTable.title,
      threatSummary: incidentsTable.threatSummary,
      affectedAsset: incidentsTable.affectedAsset,
      mitreTactic:  incidentsTable.mitreTactic,
      confidence:   incidentsTable.confidence,
      incidentRef:  incidentsTable.incidentRef,
      createdAt:    incidentsTable.createdAt,
    })
    .from(incidentsTable)
    .orderBy(desc(incidentsTable.createdAt))
    .limit(100);

  res.json({
    incidents: incidents.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })),
  });
});

// ---------------------------------------------------------------------------
// GET /tier1-agent/incidents/:id
// ---------------------------------------------------------------------------

router.get("/tier1-agent/incidents/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid incident ID" }); return; }

  const [incident] = await db
    .select()
    .from(incidentsTable)
    .where(eq(incidentsTable.id, id));

  if (!incident) { res.status(404).json({ error: "Incident not found" }); return; }

  res.json({ ...incident, createdAt: incident.createdAt.toISOString() });
});

export default router;
