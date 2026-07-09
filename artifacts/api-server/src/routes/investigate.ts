/**
 * Investigation Agent route
 *
 * POST /investigate/:alertId
 *   - Runs the 3-stage investigation pipeline on a single alert
 *   - Returns full InvestigationReport JSON
 *   - Caches the last result in-memory per alertId (5 min TTL)
 *
 * GET /investigate/:alertId
 *   - Returns cached report if available, else 404
 */

import { Router } from "express";
import { runInvestigationAgent } from "../lib/agents/investigation-agent";

const router = Router();

// ---------------------------------------------------------------------------
// In-memory cache — avoids hammering Groq for repeat views (5 min TTL)
// ---------------------------------------------------------------------------

interface CachedReport {
  report:    unknown;
  expiresAt: number;
}
const cache = new Map<number, CachedReport>();
const TTL_MS = 5 * 60 * 1000;

function getCached(alertId: number): unknown | null {
  const entry = cache.get(alertId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(alertId); return null; }
  return entry.report;
}

function setCached(alertId: number, report: unknown): void {
  cache.set(alertId, { report, expiresAt: Date.now() + TTL_MS });
}

// ---------------------------------------------------------------------------
// POST /investigate/:alertId — run fresh investigation
// ---------------------------------------------------------------------------

router.post("/investigate/:alertId", async (req, res) => {
  const alertId = parseInt(req.params.alertId, 10);
  if (isNaN(alertId)) {
    res.status(400).json({ error: "Invalid alertId" });
    return;
  }

  try {
    const report = await runInvestigationAgent(alertId);
    setCached(alertId, report);
    res.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: `Investigation failed: ${message}` });
    }
  }
});

// ---------------------------------------------------------------------------
// GET /investigate/:alertId — return cached or 404
// ---------------------------------------------------------------------------

router.get("/investigate/:alertId", (req, res) => {
  const alertId = parseInt(req.params.alertId, 10);
  if (isNaN(alertId)) {
    res.status(400).json({ error: "Invalid alertId" });
    return;
  }

  const cached = getCached(alertId);
  if (!cached) {
    res.status(404).json({ error: "No cached investigation. Run POST /investigate/:alertId first." });
    return;
  }
  res.json(cached);
});

export default router;
