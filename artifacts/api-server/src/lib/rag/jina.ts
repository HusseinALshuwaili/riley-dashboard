/**
 * Jina AI Embedding Client
 *
 * Free tier: 1M tokens/month — no credit card required.
 * Sign up at https://jina.ai and grab a free API key.
 * Set JINA_API_KEY in your env.
 *
 * Model: jina-embeddings-v3 — 1024 dimensions, multilingual.
 */

const JINA_API_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL   = "jina-embeddings-v3";
const DIMENSIONS   = 1024;

export { DIMENSIONS };

interface JinaResponse {
  data: Array<{ embedding: number[] }>;
}

/**
 * Embed a single text string.
 * Returns a 1024-dimensional float array.
 */
export async function embed(text: string): Promise<number[]> {
  const key = process.env.JINA_API_KEY;
  if (!key) throw new Error("JINA_API_KEY not configured");

  const res = await fetch(JINA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model:  JINA_MODEL,
      input:  [text],
      task:   "retrieval.query",   // optimized for query-side embedding
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jina API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json() as JinaResponse;
  const vec = json.data[0]?.embedding;
  if (!vec) throw new Error("Jina returned empty embedding");
  return vec;
}

/**
 * Embed a batch of texts (up to 128 per call).
 * Used by the seeder to bulk-embed MITRE technique descriptions.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = process.env.JINA_API_KEY;
  if (!key) throw new Error("JINA_API_KEY not configured");

  const res = await fetch(JINA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: texts,
      task:  "retrieval.passage",  // optimized for document-side embedding
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jina API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json() as JinaResponse;
  return json.data.map(d => d.embedding);
}
