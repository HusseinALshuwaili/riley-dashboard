import { useState } from "react";
import { useSimulateAlerts, getListAlertsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Play, Loader2, AlertTriangle } from "lucide-react";

export default function Simulate() {
  const [count, setCount] = useState<number[]>([5]);
  const simulate = useSimulateAlerts();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSimulate = () => {
    simulate.mutate(
      { data: { count: count[0] } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({
            title: "Simulation Complete",
            description: `Successfully injected ${data.length} new alerts into the SIEM.`,
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Simulation Failed",
            description: "An error occurred while generating alerts.",
          });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">
          SIMULATION ENGINE
        </h1>
        <p className="text-muted-foreground font-mono mt-2 text-sm">
          INJECT SYNTHETIC THREAT DATA FOR LIVE DEMONSTRATION
        </p>
      </div>

      <Card
        className="border-border"
        style={{
          borderTop: "2px solid hsl(172, 100%, 42%)",
          boxShadow: "0 0 40px hsl(172 100% 42% / 0.05), 0 4px 24px rgba(0,0,0,0.5)",
        }}
      >
        <CardHeader className="border-b border-border pb-5">
          <CardTitle className="font-mono text-lg flex items-center gap-2">
            <div
              className="p-1.5 rounded-md"
              style={{ background: "hsl(172 100% 42% / 0.12)" }}
            >
              <Play className="w-4 h-4 text-primary" />
            </div>
            TRAFFIC INJECTION
          </CardTitle>
          <CardDescription className="font-mono text-muted-foreground text-sm">
            Generate synthetic alerts imitating attacks across various vectors (brute force, SQLi, malware beacons).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">

          {/* Payload Volume */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="font-mono text-sm text-foreground tracking-wider">PAYLOAD VOLUME</label>
              <span
                className="font-mono text-xl font-bold"
                style={{ color: "hsl(172, 100%, 48%)", textShadow: "0 0 10px hsl(172 100% 44% / 0.4)" }}
              >
                {count[0]} ALERTS
              </span>
            </div>
            <Slider
              value={count}
              onValueChange={setCount}
              min={1}
              max={20}
              step={1}
              className="py-4"
            />
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>1</span>
              <span>10</span>
              <span>20</span>
            </div>
          </div>

          {/* Warning */}
          <div
            className="p-4 border rounded-lg flex items-start gap-4"
            style={{
              borderColor: "hsl(25, 90%, 55% / 0.4)",
              background: "hsl(25, 90%, 55% / 0.05)",
            }}
          >
            <AlertTriangle className="text-orange-400 shrink-0 mt-0.5 h-5 w-5" />
            <div className="font-mono text-sm text-muted-foreground">
              <p className="text-orange-400 mb-1 font-medium tracking-wider">WARNING: LIVE ENVIRONMENT</p>
              Injected alerts will be processed by RILEY's triage engine immediately. This will affect dashboard metrics and trigger automation workflows.
            </div>
          </div>

          {/* Execute */}
          <Button
            className="w-full font-mono py-6 text-base tracking-widest transition-all"
            onClick={handleSimulate}
            disabled={simulate.isPending}
            style={{
              background: simulate.isPending
                ? "hsl(172, 60%, 25%)"
                : "linear-gradient(135deg, hsl(172, 100%, 32%) 0%, hsl(172, 100%, 44%) 100%)",
              color: "#000",
              boxShadow: simulate.isPending
                ? "none"
                : "0 0 24px hsl(172 100% 42% / 0.3)",
            }}
          >
            {simulate.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Play className="w-5 h-5 mr-2" fill="currentColor" />
            )}
            {simulate.isPending ? "INJECTING PAYLOAD..." : "EXECUTE INJECTION"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
