import { useListPatterns } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Activity } from "lucide-react";

function severityBadgeClass(sev: string) {
  switch (sev) {
    case "critical": return "border-destructive text-destructive bg-destructive/10";
    case "high":     return "border-orange-500 text-orange-400 bg-orange-500/10";
    case "medium":   return "border-yellow-500 text-yellow-400 bg-yellow-500/10";
    default:         return "border-primary text-primary bg-primary/10";
  }
}

function severityTopBorder(sev: string): React.CSSProperties {
  switch (sev) {
    case "critical": return { borderTop: "2px solid hsl(350, 88%, 56%)" };
    case "high":     return { borderTop: "2px solid hsl(25, 90%, 55%)" };
    case "medium":   return { borderTop: "2px solid hsl(45, 95%, 55%)" };
    default:         return { borderTop: "2px solid hsl(172, 100%, 42%)" };
  }
}

export default function Patterns() {
  const { data: patterns, isLoading } = useListPatterns();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">
          ATTACK PATTERNS
        </h1>
        <p className="text-muted-foreground font-mono mt-2 text-sm">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {patterns.map(pattern => (
            <Card
              key={pattern.id}
              className="border-border card-glow-hover overflow-hidden"
              style={severityTopBorder(pattern.severity)}
            >
              {/* Header */}
              <CardHeader
                className="border-b border-border pb-4"
                style={{ background: "hsl(228 32% 7% / 0.8)" }}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-mono font-bold text-foreground truncate">
                      {pattern.name}
                    </CardTitle>
                    <p className="text-xs font-mono text-primary mt-1 truncate">{pattern.mitreTactic}</p>
                  </div>
                  <span className={`text-xs font-mono px-2 py-0.5 border rounded-md shrink-0 ${severityBadgeClass(pattern.severity)}`}>
                    {pattern.severity.toUpperCase()}
                  </span>
                </div>
              </CardHeader>

              {/* Body */}
              <CardContent className="p-5 space-y-5">
                <p className="text-muted-foreground text-sm leading-relaxed">{pattern.description}</p>

                <div
                  className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <div>
                    <span className="text-xs font-mono text-muted-foreground/60 block mb-1.5 tracking-wider uppercase">
                      Correlated Alerts
                    </span>
                    <div className="flex items-center gap-2 font-mono text-xl font-bold text-foreground">
                      <Activity
                        className="w-4 h-4 text-primary"
                        style={{ filter: "drop-shadow(0 0 4px hsl(172, 100%, 42%))" }}
                      />
                      {pattern.alertCount}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-mono text-muted-foreground/60 block mb-1.5 tracking-wider uppercase">
                      Lifespan
                    </span>
                    <div className="text-xs font-mono text-muted-foreground leading-relaxed">
                      {new Date(pattern.firstSeen).toLocaleDateString()}
                      <span className="text-border mx-1">→</span>
                      {new Date(pattern.lastSeen).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
