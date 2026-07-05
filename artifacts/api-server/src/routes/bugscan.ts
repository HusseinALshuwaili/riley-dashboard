import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, bugScansTable } from "@workspace/db";
import { RunBugScanBody, RunBugScanResponse, ListBugScansResponse } from "@workspace/api-zod";
import { runBugScanPipeline, fetchGithubFileContents } from "../lib/bugscan";

const router: IRouter = Router();

router.get("/bugscan/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: bugScansTable.id,
      language: bugScansTable.language,
      debunkedCount: bugScansTable.debunkedCount,
      createdAt: bugScansTable.createdAt,
      confirmedFindings: bugScansTable.confirmedFindings,
    })
    .from(bugScansTable)
    .orderBy(desc(bugScansTable.createdAt))
    .limit(50);

  const summaries = rows.map((r) => ({
    id: r.id,
    language: r.language,
    confirmedCount: Array.isArray(r.confirmedFindings) ? r.confirmedFindings.length : 0,
    debunkedCount: r.debunkedCount,
    createdAt: r.createdAt,
  }));

  res.json(ListBugScansResponse.parse(summaries));
});

router.post("/bugscan", async (req, res): Promise<void> => {
  const parsed = RunBugScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { code, githubUrl, language } = parsed.data;

  if (!code && !githubUrl) {
    res.status(400).json({ error: "Either code or githubUrl must be provided" });
    return;
  }

  let sourceCode: string;
  try {
    sourceCode = code ?? (await fetchGithubFileContents(githubUrl as string));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub source for bug scan");
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to fetch source" });
    return;
  }

  try {
    const pipelineResult = await runBugScanPipeline(sourceCode, language);

    const [scan] = await db
      .insert(bugScansTable)
      .values({
        language,
        status: pipelineResult.status,
        analyzerNotes: pipelineResult.analyzerNotes,
        detectorFindings: pipelineResult.detectorFindings,
        confirmedFindings: pipelineResult.confirmedFindings,
        debunkedCount: pipelineResult.debunkedCount,
      })
      .returning();

    req.log.info(
      { scanId: scan!.id, confirmed: pipelineResult.confirmedFindings.length },
      "Bug scan pipeline completed",
    );

    res.status(201).json(RunBugScanResponse.parse(scan));
  } catch (err) {
    req.log.error({ err }, "Bug scan pipeline failed");
    res.status(502).json({
      error: err instanceof Error ? err.message : "Bug scan pipeline failed",
    });
  }
});

export default router;
