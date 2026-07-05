import { useListPatterns } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Activity } from "lucide-react";

export default function Patterns() {
  const { data: patterns, isLoading } = useListPatterns();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">ATTACK PATTERNS</h1>
        <p className="text-muted-foreground font-mono mt-2">CLUSTERED ALERT CAMPAIGNS DETECTED BY RILEY</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-muted/20 animate-pulse border border-border"></div>)}
        </div>
      ) : !patterns || patterns.length === 0 ? (
        <Card className="bg-card border-border rounded-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Network className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-mono tracking-widest uppercase">NO PATTERNS DETECTED</p>
            <p className="text-sm mt-2 opacity-50">NO CORRELATED CAMPAIGNS IN RECENT DATA</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {patterns.map(pattern => (
            <Card key={pattern.id} className="bg-card border-border rounded-none hover:border-primary/30 transition-colors">
              <CardHeader className="border-b border-border bg-background/50 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-mono font-bold text-foreground">{pattern.name}</CardTitle>
                    <p className="text-sm font-mono text-primary mt-1">{pattern.mitreTactic}</p>
                  </div>
                  <span className={`text-xs font-mono px-2 py-0.5 border ${
                    pattern.severity === 'critical' ? 'border-destructive text-destructive bg-destructive/10' :
                    pattern.severity === 'high' ? 'border-orange-500 text-orange-500 bg-orange-500/10' :
                    pattern.severity === 'medium' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                    'border-primary text-primary bg-primary/10'
                  }`}>
                    {pattern.severity.toUpperCase()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <p className="text-muted-foreground">{pattern.description}</p>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border border-dashed">
                  <div>
                    <span className="text-xs font-mono text-muted-foreground/60 block mb-1">CORRELATED ALERTS</span>
                    <div className="flex items-center gap-2 text-foreground font-mono text-xl">
                      <Activity className="w-5 h-5 text-primary" />
                      {pattern.alertCount}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-mono text-muted-foreground/60 block mb-1">LIFESPAN</span>
                    <div className="text-sm font-mono text-muted-foreground">
                      {new Date(pattern.firstSeen).toLocaleDateString()} - <br/>
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