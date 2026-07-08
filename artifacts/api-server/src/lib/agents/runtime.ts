/**
 * Shared agent runtime — Groq client + utilities used by all Riley agents.
 *
 * Consumers:
 *   - lib/bugscan.ts         (3-stage JSON pipeline)
 *   - lib/recon-agent.ts     (3-stage JSON pipeline)
 *   - lib/riley-agent.ts     (ReAct loop with function calling)
 *   - lib/agents/tier1-agent.ts  (scheduled SOC pipeline)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL   = "llama-3.3-70b-versatile";

// ---------------------------------------------------------------------------
// Shared fetch utility
// ---------------------------------------------------------------------------

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// JSON-mode Groq call (used by bugscan, recon pipeline stages)
// ---------------------------------------------------------------------------

/**
 * Call Groq with `response_format: json_object`.
 * Returns the raw JSON string from the model.
 */
export async function callGroq(
  systemPrompt: string,
  userContent: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not configured");

  const res = await fetchWithTimeout(
    GROQ_API_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userContent  },
        ],
        temperature:     opts.temperature ?? 0.3,
        max_tokens:      opts.maxTokens   ?? 1024,
        response_format: { type: "json_object" },
      }),
    },
    30000
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json() as { choices: Array<{ message: { content: string } }> };
  return json.choices[0]?.message?.content ?? "{}";
}

// ---------------------------------------------------------------------------
// Function-calling Groq call (used by riley-agent ReAct loop)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface GroqTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Call Groq with tool definitions — used by the ReAct agent loop.
 * Returns the assistant message and finish reason.
 */
export async function callGroqWithTools(
  messages: ChatMessage[],
  tools: GroqTool[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<{ message: ChatMessage; finishReason: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      messages,
      tools,
      tool_choice: "auto",
      temperature: opts.temperature ?? 0.1,
      max_tokens:  opts.maxTokens  ?? 2048,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error (${response.status}): ${text}`);
  }

  const data = await response.json() as {
    choices: Array<{
      message: {
        role: "assistant";
        content: string | null;
        tool_calls?: GroqToolCall[];
      };
      finish_reason: string;
    }>;
  };

  const choice = data.choices[0];
  if (!choice) throw new Error("Groq returned no choices");

  return { message: choice.message as ChatMessage, finishReason: choice.finish_reason };
}
