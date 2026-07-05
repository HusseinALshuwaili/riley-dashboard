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
        }
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">SIMULATION ENGINE</h1>
        <p className="text-muted-foreground font-mono mt-2">INJECT SYNTHETIC THREAT DATA FOR LIVE DEMONSTRATION</p>
      </div>

      <Card className="bg-card border-border rounded-none border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="font-mono text-lg">TRAFFIC INJECTION</CardTitle>
          <CardDescription className="font-mono text-muted-foreground">
            Generate synthetic alerts imitating attacks across various vectors (brute force, SQLi, malware beacons).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="font-mono text-sm text-foreground">PAYLOAD VOLUME</label>
              <span className="font-mono text-primary text-xl font-bold">{count[0]} ALERTS</span>
            </div>
            <Slider 
              value={count} 
              onValueChange={setCount} 
              min={1} 
              max={20} 
              step={1}
              className="py-4"
            />
          </div>

          <div className="bg-secondary/50 p-4 border border-border flex items-start gap-4">
            <AlertTriangle className="text-orange-500 shrink-0 mt-1" />
            <div className="font-mono text-sm text-muted-foreground">
              <p className="text-foreground mb-1">WARNING: LIVE ENVIRONMENT</p>
              Injected alerts will be processed by RILEY's triage engine immediately. This will affect dashboard metrics and trigger automation workflows.
            </div>
          </div>

          <Button 
            className="w-full rounded-none font-mono py-6 text-lg tracking-widest bg-primary text-black hover:bg-primary/90"
            onClick={handleSimulate}
            disabled={simulate.isPending}
          >
            {simulate.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
            ) : (
              <Play className="w-6 h-6 mr-2" fill="currentColor" />
            )}
            {simulate.isPending ? "INJECTING PAYLOAD..." : "EXECUTE INJECTION"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}