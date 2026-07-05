import { useState } from "react";
import { useListAlerts, useUpdateAlertStatus, getListAlertsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Shield, ShieldAlert, ShieldBan, ShieldCheck, Check, X, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
            description: `Status updated to ${newStatus.replace('_', ' ').toUpperCase()}`,
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to triage alert.",
          });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">ALERT QUEUE</h1>
          <p className="text-muted-foreground font-mono mt-2">TRIAGE PENDING SECURITY EVENTS</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="SEARCH ALERTS..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 font-mono bg-background border-border rounded-none focus-visible:ring-primary"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-48 font-mono bg-background border-border rounded-none focus:ring-primary">
              <SelectValue placeholder="FILTER STATUS" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-border">
              <SelectItem value="all">ALL STATUSES</SelectItem>
              <SelectItem value="pending">PENDING</SelectItem>
              <SelectItem value="true_positive">TRUE POSITIVE</SelectItem>
              <SelectItem value="false_positive">FALSE POSITIVE</SelectItem>
              <SelectItem value="resolved">RESOLVED</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse border border-border"></div>)}
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <Card className="bg-card border-border rounded-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-mono tracking-widest uppercase">QUEUE EMPTY</p>
            <p className="text-sm mt-2 opacity-50">NO ALERTS MATCHING CRITERIA</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map(alert => (
            <Card key={alert.id} className="bg-card border-border rounded-none group hover:border-primary/50 transition-colors">
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row lg:items-center">
                  
                  {/* Left info */}
                  <div className="flex-1 p-6 space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-mono px-2 py-0.5 border ${
                        alert.severity === 'critical' ? 'border-destructive text-destructive bg-destructive/10' :
                        alert.severity === 'high' ? 'border-orange-500 text-orange-500 bg-orange-500/10' :
                        alert.severity === 'medium' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                        'border-primary text-primary bg-primary/10'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="font-mono text-muted-foreground text-sm">{alert.alertId}</span>
                      <span className="font-mono text-xs text-muted-foreground/60">{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-foreground">{alert.title}</h3>
                      <p className="text-muted-foreground mt-1">{alert.description}</p>
                    </div>

                    <div className="flex items-center gap-6 text-sm font-mono flex-wrap">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground/60 text-xs">SOURCE</span>
                        <span className="text-foreground">{alert.source}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground/60 text-xs">ASSET</span>
                        <span className="text-foreground">{alert.assetName}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground/60 text-xs">TACTIC</span>
                        <span className="text-foreground">{alert.mitreTactic || 'UNASSIGNED'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="lg:w-64 bg-background/50 border-t lg:border-t-0 lg:border-l border-border p-6 flex flex-col justify-center h-full gap-4">
                    <div className="flex flex-col items-center mb-2">
                      <span className="text-xs font-mono text-muted-foreground/60 mb-1">AI CONFIDENCE</span>
                      <div className="text-2xl font-mono text-primary">{(alert.confidence * 100).toFixed(0)}%</div>
                    </div>

                    {alert.status === 'pending' ? (
                      <div className="space-y-2">
                        <Button 
                          variant="outline" 
                          className="w-full font-mono rounded-none border-primary/50 text-primary hover:bg-primary hover:text-black"
                          onClick={() => handleTriage(alert.id, 'true_positive')}
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                          TRUE POSITIVE
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full font-mono rounded-none border-destructive/50 text-destructive hover:bg-destructive hover:text-black"
                          onClick={() => handleTriage(alert.id, 'false_positive')}
                          disabled={updateStatus.isPending}
                        >
                          <X className="h-4 w-4 mr-2" />
                          FALSE POSITIVE
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center font-mono py-4 text-muted-foreground border border-border bg-card/50">
                        {alert.status.replace('_', ' ').toUpperCase()}
                      </div>
                    )}
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