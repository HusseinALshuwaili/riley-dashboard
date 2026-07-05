import { Router, type IRouter } from "express";
import { sql, isNotNull } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import { ListPatternsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const PATTERN_NAMES: Record<string, string> = {
  "Initial Access": "Perimeter Breach Campaign",
  Execution: "Malicious Payload Execution Wave",
  Persistence: "Persistent Foothold Campaign",
  "Privilege Escalation": "Privilege Escalation Cluster",
  "Defense Evasion": "Stealth Evasion Campaign",
  "Credential Access": "Credential Harvesting Operation",
  "Lateral Movement": "Internal Network Traversal",
  Exfiltration: "Data Exfiltration Campaign",
  "Command and Control": "C2 Beaconing Cluster",
};

router.get("/patterns", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      mitreTactic: alertsTable.mitreTactic,
      alertCount: sql<number>`count(*)::int`,
      maxSeverity: sql<string>`
        case
          when bool_or(${alertsTable.severity} = 'critical') then 'critical'
          when bool_or(${alertsTable.severity} = 'high') then 'high'
          when bool_or(${alertsTable.severity} = 'medium') then 'medium'
          else 'low'
        end
      `,
      firstSeen: sql<Date>`min(${alertsTable.createdAt})`,
      lastSeen: sql<Date>`max(${alertsTable.createdAt})`,
    })
    .from(alertsTable)
    .where(isNotNull(alertsTable.mitreTactic))
    .groupBy(alertsTable.mitreTactic)
    .orderBy(sql`count(*) desc`);

  const patterns = rows.map((r, idx) => ({
    id: String(idx + 1),
    name: PATTERN_NAMES[r.mitreTactic ?? ""] ?? `${r.mitreTactic} Activity Cluster`,
    description: `RILEY has clustered ${r.alertCount} related alert${r.alertCount === 1 ? "" : "s"} under the MITRE ATT&CK "${r.mitreTactic}" tactic based on shared behavioral signatures.`,
    alertCount: r.alertCount,
    severity: r.maxSeverity,
    mitreTactic: r.mitreTactic,
    firstSeen: r.firstSeen,
    lastSeen: r.lastSeen,
  }));

  res.json(ListPatternsResponse.parse(patterns));
});

export default router;
