/**
 * Manually maintained schemas (not orval-generated).
 * Add new endpoints here when not covered by the OpenAPI spec.
 */
import * as zod from "zod";

// ---- RILEY AI Chat ----

export const RileyChatHistoryItem = zod.object({
  role: zod.enum(["user", "assistant"]),
  content: zod.string(),
});

export const RileyChatBody = zod.object({
  message: zod.string().min(1),
  history: zod.array(RileyChatHistoryItem).optional().default([]),
  context: zod
    .object({
      page: zod.string(),
    })
    .optional(),
});

export const RileyChatActionItem = zod.object({
  tool: zod.string(),
  args: zod.record(zod.unknown()),
  result: zod.unknown(),
});

export const RileyChatResponse = zod.object({
  reply: zod.string(),
  toolCallsUsed: zod.array(zod.string()),
  actionsPerformed: zod.array(RileyChatActionItem),
  iterations: zod.number(),
});

// ---- Bulk Alert Update ----

export const BulkUpdateAlertsBody = zod.object({
  ids: zod.array(zod.number()).min(1),
  status: zod.enum(["pending", "true_positive", "false_positive", "resolved"]),
});

export const BulkUpdateAlertsResponse = zod.object({
  updatedCount: zod.number(),
  status: zod.enum(["pending", "true_positive", "false_positive", "resolved"]),
});
