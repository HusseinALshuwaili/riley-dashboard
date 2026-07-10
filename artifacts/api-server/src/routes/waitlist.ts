import { Router } from "express";
import { z } from "zod";
import { db, waitlistTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

const waitlistSchema = z.object({
  email: z.string().email(),
  plan: z.enum(["starter", "pro", "enterprise"]).default("pro"),
  source: z.string().optional(),
});

// POST /waitlist — save an email signup
router.post("/waitlist", async (req, res) => {
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const { email, plan, source } = parsed.data;

  try {
    await db
      .insert(waitlistTable)
      .values({ email, plan, source: source ?? "landing" })
      .onConflictDoNothing(); // idempotent — duplicate emails silently succeed

    logger.info({ email, plan }, "Waitlist signup");
    return res.json({ success: true, message: "You're on the list!" });
  } catch (err) {
    logger.error({ err, email }, "Waitlist insert failed");
    return res.status(500).json({ error: "Failed to save signup" });
  }
});

// GET /waitlist/count — for the landing page stats
router.get("/waitlist/count", async (_req, res) => {
  try {
    const rows = await db.select().from(waitlistTable);
    return res.json({ count: rows.length });
  } catch {
    return res.json({ count: 0 });
  }
});

export default router;
