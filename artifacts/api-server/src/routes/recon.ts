import { Router, type IRouter } from "express";
import EventEmitter from "events";
import { db, reconScansTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { runReconScan, detectTargetType } from "../lib/recon-agent";
import {
  ReconStartBody,
  ReconStartResponse,
  ListReconScansResponse,
  ReconScanDetail,
} from "@workspace/api-zod";

const router: IRouter = Router();

// In-memory map of active scan emitters — keyed by scanId
const activeEmitters = new Map<number, EventEmitter>();

// ---------------------------------------------------------------------------
// POST /recon/scan  — start a new recon scan
// ---------------------------------------------------------------------------
router.post("/recon/scan", async (req, res): Promise<void> => {
  const parsed = ReconStartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { target } = parsed.data;
  const targetType = detectTargetType(target.trim());

  // Insert initial row
  const [row] = await db
    .insert(reconScansTable)
    .values({
      target: target.trim(),
      targetType,
      status: "running",
    })
    .returning({ id: reconScansTable.id });

  const scanId = row.id;

  // Create emitter and store for SSE consumers
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);
  activeEmitters.set(scanId, emitter);

  // Clean up emitter 5 minutes after scan finishes
  const cleanup = () => {
    setTimeout(() => activeEmitters.delete(scanId), 5 * 60 * 1000);
  };

  emitter.once("log", (evt) => {
    if (evt.type === "scan_complete" || evt.type === "scan_error") cleanup();
  });

  // Run scan in background
  runReconScan(scanId, target.trim(), targetType, emitter).catch((err) => {
    console.error("[recon] Background scan error:", err);
    cleanup();
  });

  const response = ReconStartResponse.parse({ scanId, target: target.trim(), targetType });
  res.json(response);
});

// ---------------------------------------------------------------------------
// GET /recon/scans/:id/stream  — SSE live log stream (must come before :id)
// ---------------------------------------------------------------------------
router.get("/recon/scans/:id/stream", async (req, res): Promise<void> => {
  const scanId = parseInt(req.params.id, 10);
  if (isNaN(scanId)) {
    res.status(400).json({ error: "Invalid scan ID" });
    return;
  }

  // Check if scan exists
  const [scan] = await db
    .select()
    .from(reconScansTable)
    .where(eq(reconScansTable.id, scanId));

  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  // If scan is already complete, send a synthetic complete event and close
  if (scan.status === "completed" || scan.status === "failed") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    if (scan.status === "completed") {
      res.write(
        `data: ${JSON.stringify({
          type: "scan_complete",
          riskScore: scan.riskScore,
          riskLevel: scan.riskLevel,
          threatSummary: scan.threatSummary,
          iocs: scan.iocs,
        })}\n\n`
      );
    } else {
      res.write(`data: ${JSON.stringify({ type: "scan_error", error: scan.errorMessage })}\n\n`);
    }
    res.end();
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable Nginx buffering
  });
  res.write(": connected\n\n");

  const emitter = activeEmitters.get(scanId);
  if (!emitter) {
    res.write(`data: ${JSON.stringify({ type: "scan_error", error: "Emitter not found" })}\n\n`);
    res.end();
    return;
  }

  const onLog = (event: unknown) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    const evt = event as { type: string };
    if (evt.type === "scan_complete" || evt.type === "scan_error") {
      res.end();
    }
  };

  emitter.on("log", onLog);

  req.on("close", () => {
    emitter.off("log", onLog);
  });
});

// ---------------------------------------------------------------------------
// GET /recon/scans  — list recent scans
// ---------------------------------------------------------------------------
router.get("/recon/scans", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: reconScansTable.id,
      target: reconScansTable.target,
      targetType: reconScansTable.targetType,
      status: reconScansTable.status,
      riskScore: reconScansTable.riskScore,
      riskLevel: reconScansTable.riskLevel,
      threatSummary: reconScansTable.threatSummary,
      durationMs: reconScansTable.durationMs,
      createdAt: reconScansTable.createdAt,
    })
    .from(reconScansTable)
    .orderBy(desc(reconScansTable.createdAt))
    .limit(50);

  const response = ListReconScansResponse.parse({
    scans: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
  res.json(response);
});

// ---------------------------------------------------------------------------
// GET /recon/scans/:id  — full scan detail
// ---------------------------------------------------------------------------
router.get("/recon/scans/:id", async (req, res): Promise<void> => {
  const scanId = parseInt(req.params.id, 10);
  if (isNaN(scanId)) {
    res.status(400).json({ error: "Invalid scan ID" });
    return;
  }

  const [row] = await db
    .select()
    .from(reconScansTable)
    .where(eq(reconScansTable.id, scanId));

  if (!row) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  const response = ReconScanDetail.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    iocs: (row.iocs as string[] | null) ?? null,
    mitreTechniques: (row.mitreTechniques as string[] | null) ?? null,
  });
  res.json(response);
});

export default router;
