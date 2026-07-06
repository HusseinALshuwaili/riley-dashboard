import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface ActionItem {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface RileyChatResponse {
  reply: string;
  toolCallsUsed: string[];
  actionsPerformed: ActionItem[];
  iterations: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCallsUsed?: string[];
  actionsPerformed?: ActionItem[];
  isError?: boolean;
}

interface RileyChatProps {
  currentPage?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function actionSummary(actions: ActionItem[]): string {
  const counts: Record<string, number> = {};
  for (const a of actions) {
    counts[a.tool] = (counts[a.tool] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([tool, count]) => `${count > 1 ? `${count}× ` : ""}${formatToolName(tool)}`)
    .join(" · ");
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── RILEY avatar chip ──────────────────────────────────────────────────────

function RileyAvatar() {
  return (
    <div
      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-mono"
      style={{
        background: "linear-gradient(135deg, hsl(172 100% 20%), hsl(172 100% 32%))",
        boxShadow: "0 0 10px hsl(172 100% 42% / 0.4)",
        color: "hsl(172 100% 80%)",
      }}
    >
      RI
    </div>
  );
}

// ── Actions log ────────────────────────────────────────────────────────────

function ActionsLog({ actions }: { actions: ActionItem[] }) {
  const [open, setOpen] = useState(false);

  if (!actions.length) return null;

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-border/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.04] transition-colors"
      >
        <span className="flex-1 text-left truncate font-mono opacity-70">
          ✓ {actionSummary(actions)}
        </span>
        {open ? (
          <ChevronUp className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-border/50 bg-black/20 max-h-40 overflow-y-auto">
          {actions.map((a, i) => (
            <div key={i} className="px-3 py-2 border-b border-border/30 last:border-0">
              <div className="text-xs font-mono text-primary/80 mb-1">
                {formatToolName(a.tool)}
              </div>
              <pre className="text-[10px] text-muted-foreground/70 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(a.result, null, 2).slice(0, 400)}
                {JSON.stringify(a.result, null, 2).length > 400 ? "\n…" : ""}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && <RileyAvatar />}

      <div className={`flex-1 max-w-[85%] ${isUser ? "flex flex-col items-end" : ""}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm"
              : "rounded-tl-sm"
          } ${
            msg.isError
              ? "bg-destructive/20 border border-destructive/30 text-destructive"
              : isUser
              ? "text-foreground"
              : "text-foreground/90"
          }`}
          style={
            isUser && !msg.isError
              ? {
                  background: "linear-gradient(135deg, hsl(172 100% 18%), hsl(172 100% 26%))",
                  boxShadow: "0 2px 12px hsl(172 100% 42% / 0.15)",
                }
              : !isUser && !msg.isError
              ? {
                  background: "hsl(228 30% 11%)",
                  border: "1px solid hsl(220 38% 16%)",
                }
              : {}
          }
        >
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>

        {!isUser && msg.actionsPerformed && msg.actionsPerformed.length > 0 && (
          <div className="w-full mt-1">
            <ActionsLog actions={msg.actionsPerformed} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Thinking indicator ─────────────────────────────────────────────────────

function ThinkingIndicator({ step }: { step: number }) {
  return (
    <div className="flex gap-2">
      <RileyAvatar />
      <div
        className="flex items-center gap-2 rounded-2xl rounded-tl-sm px-3.5 py-2.5"
        style={{
          background: "hsl(228 30% 11%)",
          border: "1px solid hsl(220 38% 16%)",
        }}
      >
        <Loader2
          className="w-3.5 h-3.5 animate-spin"
          style={{ color: "hsl(172 100% 42%)" }}
        />
        <span className="text-sm text-muted-foreground">
          Working
          {step > 0 && (
            <span className="font-mono text-xs ml-1.5" style={{ color: "hsl(172 100% 50% / 0.6)" }}>
              step {step}
            </span>
          )}
          <span className="animate-pulse">…</span>
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function RileyChat({ currentPage }: RileyChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Hey — I'm RILEY. Ask me about your alerts, patterns, or threat landscape. I can also triage alerts, run bug scans, or simulate attack scenarios.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const buildHistory = useCallback(
    (upToIndex: number): ChatHistoryItem[] =>
      messages
        .slice(0, upToIndex)
        .filter((m) => !m.isError)
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userMsg: Message = { id: uid(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);
    setThinkingStep(0);

    // Fake step progression for UX while waiting
    const stepTimer = setInterval(() => {
      setThinkingStep((s) => Math.min(s + 1, 4));
    }, 1800);

    try {
      const history = buildHistory(messages.length);
      const response = await customFetch<RileyChatResponse>("/riley-chat", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          history,
          context: currentPage ? { page: currentPage } : undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });

      const assistantMsg: Message = {
        id: uid(),
        role: "assistant",
        content: response.reply,
        toolCallsUsed: response.toolCallsUsed,
        actionsPerformed: response.actionsPerformed,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: uid(),
        role: "assistant",
        content: err instanceof Error ? `Error: ${err.message}` : "RILEY failed to respond.",
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      clearInterval(stepTimer);
      setIsThinking(false);
      setThinkingStep(0);
    }
  }, [input, isThinking, messages, buildHistory, currentPage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating toggle button ───────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
        style={{
          background: isOpen
            ? "hsl(228 35% 12%)"
            : "linear-gradient(135deg, hsl(172 100% 22%), hsl(172 100% 34%))",
          boxShadow: isOpen
            ? "0 0 0 2px hsl(172 100% 42% / 0.3), 0 4px 24px rgba(0,0,0,0.5)"
            : "0 0 0 3px hsl(172 100% 42% / 0.2), 0 0 24px hsl(172 100% 42% / 0.3), 0 4px 24px rgba(0,0,0,0.5)",
          border: "1px solid hsl(172 100% 42% / 0.4)",
        }}
        aria-label="Toggle RILEY AI chat"
        title="Ask RILEY"
      >
        {/* Pulsing ring (only when closed) */}
        {!isOpen && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: "hsl(172 100% 42%)" }}
          />
        )}
        {isOpen ? (
          <X className="w-5 h-5" style={{ color: "hsl(172 100% 70%)" }} />
        ) : (
          <Bot className="w-6 h-6" style={{ color: "hsl(172 100% 90%)" }} />
        )}
      </button>

      {/* ── Chat panel ───────────────────────────────────────────────── */}
      <div
        className="fixed bottom-24 right-6 z-40 flex flex-col transition-all duration-300 origin-bottom-right"
        style={{
          width: "380px",
          height: "520px",
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "scale(1) translateY(0)" : "scale(0.92) translateY(16px)",
          pointerEvents: isOpen ? "auto" : "none",
          background: "hsl(228 35% 7% / 0.97)",
          backdropFilter: "blur(16px)",
          border: "1px solid hsl(220 38% 14%)",
          borderRadius: "1rem",
          boxShadow: "0 8px 48px rgba(0,0,0,0.7), 0 0 1px hsl(172 100% 42% / 0.15) inset",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-border/60 flex-shrink-0"
          style={{
            background: "linear-gradient(180deg, hsl(228 40% 9%) 0%, transparent 100%)",
            borderRadius: "1rem 1rem 0 0",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, hsl(172 100% 18%), hsl(172 100% 30%))",
              boxShadow: "0 0 14px hsl(172 100% 42% / 0.35)",
            }}
          >
            <Bot className="w-4 h-4" style={{ color: "hsl(172 100% 80%)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-mono font-bold text-sm tracking-wide"
              style={{
                background: "linear-gradient(90deg, hsl(172 100% 52%), hsl(192 100% 60%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              RILEY
            </div>
            <div className="text-[11px] text-muted-foreground/60 truncate">
              AI Security Agent
              {currentPage && (
                <span className="ml-1.5 text-primary/50 font-mono">· {currentPage}</span>
              )}
            </div>
          </div>
          {/* Online indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: "hsl(172 100% 42%)",
                boxShadow: "0 0 6px hsl(172 100% 42%)",
              }}
            />
            <span className="text-[10px] text-primary/60 font-mono">online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 scroll-smooth">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isThinking && <ThinkingIndicator step={thinkingStep} />}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          className="flex-shrink-0 border-t border-border/60 p-3"
          style={{
            background: "hsl(228 40% 6%)",
            borderRadius: "0 0 1rem 1rem",
          }}
        >
          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2"
            style={{
              background: "hsl(228 30% 11%)",
              border: "1px solid hsl(220 38% 18%)",
              boxShadow: "inset 0 1px 0 hsl(255 100% 100% / 0.03)",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about alerts, patterns, or give a command…"
              disabled={isThinking}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none resize-none leading-relaxed min-h-[1.5rem] max-h-24"
              style={{ scrollbarWidth: "none" }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={isThinking || !input.trim()}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-30"
              style={{
                background:
                  input.trim() && !isThinking
                    ? "linear-gradient(135deg, hsl(172 100% 22%), hsl(172 100% 34%))"
                    : "hsl(228 30% 15%)",
                boxShadow:
                  input.trim() && !isThinking
                    ? "0 0 12px hsl(172 100% 42% / 0.3)"
                    : "none",
              }}
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" style={{ color: "hsl(172 100% 80%)" }} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/30 text-center mt-2 font-mono">
            Enter ↵ send · Shift+Enter newline
          </p>
        </div>
      </div>
    </>
  );
}
