import { Router, type IRouter } from "express";
import { RileyChatBody, RileyChatResponse } from "@workspace/api-zod";
import { runRileyAgent } from "../lib/riley-agent";

const router: IRouter = Router();

router.post("/riley-chat", async (req, res): Promise<void> => {
  const parsed = RileyChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, history, context } = parsed.data;

  try {
    const result = await runRileyAgent(message, history, context);
    req.log.info(
      {
        tools: result.toolCallsUsed,
        iterations: result.iterations,
        actions: result.actionsPerformed.length,
      },
      "RILEY agent completed",
    );
    res.json(RileyChatResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "RILEY agent failed");
    res.status(502).json({
      error: err instanceof Error ? err.message : "RILEY agent failed",
    });
  }
});

export default router;
