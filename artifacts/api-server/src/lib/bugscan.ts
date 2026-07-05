import { logger } from "./logger";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface RawFinding {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  line: number | null;
  recommendation: string;
}

interface DetectorFinding extends RawFinding {
  id: string;
  confirmed: boolean;
}

export interface PipelineResult {
  status: "completed" | "failed";
  analyzerNotes: string;
  detectorFindings: DetectorFinding[];
  confirmedFindings: (DetectorFinding & { confirmed: boolean })[];
  debunkedCount: number;
}

async function callGroq(system: string, user: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message.content;
  if (!content) {
    throw new Error("Groq API returned an empty response");
  }
  return content;
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Could not parse JSON from model response");
  }
}

export async function runBugScanPipeline(
  code: string,
  language: string,
): Promise<PipelineResult> {
  // Stage 1: Analyzer — produces a structural summary of the code.
  const analyzerRaw = await callGroq(
    `You are Analyzer, the first agent in a 3-agent adversarial code security pipeline (Analyzer -> Detector -> Debunker). Read the provided ${language} code and produce a concise structural and behavioral summary: what it does, its inputs/outputs, external calls, and any notable risk surfaces. Respond ONLY with JSON: {"summary": string}.`,
    code,
  );
  const analyzerParsed = extractJson(analyzerRaw) as { summary?: string };
  const analyzerNotes = analyzerParsed.summary ?? "Analyzer produced no summary.";

  // Stage 2: Detector — proposes candidate vulnerabilities based on the analyzer notes + code.
  const detectorRaw = await callGroq(
    `You are Detector, the second agent in a 3-agent adversarial code security pipeline. You receive the Analyzer's summary and the raw ${language} code. Identify candidate security vulnerabilities, bugs, or risky patterns. Be thorough but you may include false leads — a later agent (Debunker) will filter them. Respond ONLY with JSON: {"findings": [{"title": string, "description": string, "severity": "low"|"medium"|"high"|"critical", "line": number|null, "recommendation": string}]}.`,
    `Analyzer summary:\n${analyzerNotes}\n\nCode:\n${code}`,
  );
  const detectorParsed = extractJson(detectorRaw) as { findings?: RawFinding[] };
  const detectorFindings: DetectorFinding[] = (detectorParsed.findings ?? []).map((f, idx) => ({
    id: String(idx + 1),
    title: f.title,
    description: f.description,
    severity: f.severity,
    line: f.line ?? null,
    recommendation: f.recommendation,
    confirmed: false,
  }));

  if (detectorFindings.length === 0) {
    return {
      status: "completed",
      analyzerNotes,
      detectorFindings: [],
      confirmedFindings: [],
      debunkedCount: 0,
    };
  }

  // Stage 3: Debunker — adversarially challenges each finding, keeping only confirmed real ones.
  const debunkerRaw = await callGroq(
    `You are Debunker, the third and final agent in a 3-agent adversarial code security pipeline. You receive candidate findings from Detector. Your job is to adversarially challenge each one: is it a REAL, exploitable issue in this exact code, or a false positive / theoretical / already mitigated? Be skeptical and rigorous. Respond ONLY with JSON: {"results": [{"id": number, "confirmed": boolean, "reason": string}]} where "id" matches the finding id given to you.`,
    `Code:\n${code}\n\nCandidate findings:\n${JSON.stringify(detectorFindings, null, 2)}`,
  );
  const debunkerParsed = extractJson(debunkerRaw) as {
    results?: { id: string | number; confirmed: boolean; reason?: string }[];
  };
  const verdicts = new Map<string, boolean>();
  for (const r of debunkerParsed.results ?? []) {
    verdicts.set(String(r.id), r.confirmed);
  }

  const confirmedFindings = detectorFindings.map((f) => ({
    ...f,
    confirmed: verdicts.get(f.id) ?? false,
  }));

  const debunkedCount = confirmedFindings.filter((f) => !f.confirmed).length;

  return {
    status: "completed",
    analyzerNotes,
    detectorFindings,
    confirmedFindings: confirmedFindings.filter((f) => f.confirmed),
    debunkedCount,
  };
}

export async function fetchGithubFileContents(githubUrl: string): Promise<string> {
  let rawUrl = githubUrl;
  const blobMatch = githubUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/,
  );
  if (blobMatch) {
    const [, owner, repo, branch, filePath] = blobMatch;
    rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }

  const response = await fetch(rawUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub file contents (${response.status})`);
  }
  const text = await response.text();
  logger.info({ rawUrl, length: text.length }, "Fetched GitHub file for bug scan");
  return text;
}
