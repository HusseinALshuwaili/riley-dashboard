import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { runTier1AgentSweep, setNextRunAt } from "./lib/agents/tier1-agent";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: { id?: string | number; method?: string; url?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode?: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ---------------------------------------------------------------------------
// Tier 1 Agent — cron scheduler
// Guards: only runs if GROQ_API_KEY is set; skips if a run is already active.
// ---------------------------------------------------------------------------
if (process.env.GROQ_API_KEY) {
  const intervalMinutes = parseInt(process.env.TIER1_AGENT_INTERVAL_MINUTES ?? "5", 10);
  const intervalMs = intervalMinutes * 60 * 1000;

  const scheduleTick = () => {
    const next = new Date(Date.now() + intervalMs);
    setNextRunAt(next);

    setTimeout(async () => {
      try {
        await runTier1AgentSweep();
      } catch (err) {
        // Already running or other non-fatal error — just log and reschedule
        logger.info({ err }, "[tier1] Skipped scheduled sweep");
      }
      scheduleTick(); // reschedule after each run
    }, intervalMs);
  };

  scheduleTick();
  logger.info(`[tier1] Autonomous agent scheduled — every ${intervalMinutes}m`);
}

export default app;
