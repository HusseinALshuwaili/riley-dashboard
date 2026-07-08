import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const agentRunsTable = pgTable("agent_runs", {
  id:               serial("id").primaryKey(),
  status:           text("status").notNull().default("running"),  // "running" | "completed" | "failed"
  alertsProcessed:  integer("alerts_processed").notNull().default(0),
  truePositives:    integer("true_positives").notNull().default(0),
  falsePositives:   integer("false_positives").notNull().default(0),
  skipped:          integer("skipped").notNull().default(0),
  durationMs:       integer("duration_ms"),
  errorMessage:     text("error_message"),
  startedAt:        timestamp("started_at").notNull().defaultNow(),
  completedAt:      timestamp("completed_at"),
});

export type AgentRun = typeof agentRunsTable.$inferSelect;
