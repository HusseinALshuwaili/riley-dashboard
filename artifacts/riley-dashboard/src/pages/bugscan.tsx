import { useState } from "react";
import { useRunBugScan, useListBugScans, getListBugScansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Bug, CheckCircle, ShieldAlert, GitBranch, Terminal, Shield, Loader2, Code2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BugScan() {
  const [language, setLanguage] = useState<string>("typescript");
  const [mode, setMode] = useState<"code" | "github">("code");
  const [code, setCode] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const scan = useRunBugScan();
  const { data: history, isLoading: historyLoading } = useListBugScans();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleScan = () => {
    if (mode === "code" && !code.trim()) {
      toast({ title: "Error", description: "Please provide code to scan.", variant: "destructive" });
      return;
    }
    if (mode === "github" && !githubUrl.trim()) {
      toast({ title: "Error", description: "Please provide a GitHub URL.", variant: "destructive" });
      return;
    }

    scan.mutate(
      { data: { language, code: mode === "code" ? code : undefined, githubUrl: mode === "github" ? githubUrl : undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBugScansQueryKey() });
          toast({ title: "Scan Complete", description: "Vulnerability analysis finished." });
        },
        onError: () => {
          toast({ title: "Scan Failed", description: "An error occurred during analysis.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">BUG SCANNER</h1>
        <p className="text-muted-foreground font-mono mt-2">ADVERSARIAL VULNERABILITY PIPELINE</p>
        <p className="text-primary/70 font-mono text-xs mt-2 tracking-wider">
          POWERED BY GROQ · LLAMA 3.3 70B · 3-AGENT ADVERSARIAL PIPELINE
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column: Scan Setup */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="bg-card border-border rounded-none">
            <CardHeader className="border-b border-border bg-background/50">
              <CardTitle className="font-mono text-lg flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                NEW ANALYSIS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-mono text-muted-foreground uppercase">Target Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="font-mono bg-background border-border rounded-none focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border">
                    <SelectItem value="typescript">TypeScript / JS</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                    <SelectItem value="rust">Rust</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-none bg-secondary h-12 p-1">
                  <TabsTrigger value="code" className="rounded-none font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                    <Code2 className="w-4 h-4 mr-2" /> PASTE CODE
                  </TabsTrigger>
                  <TabsTrigger value="github" className="rounded-none font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                    <GitBranch className="w-4 h-4 mr-2" /> REPO URL
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="code" className="pt-4">
                  <Textarea 
                    placeholder="Paste source code here..." 
                    className="min-h-[200px] font-mono text-sm bg-background border-border rounded-none focus-visible:ring-primary"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                  />
                </TabsContent>
                <TabsContent value="github" className="pt-4">
                  <Input 
                    placeholder="https://github.com/user/repo" 
                    className="font-mono bg-background border-border rounded-none focus-visible:ring-primary"
                    value={githubUrl}
                    onChange={e => setGithubUrl(e.target.value)}
                  />
                </TabsContent>
              </Tabs>

              <Button 
                className="w-full rounded-none font-mono tracking-widest bg-primary text-black hover:bg-primary/90 h-12"
                onClick={handleScan}
                disabled={scan.isPending}
              >
                {scan.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Shield className="w-5 h-5 mr-2" />}
                {scan.isPending ? "ANALYZING..." : "INITIALIZE SCAN"}
              </Button>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="bg-card border-border rounded-none">
            <CardHeader className="border-b border-border bg-background/50">
              <CardTitle className="font-mono text-sm text-muted-foreground uppercase">SCAN HISTORY</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-6 text-center text-muted-foreground animate-pulse">LOADING...</div>
              ) : history && history.length > 0 ? (
                <div className="divide-y divide-border">
                  {history.map(h => (
                    <div key={h.id} className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                      <div>
                        <div className="font-mono text-sm text-foreground">Scan #{h.id}</div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">{h.language.toUpperCase()} • {new Date(h.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <div className={h.confirmedCount > 0 ? "text-destructive" : "text-primary"}>
                          {h.confirmedCount} FINDINGS
                        </div>
                        <div className="text-muted-foreground">{h.debunkedCount} DEBUNKED</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground font-mono text-sm">NO HISTORY</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Scan Results */}
        <div className="xl:col-span-2 space-y-6">
          {!scan.data && !scan.isPending ? (
            <Card className="bg-card border-border rounded-none border-dashed h-full min-h-[500px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Bug className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-mono tracking-widest">AWAITING TARGET</p>
              </div>
            </Card>
          ) : scan.isPending ? (
            <Card className="bg-card border-border rounded-none h-full min-h-[500px]">
              <CardContent className="flex flex-col items-center justify-center h-full text-primary space-y-8">
                <Loader2 className="w-16 h-16 animate-spin" />
                <div className="font-mono space-y-2 text-center">
                  <p className="animate-pulse">1. ANALYZER AGENT READING SOURCE...</p>
                  <p className="animate-pulse delay-75 text-muted-foreground">2. DETECTOR AGENT HUNTING VULNERABILITIES...</p>
                  <p className="animate-pulse delay-150 text-muted-foreground">3. DEBUNKER AGENT VERIFYING FINDINGS...</p>
                </div>
              </CardContent>
            </Card>
          ) : scan.data && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Scan Summary Banner */}
              <div className={`p-6 border flex items-center gap-4 ${
                scan.data.confirmedFindings.length > 0 
                  ? 'border-destructive bg-destructive/5 text-destructive' 
                  : 'border-primary bg-primary/5 text-primary'
              }`}>
                {scan.data.confirmedFindings.length > 0 ? <ShieldAlert className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
                <div>
                  <h3 className="text-xl font-mono font-bold tracking-tight">
                    {scan.data.confirmedFindings.length} CONFIRMED VULNERABILITIES
                  </h3>
                  <p className="text-sm font-mono opacity-80">
                    {scan.data.debunkedCount} findings were identified as false positives and debunked.
                  </p>
                </div>
              </div>

              {/* Analyzer Notes */}
              <Card className="bg-card border-border rounded-none">
                <CardHeader>
                  <CardTitle className="font-mono text-sm text-muted-foreground uppercase">ANALYZER NOTES</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-sm text-foreground leading-relaxed">
                    {scan.data.analyzerNotes}
                  </p>
                </CardContent>
              </Card>

              {/* Findings */}
              {scan.data.confirmedFindings.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-mono text-sm text-muted-foreground uppercase pt-4">CONFIRMED THREATS</h3>
                  {scan.data.confirmedFindings.map(finding => (
                    <Card key={finding.id} className="bg-card border-destructive/30 rounded-none overflow-hidden">
                      <div className="h-1 bg-destructive w-full" />
                      <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                              <Bug className="w-5 h-5 text-destructive" />
                              {finding.title}
                            </h4>
                            <p className="text-muted-foreground mt-2">{finding.description}</p>
                          </div>
                          <span className="text-xs font-mono px-2 py-1 border border-destructive text-destructive bg-destructive/10 uppercase tracking-wider">
                            {finding.severity}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                          <div>
                            <span className="text-xs font-mono text-muted-foreground uppercase block mb-1">LOCATION</span>
                            <span className="font-mono text-sm text-foreground bg-secondary px-2 py-1">
                              Line {finding.line || 'Unknown'}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-mono text-muted-foreground uppercase block mb-1">RECOMMENDATION</span>
                            <span className="text-sm text-foreground">{finding.recommendation}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}