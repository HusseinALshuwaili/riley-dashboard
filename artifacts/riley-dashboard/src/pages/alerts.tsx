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

const SEV = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.35)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.35)" },
  medium:   { color: "#eab308", bg: "rgba(234,179,8,0.1)",  border: "rgba(234,179,8,0.3)" },
  low:      { color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)" },
} as const;

function severityBadgeClass(sev: string) {
  const cfg = SEV[sev as keyof typeof SEV] ?? SEV.low;
  return `border text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded`;
}

function SevBadgeStyle(sev: string): React.CSSProperties {
  const cfg = SEV[sev as keyof typeof SEV] ?? SEV.low;
  return { color: cfg.color, background: cfg.bg, borderColor: cfg.border };
}

/** Left border glow color per severity — CyFocus style */
function severityBorderStyle(sev: string): React.CSSProperties {
  const cfg = SEV[sev as keyof typeof SEV] ?? SEV.low;
  return {
    borderLeft: `3px solid ${cfg.color}`,
    boxShadow: `inset 3px 0 16px ${cfg.bg}`,
  };
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
          <h1 className="text-2xl font-mono font-black tracking-[0.15em] text-foreground uppercase">
            ALERT QUEUE
          </h1>
          <p className="text-[11px] font-mono text-muted-foreground/50 mt-1 tracking-widest uppercase">
            TRIAGE PENDING SECURITY EVENTS
          </p>
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
              className="border transition-all duration-200 overflow-hidden"
              style={{
                ...severityBorderStyle(alert.severity),
                background: "rgba(9,11,18,0.85)",
                borderColor: "rgba(255,255,255,0.07)",
              }}
            >
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row lg:items-stretch">

                  {/* Left — alert info */}
                  <div className="flex-1 p-5 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={severityBadgeClass(alert.severity)}
                        style={SevBadgeStyle(alert.severity)}
                      >
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
                    className="lg:w-56 border-t lg:border-t-0 lg:border-l p-5 flex flex-col justify-center gap-4"
                    style={{ background: "rgba(132,0,255,0.04)", borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono text-muted-foreground/50 mb-1 tracking-widest uppercase">
                        AI CONFIDENCE
                      </span>
                      <div
                        className="text-2xl font-mono font-black"
                        style={{
                          color: alert.confidence > 0.8 ? "#ef4444" : alert.confidence > 0.5 ? "#f97316" : "#22c55e",
                          textShadow: `0 0 16px currentColor`,
                        }}
                      >
                        {(alert.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    {alert.status === "pending" ? (
                      <div className="space-y-2">
                        <button
                          className="w-full font-mono text-[10px] tracking-widest py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-2"
                          style={{
                            borderColor: "rgba(239,68,68,0.35)",
                            color: "#ef4444",
                            background: "rgba(239,68,68,0.08)",
                          }}
                          onClick={() => handleTriage(alert.id, "true_positive")}
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Check className="h-3.5 w-3.5" />
                          }
                          TRUE POSITIVE
                        </button>
                        <button
                          className="w-full font-mono text-[10px] tracking-widest py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-2"
                          style={{
                            borderColor: "rgba(34,197,94,0.3)",
                            color: "#22c55e",
                            background: "rgba(34,197,94,0.06)",
                          }}
                          onClick={() => handleTriage(alert.id, "false_positive")}
                          disabled={updateStatus.isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                          FALSE POSITIVE
                        </button>
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
