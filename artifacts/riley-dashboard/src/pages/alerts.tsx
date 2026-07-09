import { useState } from "react";
import { useListAlerts, useUpdateAlertStatus, getListAlertsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Check, X, Search, Loader2, Microscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function severityBadgeClass(sev: string) {
  switch (sev) {
    case "critical": return "border-destructive text-destructive bg-destructive/10";
    case "high":     return "border-orange-500 text-orange-400 bg-orange-500/10";
    case "medium":   return "border-yellow-500 text-yellow-400 bg-yellow-500/10";
    default:         return "border-primary text-primary bg-primary/10";
  }
}

/** Left border glow color per severity */
function severityBorderStyle(sev: string): React.CSSProperties {
  switch (sev) {
    case "critical": return { borderLeft: "3px solid hsl(350, 88%, 56%)", boxShadow: "inset 3px 0 12px hsl(350 88% 56% / 0.08)" };
    case "high":     return { borderLeft: "3px solid hsl(25, 90%, 55%)",  boxShadow: "inset 3px 0 12px hsl(25 90% 55% / 0.07)" };
    case "medium":   return { borderLeft: "3px solid hsl(45, 95%, 55%)",  boxShadow: "inset 3px 0 10px hsl(45 95% 55% / 0.05)" };
    default:         return { borderLeft: "3px solid hsl(172, 100%, 42%)", boxShadow: "inset 3px 0 12px hsl(172 100% 42% / 0.08)" };
  }
}

export default function Alerts() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data: alerts, isLoading } = useListAlerts({
    search: search || undefined,
    status: status !== "all" ? status as any : undefined,
  });

  const updateStatus = useUpdateAlertStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleTriage = (id: number, newStatus: "true_positive" | "false_positive" | "resolved") => {
    updateStatus.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({
            title: "Alert Triaged",
            description: `Status updated to ${newStatus.replace("_", " ").toUpperCase()}`,
          });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to triage alert." });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">
            ALERT QUEUE
          </h1>
          <p className="text-muted-foreground font-mono mt-2 text-sm">TRIAGE PENDING SECURITY EVENTS</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="SEARCH ALERTS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 font-mono bg-secondary/50 border-border focus-visible:ring-primary focus-visible:border-primary/50 transition-colors"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-48 font-mono bg-secondary/50 border-border focus:ring-primary">
              <SelectValue placeholder="FILTER STATUS" />
            </SelectTrigger>
            <SelectContent className="border-border">
              <SelectItem value="all">ALL STATUSES</SelectItem>
              <SelectItem value="pending">PENDING</SelectItem>
              <SelectItem value="true_positive">TRUE POSITIVE</SelectItem>
              <SelectItem value="false_positive">FALSE POSITIVE</SelectItem>
              <SelectItem value="resolved">RESOLVED</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-secondary/30 animate-pulse border border-border rounded-xl" />
          ))}
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="p-4 rounded-full bg-secondary/50 mb-4">
              <ShieldCheck className="h-10 w-10 opacity-40" />
            </div>
            <p className="font-mono tracking-widest uppercase text-sm">QUEUE EMPTY</p>
            <p className="text-xs mt-2 opacity-50">NO ALERTS MATCHING CRITERIA</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <Card
              key={alert.id}
              className="border-border transition-all duration-200 hover:bg-card/95 overflow-hidden"
              style={severityBorderStyle(alert.severity)}
            >
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row lg:items-stretch">

                  {/* Left — alert info */}
                  <div className="flex-1 p-5 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-mono px-2 py-0.5 border rounded-md ${severityBadgeClass(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="font-mono text-muted-foreground text-xs">{alert.alertId}</span>
                      <span className="font-mono text-xs text-muted-foreground/50">
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-medium text-foreground">{alert.title}</h3>
                      <p className="text-muted-foreground mt-1 text-sm">{alert.description}</p>
                    </div>

                    <div className="flex items-center gap-6 text-xs font-mono flex-wrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground/60 uppercase tracking-wider">Source</span>
                        <span className="text-foreground">{alert.source}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground/60 uppercase tracking-wider">Asset</span>
                        <span className="text-foreground">{alert.assetName}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground/60 uppercase tracking-wider">Tactic</span>
                        <span className="text-foreground">{alert.mitreTactic || "UNASSIGNED"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right — triage panel */}
                  <div
                    className="lg:w-60 border-t lg:border-t-0 lg:border-l border-border p-5 flex flex-col justify-center gap-4"
                    style={{ background: "hsl(228 35% 6% / 0.6)" }}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-mono text-muted-foreground/60 mb-1 tracking-wider">
                        AI CONFIDENCE
                      </span>
                      <div
                        className="text-2xl font-mono font-bold"
                        style={{ color: "hsl(172, 100%, 48%)", textShadow: "0 0 12px hsl(172 100% 44% / 0.4)" }}
                      >
                        {(alert.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    {alert.status === "pending" ? (
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full font-mono text-xs border-primary/40 text-primary hover:bg-primary hover:text-black transition-all"
                          onClick={() => handleTriage(alert.id, "true_positive")}
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Check className="h-4 w-4 mr-2" />
                          }
                          TRUE POSITIVE
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive hover:text-white transition-all"
                          onClick={() => handleTriage(alert.id, "false_positive")}
                          disabled={updateStatus.isPending}
                        >
                          <X className="h-4 w-4 mr-2" />
                          FALSE POSITIVE
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center font-mono py-3 text-muted-foreground text-xs border border-border rounded-lg bg-secondary/30 tracking-widest">
                        {alert.status.replace("_", " ").toUpperCase()}
                      </div>
                    )}
                    <Link href={`/investigate/${alert.id}`}>
                      <Button
                        variant="ghost"
                        className="w-full font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all border border-border/50"
                      >
                        <Microscope className="h-3.5 w-3.5 mr-2" />
                        DEEP INVESTIGATE
                      </Button>
                    </Link>
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
