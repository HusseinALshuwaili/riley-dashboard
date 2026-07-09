/**
 * RILEY Threat Globe
 * Real-time 3D spinning Earth with animated attack arcs drawn from threat
 * geolocation data stored in completed recon scans.
 *
 * Requires: react-globe.gl (run `pnpm install` after package.json update)
 * Falls back to an animated Canvas globe if the library isn't available.
 */

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Globe as GlobeIcon, RefreshCw, AlertTriangle, Wifi, WifiOff } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeoArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
  label: string;
  riskLevel: string;
  riskScore: number | null;
  target: string;
  targetType: string;
  createdAt: string;
}

interface GeoPoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  country: string;
  count: number;
  maxRisk: string;
}

interface TopCountry {
  country: string;
  count: number;
  maxRisk: string;
}

interface GeoStats {
  totalScans: number;
  uniqueCountries: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
}

interface GeoEventsResponse {
  arcs: GeoArc[];
  points: GeoPoint[];
  topCountries: TopCountry[];
  homeBase: { lat: number; lng: number };
  stats: GeoStats;
}

// ---------------------------------------------------------------------------
// Lazy-load react-globe.gl (heavy 3D library)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Globe = lazy(() => import("react-globe.gl").catch(() => ({ default: null as any })));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<string, string> = {
  critical: "#ff2244",
  high:     "#ff6600",
  medium:   "#ffcc00",
  low:      "#00ffb4",
};

function riskBadgeClass(risk: string) {
  switch (risk) {
    case "critical": return "bg-red-600/20 text-red-400 border-red-600/40";
    case "high":     return "bg-orange-600/20 text-orange-400 border-orange-600/40";
    case "medium":   return "bg-yellow-600/20 text-yellow-400 border-yellow-600/40";
    default:         return "bg-emerald-600/20 text-emerald-400 border-emerald-600/40";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Fallback Canvas Globe (when react-globe.gl isn't installed)
// ---------------------------------------------------------------------------

function CanvasGlobe({ arcs }: { arcs: GeoArc[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const rotationRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) * 0.38;

      ctx.clearRect(0, 0, W, H);

      // Space background gradient
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H));
      bg.addColorStop(0, "hsl(228 38% 9%)");
      bg.addColorStop(1, "hsl(228 35% 4%)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.save();
      for (let i = 0; i < 200; i++) {
        const sx = ((Math.sin(i * 137.5) + 1) / 2) * W;
        const sy = ((Math.cos(i * 97.3) + 1) / 2) * H;
        const size = (Math.sin(i * 17.3) + 1) * 0.8;
        ctx.globalAlpha = 0.3 + 0.4 * Math.sin(Date.now() * 0.001 + i);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Globe body
      const globeGrad = ctx.createRadialGradient(
        cx - r * 0.3, cy - r * 0.3, r * 0.05,
        cx, cy, r
      );
      globeGrad.addColorStop(0, "hsl(210 60% 20%)");
      globeGrad.addColorStop(0.5, "hsl(220 55% 13%)");
      globeGrad.addColorStop(1, "hsl(228 50% 8%)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = globeGrad;
      ctx.fill();

      // Atmosphere glow
      const atmo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
      atmo.addColorStop(0, "rgba(0,210,255,0.08)");
      atmo.addColorStop(1, "rgba(0,210,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = atmo;
      ctx.fill();

      // Grid lines
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#00ccff";
      ctx.lineWidth = 0.5;
      for (let lat = -75; lat <= 75; lat += 15) {
        const latR = (lat * Math.PI) / 180;
        const cosLat = Math.cos(latR);
        const sinLat = Math.sin(latR);
        const ry = r * sinLat;
        const rx = r * cosLat;
        ctx.beginPath();
        ctx.ellipse(cx, cy - ry, rx, rx * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let lon = 0; lon < 360; lon += 30) {
        const lonR = ((lon + rotationRef.current) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(lonR) * Math.cos(0);
        ctx.beginPath();
        for (let lat = -90; lat <= 90; lat += 5) {
          const la = (lat * Math.PI) / 180;
          const lo = lonR;
          const visible = Math.cos(la) * Math.cos(lo);
          const x = cx + r * Math.cos(la) * Math.sin(lo);
          const y = cy - r * Math.sin(la);
          if (lat === -90) ctx.moveTo(x, y);
          else if (visible > 0) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        void x1;
        ctx.stroke();
      }
      ctx.restore();

      // Attack arcs (simplified 2D projection)
      const now = Date.now();
      arcs.slice(0, 30).forEach((arc, i) => {
        const phase = ((now * 0.0008 + i * 0.3) % 1);
        const progress = phase;

        // Convert lat/lng to canvas x/y (simplified Mercator-like)
        const project = (lat: number, lng: number) => {
          const lonR = ((lng + rotationRef.current) * Math.PI) / 180;
          const latR = (lat * Math.PI) / 180;
          const visible = Math.cos(latR) * Math.cos(lonR - Math.PI / 2);
          const x = cx + r * Math.cos(latR) * Math.sin(lonR - Math.PI / 2);
          const y = cy - r * Math.sin(latR);
          return { x, y, visible };
        };

        const start = project(arc.startLat, arc.startLng);
        const end = project(arc.endLat, arc.endLng);
        if (start.visible < 0 && end.visible < 0) return;

        const color = RISK_COLORS[arc.riskLevel] ?? "#00ffb4";

        // Draw arc as quadratic bezier
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2 - Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2) * 0.3;

        // Animated dash
        const arcLen = 80;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.setLineDash([arcLen * 0.4, arcLen * 0.6]);
        ctx.lineDashOffset = -progress * arcLen;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(midX, midY, end.x, end.y);
        ctx.stroke();

        // Dot at current position along arc
        const t = progress;
        const dotX = (1-t)*(1-t)*start.x + 2*(1-t)*t*midX + t*t*end.x;
        const dotY = (1-t)*(1-t)*start.y + 2*(1-t)*t*midY + t*t*end.y;
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Globe rim highlight
      const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      rim.addColorStop(0, "rgba(0,220,255,0.15)");
      rim.addColorStop(0.5, "rgba(0,0,0,0)");
      rim.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      rotationRef.current += 0.08;
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [arcs]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Threat Map page
// ---------------------------------------------------------------------------

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export default function ThreatMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [data, setData] = useState<GeoEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [globeReady, setGlobeReady] = useState(false);
  const [use3D, setUse3D] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const json = await customFetch<GeoEventsResponse>(`${API_BASE}/threat-map/geo-events`);
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + 30s auto-refresh
  useEffect(() => {
    void fetchData();
    timerRef.current = setInterval(() => { void fetchData(); }, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData]);

  // Container resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setDimensions({ width: e.contentRect.width, height: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const arcs = data?.arcs ?? [];
  const points = data?.points ?? [];
  const stats = data?.stats;
  const topCountries = data?.topCountries ?? [];
  const homeBase = data?.homeBase ?? { lat: 37.09, lng: -95.71 };

  // Home base ring point
  const homePoint = [{
    lat: homeBase.lat,
    lng: homeBase.lng,
    size: 0.5,
    color: "#00ffcc",
    label: "RILEY Home Base",
  }];

  return (
    <div className="-m-8 relative" style={{ height: "calc(100vh - 0px)", minHeight: 600 }}>
      {/* Full-bleed globe area */}
      <div ref={containerRef} className="absolute inset-0">
        {use3D ? (
          <Suspense fallback={<CanvasGlobe arcs={arcs} />}>
            {Globe ? (
              <Globe
                width={dimensions.width}
                height={dimensions.height}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                backgroundColor="rgba(0,0,0,0)"
                atmosphereColor="rgba(0,200,255,0.15)"
                atmosphereAltitude={0.18}
                // Arcs — animated attack lines
                arcsData={arcs}
                arcStartLat={(d) => (d as GeoArc).startLat}
                arcStartLng={(d) => (d as GeoArc).startLng}
                arcEndLat={(d) => (d as GeoArc).endLat}
                arcEndLng={(d) => (d as GeoArc).endLng}
                arcColor={(d) => (d as GeoArc).color}
                arcAltitudeAutoScale={0.4}
                arcDashLength={0.4}
                arcDashGap={0.2}
                arcDashAnimateTime={2000}
                arcStroke={0.5}
                arcLabel={(d) => (d as GeoArc).label}
                // Source points — glowing dots at threat origins
                pointsData={[...points, ...homePoint]}
                pointLat={(d) => (d as GeoPoint).lat}
                pointLng={(d) => (d as GeoPoint).lng}
                pointAltitude={0.01}
                pointRadius={(d) => (d as GeoPoint).size ?? 0.3}
                pointColor={(d) => (d as GeoPoint).color ?? "#00ffcc"}
                pointLabel={(d) => (d as GeoPoint).label ?? ""}
                pointsMerge={false}
                // Auto-rotate
                enablePointerInteraction
                onGlobeReady={() => setGlobeReady(true)}
              />
            ) : (
              <CanvasGlobe arcs={arcs} />
            )}
          </Suspense>
        ) : (
          <CanvasGlobe arcs={arcs} />
        )}
      </div>

      {/* ── Top bar ── */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        {/* Title */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border"
          style={{
            background: "hsl(228 38% 7% / 0.85)",
            backdropFilter: "blur(12px)",
          }}
        >
          <GlobeIcon className="w-5 h-5 text-primary" style={{ filter: "drop-shadow(0 0 6px hsl(172,100%,42%))" }} />
          <div>
            <h1 className="font-mono text-sm font-bold text-foreground tracking-wider">THREAT GLOBE</h1>
            <p className="font-mono text-[10px] text-muted-foreground">LIVE ATTACK ORIGIN MAP</p>
          </div>
          <div className="ml-2 flex items-center gap-1.5">
            {error ? (
              <><WifiOff className="w-3 h-3 text-red-400" /><span className="font-mono text-[10px] text-red-400">OFFLINE</span></>
            ) : (
              <><Wifi className="w-3 h-3 text-primary" /><span className="font-mono text-[10px] text-primary">LIVE</span></>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUse3D(v => !v)}
            className="px-3 py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: "hsl(228 38% 7% / 0.85)", backdropFilter: "blur(12px)" }}
          >
            {use3D ? "2D" : "3D"}
          </button>
          <button
            onClick={() => { setLoading(true); void fetchData(); }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            style={{ background: "hsl(228 38% 7% / 0.85)", backdropFilter: "blur(12px)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Stats panel (left) ── */}
      <div
        className="absolute top-20 left-4 z-20 w-52 rounded-xl border border-border p-4 space-y-4"
        style={{
          background: "hsl(228 38% 7% / 0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Threat Statistics</p>

        {loading && !data ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] text-muted-foreground">Total Scans</span>
              <span className="font-mono text-sm font-bold text-foreground">{stats.totalScans}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] text-muted-foreground">Countries</span>
              <span className="font-mono text-sm font-bold text-foreground">{stats.uniqueCountries}</span>
            </div>
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] text-red-400">Critical</span>
              <span className="font-mono text-sm font-bold text-red-400">{stats.criticalCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] text-orange-400">High</span>
              <span className="font-mono text-sm font-bold text-orange-400">{stats.highCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] text-yellow-400">Medium</span>
              <span className="font-mono text-sm font-bold text-yellow-400">{stats.mediumCount}</span>
            </div>
          </div>
        ) : null}

        <div className="h-px bg-border" />

        {/* Risk legend */}
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Arc Legend</p>
          {(["critical", "high", "medium", "low"] as const).map(r => (
            <div key={r} className="flex items-center gap-2">
              <div
                className="w-6 h-0.5 rounded-full"
                style={{ backgroundColor: RISK_COLORS[r], boxShadow: `0 0 4px ${RISK_COLORS[r]}` }}
              />
              <span className="font-mono text-[10px] text-muted-foreground capitalize">{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top threat origins (right) ── */}
      <div
        className="absolute top-20 right-4 z-20 w-56 rounded-xl border border-border p-4 space-y-3"
        style={{
          background: "hsl(228 38% 7% / 0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Top Origins</p>
        {topCountries.length === 0 ? (
          <p className="font-mono text-[11px] text-muted-foreground">No data yet — run recon scans to populate the map.</p>
        ) : (
          <div className="space-y-2">
            {topCountries.map((c, i) => (
              <div key={c.country} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <span
                  className="font-mono text-xs font-bold w-6"
                  style={{ color: RISK_COLORS[c.maxRisk] ?? "#00ffb4" }}
                >
                  {c.country}
                </span>
                <div className="flex-1 h-1 rounded-full bg-secondary/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (c.count / (topCountries[0]?.count ?? 1)) * 100)}%`,
                      backgroundColor: RISK_COLORS[c.maxRisk] ?? "#00ffb4",
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground w-4 text-right">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent attacks feed (bottom) ── */}
      <div
        className="absolute bottom-4 left-4 right-4 z-20 rounded-xl border border-border p-4"
        style={{
          background: "hsl(228 38% 7% / 0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Recent Attack Arcs</p>
          <span className="font-mono text-[10px] text-muted-foreground">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        </div>

        {arcs.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-mono text-xs">
              No geo-tagged threats found. Run recon scans on IPs or domains to populate the globe.
            </span>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
            {arcs.slice(0, 12).map((arc, i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-lg border border-border px-3 py-2 space-y-1 min-w-[160px]"
                style={{ borderLeftColor: RISK_COLORS[arc.riskLevel] ?? "#00ffb4", borderLeftWidth: 2 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground truncate max-w-[100px]">{arc.target}</span>
                  <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase ${riskBadgeClass(arc.riskLevel)}`}>
                    {arc.riskLevel}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">{arc.targetType} · {timeAgo(arc.createdAt)}</p>
                {arc.riskScore !== null && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-0.5 rounded-full bg-secondary/30">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${arc.riskScore}%`,
                          backgroundColor: RISK_COLORS[arc.riskLevel] ?? "#00ffb4",
                        }}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-muted-foreground">{Math.round(arc.riskScore)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Globe ready indicator */}
      {use3D && !globeReady && data && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div
            className="px-6 py-3 rounded-xl border border-border font-mono text-sm text-muted-foreground"
            style={{ background: "hsl(228 38% 7% / 0.9)", backdropFilter: "blur(12px)" }}
          >
            <span className="animate-pulse">Initializing 3D Globe…</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg border border-red-600/40 font-mono text-xs text-red-400"
          style={{ background: "hsl(0 30% 10% / 0.9)", backdropFilter: "blur(8px)" }}
        >
          API error: {error}
        </div>
      )}
    </div>
  );
}
