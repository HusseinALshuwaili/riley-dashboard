import { useListPatterns } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Activity } from "lucide-react";

const SEV = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.35)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.35)" },
  medium:   { color: "#eab308", bg: "rgba(234,179,8,0.1)",  border: "rgba(234,179,8,0.3)" },
  low:      { color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)" },
} as const;

type SevKey = keyof typeof SEV;

function severityBadgeStyle(sev: string): React.CSSProperties {
  const cfg = SEV[sev as SevKey] ?? SEV.low;
  return { color: cfg.color, background: cfg.bg, borderColor: cfg.border };
}

function severityTopBorder(sev: string): React.CSSProperties {
  const cfg = SEV[sev as SevKey] ?? SEV.low;
  return {
    borderTop: `2px solid ${cfg.color}`,
    background: "rgba(9,11,18,0.85)",
    boxShadow: `0 -1px 20px ${cfg.bg}`,
  };
}

export default function Patterns() {
  const { data: patterns, isLoading } = useListPatterns();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-mono font-black tracking-[0.15em] text-foreground uppercase">
          ATTACK PATTERNS
        </h1>
        <p className="text-[11px] font-mono text-muted-foreground/50 mt-1 tracking-widest uppercase">
          CLUSTERED ALERT CAMPAIGNS DETECTED BY RILEY
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-secondary/30 animate-pulse border border-border rounded-xl" />
          ))}
        </div>
      ) : !patterns || patterns.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="p-4 rounded-full bg-secondary/50 mb-4">
              <Network className="h-10 w-10 opacity-40" />
            </div>
            <p className="font-mono tracking-widest uppercase text-sm">NO PATTERNS DETECTED</p>
            <p className="text-xs mt-2 opacity-50">NO CORRELATED CAMPAIGNS IN RECENT DATA</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patterns.map(pattern => {
            const cfg = SEV[pattern.severity as SevKey] ?? SEV.low;
            return (
            <div
              key={pattern.id}
              className="rounded-xl border card-glow-hover overflow-hidden"
              style={severityTopBorder(pattern.severity)}
            >
              {/* Header */}
              <div
                className="px-5 py-4 border-b"
                style={{
                  background: `${cfg.bg}`,
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-mono font-bold text-foreground truncate">{pattern.name}</h3>
                    <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: cfg.color }}>
                      {pattern.mitreTactic}
                    </p>
                  </div>
                  <span
                    className="text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border shrink-0"
                    style={severityBadgeStyle(pattern.severity)}
                  >
                    {pattern.severity.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <p className="text-muted-foreground/70 text-xs leading-relaxed">{pattern.description}</p>

                <div
                  className="grid grid-cols-2 gap-4 pt-4 border-t"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <div>
                    <span className="text-[9px] font-mono text-muted-foreground/40 block mb-1 tracking-widest uppercase">
                      Correlated Alerts
                    </span>
                    <div className="flex items-center gap-2 font-mono text-2xl font-black" style={{ color: cfg.color }}>
                      <Activity className="w-4 h-4 shrink-0" />
                      {pattern.alertCount}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-muted-foreground/40 block mb-1 tracking-widest uppercase">
                      Active Window
                    </span>
                    <div className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed">
                      {new Date(pattern.firstSeen).toLocaleDateString()}
                      <span className="opacity-30 mx-1">→</span>
                      {new Date(pattern.lastSeen).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
