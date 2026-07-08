import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { agentRunsTable } from "./agentRuns";
import { alertsTable } from "./alerts";

export const incidentsTable = pgTable("incidents", {
  id:                serial("id").primaryKey(),
  alertId:           integer("alert_id").notNull().references(() => alertsTable.id),
  agentRunId:        integer("agent_run_id").notNull().references(() => agentRunsTable.id),
  severity:          text("severity").notNull(),          // "low"|"medium"|"high"|"critical"
  title:             text("title").notNull(),
  threatSummary:     text("threat_summary").notNull(),
  affectedAsset:     text("affected_asset").notNull(),
  mitreTactic:       text("mitre_tactic"),
  attackVector:      text("attack_vector").notNull(),
  potentialImpact:   text("potential_impact").notNull(),
  correlationNotes:  text("correlation_notes").notNull(),
  analystRationale:  text("analyst_rationale").notNull(),
  remediationRunbook: text("remediation_runbook").notNull(),
  confidence:        real("confidence").notNull(),        // 0–1
  incidentRef:       text("incident_ref").notNull(),      // "INC-0001"
  createdAt:         timestamp("created_at").notNull().defaultNow(),
});

export type Incident = typeof incidentsTable.$inferSelect;
