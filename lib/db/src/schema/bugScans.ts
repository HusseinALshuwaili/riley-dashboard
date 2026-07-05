import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bugScansTable = pgTable("bug_scans", {
  id: serial("id").primaryKey(),
  language: text("language").notNull(),
  status: text("status").notNull(),
  analyzerNotes: text("analyzer_notes").notNull(),
  detectorFindings: jsonb("detector_findings").notNull(),
  confirmedFindings: jsonb("confirmed_findings").notNull(),
  debunkedCount: integer("debunked_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBugScanSchema = createInsertSchema(bugScansTable).omit({ id: true });
export type InsertBugScan = z.infer<typeof insertBugScanSchema>;
export type BugScan = typeof bugScansTable.$inferSelect;
