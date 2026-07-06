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
        },
      }
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">
          BUG SCANNER
        </h1>
        <p className="text-muted-foreground font-mono mt-2 text-sm">ADVERSARIAL VULNERABILITY PIPELINE</p>
        <p className="font-mono text-xs mt-2 tracking-wider" style={{ color: "hsl(172, 100%, 48%)" }}>
          POWERED BY GROQ · LLAMA 3.3 70B · 3-AGENT ADVERSARIAL PIPELINE
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left Column: Scan Setup ── */}
        <div className="xl:col-span-1 space-y-5">

          {/* New Analysis */}
          <Card
            className="border-border"
            style={{ borderTop: "2px solid hsl(172, 100%, 42%)" }}
          >
            <CardHeader
              className="border-b border-border pb-4"
              style={{ background: "hsl(228 35% 7% / 0.8)" }}
            >
              <CardTitle className="font-mono text-base flex items-center gap-2">
                <div className="p-1.5 rounded-md" style={{ background: "hsl(172 100% 42% / 0.12)" }}>
                  <Terminal className="w-4 h-4 text-primary" />
                </div>
                NEW ANALYSIS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">

              {/* Language */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Target Language
                </label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="font-mono bg-secondary/50 border-border focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border">
                    <SelectItem value="typescript">TypeScript / JS</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                    <SelectItem value="rust">Rust</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mode tabs */}
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-secondary h-11 p-1 rounded-lg">
                  <TabsTrigger
                    value="code"
                    className="font-mono text-xs rounded-md data-[state=active]:bg-primary data-[state=active]:text-black"
                  >
                    <Code2 className="w-3.5 h-3.5 mr-1.5" /> PASTE CODE
                  </TabsTrigger>
                  <TabsTrigger
                    value="github"
                    className="font-mono text-xs rounded-md data-[state=active]:bg-primary data-[state=active]:text-black"
                  >
                    <GitBranch className="w-3.5 h-3.5 mr-1.5" /> REPO URL
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="code" className="pt-3">
                  <Textarea
                    placeholder="Paste source code here..."
                    className="min-h-[200px] font-mono text-xs bg-secondary/50 border-border focus-visible:ring-primary"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                  />
                </TabsContent>
                <TabsContent value="github" className="pt-3">
                  <Input
                    placeholder="https://github.com/user/repo"
                    className="font-mono bg-secondary/50 border-border focus-visible:ring-primary"
                    value={githubUrl}
                    onChange={e => setGithubUrl(e.target.value)}
                  />
                </TabsContent>
              </Tabs>

              {/* Scan button */}
              <Button
                className="w-full font-mono tracking-widest h-11 transition-all"
                onClick={handleScan}
                disabled={scan.isPending}
                style={{
                  background: scan.isPending
                    ? "hsl(172, 60%, 25%)"
                    : "linear-gradient(135deg, hsl(172, 100%, 30%) 0%, hsl(172, 100%, 44%) 100%)",
                  color: "#000",
                  boxShadow: scan.isPending ? "none" : "0 0 20px hsl(172 100% 42% / 0.25)",
                }}
              >
                {scan.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  : <Shield className="w-4 h-4 mr-2" />
                }
                {scan.isPending ? "ANALYZING..." : "INITIALIZE SCAN"}
              </Button>
            </CardContent>
          </Card>

          {/* Scan History */}
          <Card className="border-border">
            <CardHeader
              className="border-b border-border pb-3"
              style={{ background: "hsl(228 35% 7% / 0.8)" }}
            >
              <CardTitle className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                SCAN HISTORY
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-6 text-center text-muted-foreground animate-pulse font-mono text-sm">LOADING...</div>
              ) : history && history.length > 0 ? (
                <div className="divide-y divide-border">
                  {history.map(h => (
                    <div
                      key={h.id}
                      className="p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors"
                    >
                      <div>
                        <div className="font-mono text-sm text-foreground">Scan #{h.id}</div>
                        <div className="font-mono text-xs text-muted-foreground mt-0.5">
                          {h.language.toUpperCase()} · {new Date(h.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <div className={h.confirmedCount > 0 ? "text-destructive font-bold" : "text-primary"}>
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

        {/* ── Right Column: Results ── */}
        <div className="xl:col-span-2 space-y-5">
          {!scan.data && !scan.isPending ? (
            <Card
              className="border-border border-dashed h-full min-h-[500px] flex items-center justify-center"
              style={{ borderStyle: "dashed" }}
            >
              <div className="text-center text-muted-foreground">
                <div
                  className="p-5 rounded-full mx-auto mb-4 w-fit"
                  style={{ background: "hsl(172 100% 42% / 0.06)" }}
                >
                  <Bug className="w-12 h-12 opacity-25" style={{ color: "hsl(172, 100%, 46%)" }} />
                </div>
                <p className="font-mono tracking-widest text-sm">AWAITING TARGET</p>
                <p className="text-xs mt-1 opacity-50">Paste code or enter a GitHub URL to begin</p>
              </div>
            </Card>
          ) : scan.isPending ? (
            <Card className="border-border h-full min-h-[500px]">
              <CardContent className="flex flex-col items-center justify-center h-full space-y-8 pt-16">
                <div
                  className="p-5 rounded-full"
                  style={{
                    background: "hsl(172 100% 42% / 0.08)",
                    boxShadow: "0 0 40px hsl(172 100% 42% / 0.15)",
                  }}
                >
                  <Loader2
                    className="w-12 h-12 animate-spin"
                    style={{ color: "hsl(172, 100%, 48%)" }}
                  />
                </div>
                <div className="font-mono space-y-3 text-center">
                  <p className="animate-pulse text-primary text-sm tracking-wider">
                    1. ANALYZER AGENT READING SOURCE...
                  </p>
                  <p className="animate-pulse text-muted-foreground/60 text-xs tracking-wider" style={{ animationDelay: "0.15s" }}>
                    2. DETECTOR AGENT HUNTING VULNERABILITIES...
                  </p>
                  <p className="animate-pulse text-muted-foreground/40 text-xs tracking-wider" style={{ animationDelay: "0.3s" }}>
                    3. DEBUNKER AGENT VERIFYING FINDINGS...
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : scan.data && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Summary banner */}
              <div
                className={`p-5 border rounded-xl flex items-center gap-4 ${
                  scan.data.confirmedFindings.length > 0
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-primary/40 bg-primary/5 text-primary"
                }`}
              >
                {scan.data.confirmedFindings.length > 0
                  ? <ShieldAlert className="w-8 h-8 shrink-0" />
                  : <CheckCircle className="w-8 h-8 shrink-0" />
                }
                <div>
                  <h3 className="text-lg font-mono font-bold tracking-tight">
                    {scan.data.confirmedFindings.length} CONFIRMED VULNERABILITIES
                  </h3>
                  <p className="text-sm font-mono opacity-75 mt-0.5">
                    {scan.data.debunkedCount} findings identified as false positives and debunked.
                  </p>
                </div>
              </div>

              {/* Analyzer Notes */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                    ANALYZER NOTES
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-sm text-foreground leading-relaxed">
                    {scan.data.analyzerNotes}
                  </p>
                </CardContent>
              </Card>

              {/* Confirmed Findings */}
              {scan.data.confirmedFindings.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-wider pt-2">
                    CONFIRMED THREATS
                  </h3>
                  {scan.data.confirmedFindings.map(finding => (
                    <Card
                      key={finding.id}
                      className="border-destructive/30 overflow-hidden"
                      style={{ borderTop: "2px solid hsl(350, 88%, 56%)" }}
                    >
                      <CardContent className="p-5 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0">
                            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                              <Bug
                                className="w-4 h-4 shrink-0"
                                style={{ color: "hsl(350, 88%, 58%)" }}
                              />
                              {finding.title}
                            </h4>
                            <p className="text-muted-foreground mt-2 text-sm">{finding.description}</p>
                          </div>
                          <span className="text-xs font-mono px-2 py-1 border border-destructive/50 text-destructive bg-destructive/10 uppercase tracking-wider rounded-md shrink-0">
                            {finding.severity}
                          </span>
                        </div>

                        <div
                          className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border"
                        >
                          <div>
                            <span className="text-xs font-mono text-muted-foreground/60 uppercase tracking-wider block mb-1">
                              LOCATION
                            </span>
                            <span className="font-mono text-sm text-foreground bg-secondary px-2 py-1 rounded-md inline-block">
                              Line {finding.line || "Unknown"}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-mono text-muted-foreground/60 uppercase tracking-wider block mb-1">
                              RECOMMENDATION
                            </span>
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
