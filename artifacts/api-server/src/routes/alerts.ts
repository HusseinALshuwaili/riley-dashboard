import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, and, inArray, type SQL } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import {
  ListAlertsQueryParams,
  ListAlertsResponse,
  GetAlertParams,
  GetAlertResponse,
  UpdateAlertStatusParams,
  UpdateAlertStatusBody,
  UpdateAlertStatusResponse,
  SimulateAlertsBody,
  SimulateAlertsResponse,
  BulkUpdateAlertsBody,
  BulkUpdateAlertsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TITLES = [
  "Suspicious PowerShell execution chain",
  "Anomalous outbound beacon pattern",
  "Known admin tool execution",
  "Lateral movement detected",
  "Credential dumping attempt",
  "Unusual login geo velocity",
  "Chrome auto-update flagged",
  "Privilege escalation via scheduled task",
  "C2 beacon pattern match",
  "Brute-force login attempts",
  "Data exfiltration to unknown host",
  "Registry persistence mechanism created",
  "Suspicious DNS tunneling activity",
  "Unsigned binary execution in temp dir",
  "Mimikatz-like memory access pattern",
];

const SOURCES = ["CrowdStrike", "Splunk", "SentinelOne", "MS Sentinel", "Okta", "Zscaler"];
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const TACTICS = [
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Lateral Movement",
  "Exfiltration",
  "Command and Control",
];
const ASSET_PREFIXES = ["LON-SRV", "SFO-WS", "TKY-WS", "BER-SRV", "NYC-WS", "AMS-SRV"];

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomAlertId(): string {
  return `AL-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateSyntheticAlert() {
  const severity = randomFrom(SEVERITIES);
  const confidence =
    severity === "critical" || severity === "high"
      ? 0.7 + Math.random() * 0.29
      : Math.random() * 0.65;
  return {
    alertId: randomAlertId(),
    title: randomFrom(TITLES),
    description:
      "Automated triage flagged this event based on behavioral correlation across host, network, and identity telemetry.",
    source: randomFrom(SOURCES),
    severity,
    status: "pending" as const,
    confidence: Number(confidence.toFixed(2)),
    assetName: `${randomFrom(ASSET_PREFIXES)}-${Math.floor(1000 + Math.random() * 9000)}`,
    mitreTactic: randomFrom(TACTICS),
  };
}

router.get("/alerts", async (req, res): Promise<void> => {
  const parsed = ListAlertsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions: SQL[] = [];
  if (parsed.data.status) {
    conditions.push(eq(alertsTable.status, parsed.data.status));
  }
  if (parsed.data.search) {
    const term = `%${parsed.data.search}%`;
    const clause = or(
      ilike(alertsTable.title, term),
      ilike(alertsTable.assetName, term),
      ilike(alertsTable.alertId, term),
    );
    if (clause) conditions.push(clause);
  }

  const rows = await db
    .select()
    .from(alertsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(alertsTable.createdAt));

  res.json(ListAlertsResponse.parse(rows));
});

router.post("/alerts/simulate", async (req, res): Promise<void> => {
  const parsed = SimulateAlertsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const count = parsed.data.count ?? 5;
  const newAlerts = Array.from({ length: count }, generateSyntheticAlert);

  const inserted = await db.insert(alertsTable).values(newAlerts).returning();

  req.log.info({ count: inserted.length }, "Simulated new alerts");
  res.status(201).json(SimulateAlertsResponse.parse(inserted));
});

router.get("/alerts/:id", async (req, res): Promise<void> => {
  const params = GetAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [alert] = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.id, params.data.id));

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.json(GetAlertResponse.parse(alert));
});

router.patch("/alerts/:id", async (req, res): Promise<void> => {
  const params = UpdateAlertStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAlertStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [alert] = await db
    .update(alertsTable)
    .set({ status: parsed.data.status })
    .where(eq(alertsTable.id, params.data.id))
    .returning();

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.json(UpdateAlertStatusResponse.parse(alert));
});

router.patch("/alerts/bulk", async (req, res): Promise<void> => {
  const parsed = BulkUpdateAlertsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ids, status } = parsed.data;

  await db
    .update(alertsTable)
    .set({ status })
    .where(inArray(alertsTable.id, ids));

  req.log.info({ count: ids.length, status }, "Bulk updated alerts");
  res.json(BulkUpdateAlertsResponse.parse({ updatedCount: ids.length, status }));
});

export default router;
export { generateSyntheticAlert };
