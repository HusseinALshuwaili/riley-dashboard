import { Router } from "express";
import { runOsintAgent, type OsintReport } from "../lib/agents/osint-agent";

const router = Router();

// In-memory history (last 20 scans)
const history: OsintReport[] = [];

// POST /osint — run OSINT investigation on a target
router.post("/osint", async (req, res) => {
  const { target } = req.body as { target?: string };
  if (!target?.trim()) {
    return res.status(400).json({ error: "target is required" });
  }
  try {
    const report = await runOsintAgent(target);
    history.unshift(report);
    if (history.length > 20) history.length = 20;
    return res.json(report);
  } catch (e) {
    console.error("[osint route]", e);
    return res.status(500).json({ error: "OSINT investigation failed", detail: String(e) });
  }
});

// GET /osint/history — return last 20 OSINT scans
router.get("/osint/history", (_req, res) => {
  res.json(history);
});

export default router;
