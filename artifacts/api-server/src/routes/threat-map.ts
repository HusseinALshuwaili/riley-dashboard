import { Router, type IRouter } from "express";
import { db, reconScansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Country code → approximate geographic center
// ---------------------------------------------------------------------------
const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  US: { lat: 37.09, lng: -95.71 },
  CN: { lat: 35.86, lng: 104.19 },
  RU: { lat: 61.52, lng: 105.32 },
  DE: { lat: 51.17, lng: 10.45 },
  GB: { lat: 55.38, lng: -3.44 },
  FR: { lat: 46.23, lng: 2.21 },
  IN: { lat: 20.59, lng: 78.96 },
  BR: { lat: -14.24, lng: -51.93 },
  JP: { lat: 36.20, lng: 138.25 },
  KR: { lat: 35.91, lng: 127.77 },
  CA: { lat: 56.13, lng: -106.35 },
  AU: { lat: -25.27, lng: 133.78 },
  NL: { lat: 52.13, lng: 5.29 },
  SG: { lat: 1.35, lng: 103.82 },
  UA: { lat: 48.38, lng: 31.17 },
  IR: { lat: 32.43, lng: 53.69 },
  KP: { lat: 40.34, lng: 127.51 },
  TR: { lat: 38.96, lng: 35.24 },
  PL: { lat: 51.92, lng: 19.15 },
  ID: { lat: -0.79, lng: 113.92 },
  MX: { lat: 23.63, lng: -102.55 },
  VN: { lat: 14.06, lng: 108.28 },
  TH: { lat: 15.87, lng: 100.99 },
  HK: { lat: 22.40, lng: 114.11 },
  RO: { lat: 45.94, lng: 24.97 },
  CZ: { lat: 49.82, lng: 15.47 },
  HU: { lat: 47.16, lng: 19.50 },
  BG: { lat: 42.73, lng: 25.49 },
  IT: { lat: 41.87, lng: 12.57 },
  ES: { lat: 40.46, lng: -3.75 },
  SE: { lat: 60.13, lng: 18.64 },
  NO: { lat: 60.47, lng: 8.47 },
  FI: { lat: 61.92, lng: 25.75 },
  CH: { lat: 46.82, lng: 8.23 },
  AT: { lat: 47.52, lng: 14.55 },
  BY: { lat: 53.71, lng: 27.95 },
  PK: { lat: 30.38, lng: 69.35 },
  BD: { lat: 23.68, lng: 90.36 },
  NG: { lat: 9.08, lng: 8.68 },
  ZA: { lat: -30.56, lng: 22.94 },
  EG: { lat: 26.82, lng: 30.80 },
  SA: { lat: 23.89, lng: 45.08 },
  IL: { lat: 31.05, lng: 34.85 },
  AE: { lat: 23.42, lng: 53.85 },
  MY: { lat: 4.21, lng: 101.98 },
  PH: { lat: 12.88, lng: 121.77 },
  TW: { lat: 23.70, lng: 120.96 },
  AR: { lat: -38.42, lng: -63.62 },
  CL: { lat: -35.68, lng: -71.54 },
  UZ: { lat: 41.38, lng: 64.59 },
  KZ: { lat: 48.02, lng: 66.92 },
  PT: { lat: 39.40, lng: -8.22 },
  GR: { lat: 39.07, lng: 21.82 },
  RS: { lat: 44.02, lng: 21.01 },
  LT: { lat: 55.17, lng: 23.88 },
  LV: { lat: 56.88, lng: 24.60 },
  EE: { lat: 58.60, lng: 25.01 },
  SK: { lat: 48.67, lng: 19.70 },
  HR: { lat: 45.10, lng: 15.20 },
  DK: { lat: 56.26, lng: 9.50 },
  BE: { lat: 50.50, lng: 4.47 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface OsintToolResult {
  tool: string;
  status: string;
  data?: Record<string, unknown>;
}

function extractGeo(osintData: unknown): { lat: number; lng: number; country: string } | null {
  if (!Array.isArray(osintData)) return null;
  const tools = osintData as OsintToolResult[];

  // ipinfo.io: exact "lat,lng" in loc field
  const ipinfo = tools.find(r => r.tool === "ipinfo.io" && r.status === "ok");
  if (typeof ipinfo?.data?.loc === "string") {
    const [latStr, lngStr] = ipinfo.data.loc.split(",");
    const lat = parseFloat(latStr ?? "");
    const lng = parseFloat(lngStr ?? "");
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng, country: String(ipinfo.data.country ?? "??") };
    }
  }

  // AbuseIPDB: countryCode → lookup
  const abuse = tools.find(r => r.tool === "AbuseIPDB" && r.status === "ok");
  if (typeof abuse?.data?.countryCode === "string") {
    const coords = COUNTRY_COORDS[abuse.data.countryCode];
    if (coords) return { ...coords, country: abuse.data.countryCode };
  }

  // VirusTotal: country field
  const vt = tools.find(r => r.tool === "VirusTotal" && r.status === "ok");
  if (typeof vt?.data?.country === "string") {
    const coords = COUNTRY_COORDS[vt.data.country];
    if (coords) return { ...coords, country: vt.data.country };
  }

  // AlienVault OTX: country
  const otx = tools.find(r => r.tool === "AlienVault OTX" && r.status === "ok");
  if (typeof otx?.data?.country === "string") {
    const code = otx.data.country.toUpperCase().slice(0, 2);
    const coords = COUNTRY_COORDS[code];
    if (coords) return { ...coords, country: code };
  }

  return null;
}

// Arc color gradient by risk level [from, to]
function arcColor(riskLevel: string | null): [string, string] {
  switch (riskLevel) {
    case "critical": return ["rgba(255,34,68,0.95)",  "rgba(255,34,68,0)"];
    case "high":     return ["rgba(255,102,0,0.95)",  "rgba(255,102,0,0)"];
    case "medium":   return ["rgba(255,200,0,0.95)",  "rgba(255,200,0,0)"];
    default:         return ["rgba(0,255,180,0.95)",  "rgba(0,255,180,0)"];
  }
}

// ---------------------------------------------------------------------------
// Defender "home base" location (configurable via env vars)
// ---------------------------------------------------------------------------
const HOME_LAT = parseFloat(process.env.HOME_LAT ?? "37.09");
const HOME_LNG = parseFloat(process.env.HOME_LNG ?? "-95.71");

// ---------------------------------------------------------------------------
// GET /threat-map/geo-events
// Returns arcs, points, and stats from completed recon scans
// ---------------------------------------------------------------------------
router.get("/threat-map/geo-events", async (_req, res): Promise<void> => {
  try {
    const scans = await db
      .select({
        id: reconScansTable.id,
        target: reconScansTable.target,
        targetType: reconScansTable.targetType,
        riskLevel: reconScansTable.riskLevel,
        riskScore: reconScansTable.riskScore,
        osintData: reconScansTable.osintData,
        threatSummary: reconScansTable.threatSummary,
        createdAt: reconScansTable.createdAt,
      })
      .from(reconScansTable)
      .where(eq(reconScansTable.status, "completed"))
      .orderBy(desc(reconScansTable.createdAt))
      .limit(200);

    const arcs: object[] = [];
    // Aggregate points by country
    const pointMap: Record<string, {
      lat: number; lng: number; country: string; count: number; maxRisk: string;
    }> = {};

    const RISK_ORDER = ["low", "medium", "high", "critical"];

    for (const scan of scans) {
      const geo = extractGeo(scan.osintData);
      if (!geo) continue;

      arcs.push({
        startLat: geo.lat,
        startLng: geo.lng,
        endLat: HOME_LAT,
        endLng: HOME_LNG,
        color: arcColor(scan.riskLevel),
        label: `${scan.target} (${scan.riskLevel ?? "unknown"} risk)`,
        riskLevel: scan.riskLevel ?? "low",
        riskScore: scan.riskScore,
        target: scan.target,
        targetType: scan.targetType,
        createdAt: scan.createdAt.toISOString(),
      });

      const key = geo.country;
      if (!pointMap[key]) {
        pointMap[key] = { lat: geo.lat, lng: geo.lng, country: key, count: 0, maxRisk: "low" };
      }
      pointMap[key].count++;
      if (
        RISK_ORDER.indexOf(scan.riskLevel ?? "low") >
        RISK_ORDER.indexOf(pointMap[key].maxRisk)
      ) {
        pointMap[key].maxRisk = scan.riskLevel ?? "low";
      }
    }

    const points = Object.values(pointMap).map(p => ({
      lat: p.lat,
      lng: p.lng,
      size: Math.min(1.0, 0.2 + p.count * 0.12),
      color: arcColor(p.maxRisk)[0],
      label: `${p.country}: ${p.count} threat${p.count !== 1 ? "s" : ""}`,
      country: p.country,
      count: p.count,
      maxRisk: p.maxRisk,
    }));

    // Sort by count desc for the leaderboard
    const topCountries = [...points]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    res.json({
      arcs,
      points,
      topCountries,
      homeBase: { lat: HOME_LAT, lng: HOME_LNG },
      stats: {
        totalScans: scans.length,
        uniqueCountries: Object.keys(pointMap).length,
        criticalCount: scans.filter(s => s.riskLevel === "critical").length,
        highCount: scans.filter(s => s.riskLevel === "high").length,
        mediumCount: scans.filter(s => s.riskLevel === "medium").length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
