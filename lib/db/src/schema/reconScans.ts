import { pgTable, serial, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reconScansTable = pgTable("recon_scans", {
  id: serial("id").primaryKey(),
  target: text("target").notNull(),
  targetType: text("target_type").notNull(), // "ip" | "domain" | "hash" | "url"
  status: text("status").notNull().default("running"), // "running" | "completed" | "failed"
  // Raw OSINT results per tool
  osintData: jsonb("osint_data"),
  // AI synthesis outputs
  threatSummary: text("threat_summary"),
  riskScore: real("risk_score"),      // 0–100
  riskLevel: text("risk_level"),      // "low" | "medium" | "high" | "critical"
  iocs: jsonb("iocs"),                // string[]
  mitreTechniques: jsonb("mitre_techniques"), // string[]
  recommendations: text("recommendations"),
  analystRationale: text("analyst_rationale"),
  errorMessage: text("error_message"),
  durationMs: real("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReconScanSchema = createInsertSchema(reconScansTable).omit({ id: true });
export type InsertReconScan = z.infer<typeof insertReconScanSchema>;
export type ReconScan = typeof reconScansTable.$inferSelect;
