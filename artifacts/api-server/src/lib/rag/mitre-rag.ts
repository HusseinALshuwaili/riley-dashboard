/**
 * MITRE ATT&CK RAG retriever
 *
 * Given a natural-language alert description, retrieves the top-K most
 * semantically similar MITRE ATT&CK techniques from pgvector.
 *
 * The results are injected into the MITRE Mapper stage of the
 * Investigation Agent, grounding the LLM's technique identification
 * in real ATT&CK data rather than pure training-time knowledge.
 */

import { pool } from "@workspace/db";
import { embed } from "./jina";

export interface MitreTechnique {
  id:               number;
  tacticId:         string;
  tactic:           string;
  techniqueId:      string;
  technique:        string;
  subTechniqueId:   string | null;
  subTechnique:     string | null;
  description:      string;
  platforms:        string[];
  exampleTools:     string[];
  similarity:       number;
}

/**
 * Retrieve the top K MITRE ATT&CK techniques most similar to the query.
 * Falls back to empty array if pgvector table doesn't exist or JINA_API_KEY
 * is not configured, so the investigation agent still works without RAG.
 */
export async function retrieveRelevantTechniques(
  query: string,
  topK = 5
): Promise<MitreTechnique[]> {
  // Graceful degradation — if JINA_API_KEY is missing, skip RAG
  if (!process.env.JINA_API_KEY) return [];

  try {
    const vec = await embed(query);
    const vecLiteral = `[${vec.join(",")}]`;

    const result = await pool.query<{
      id:                number;
      tactic_id:         string;
      tactic:            string;
      technique_id:      string;
      technique:         string;
      sub_technique_id:  string | null;
      sub_technique:     string | null;
      description:       string;
      platforms:         string[];
      example_tools:     string[];
      similarity:        number;
    }>(
      `SELECT
         id,
         tactic_id,
         tactic,
         technique_id,
         technique,
         sub_technique_id,
         sub_technique,
         description,
         platforms,
         example_tools,
         1 - (embedding <=> $1::vector) AS similarity
       FROM mitre_techniques
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [vecLiteral, topK]
    );

    return result.rows.map(r => ({
      id:             r.id,
      tacticId:       r.tactic_id,
      tactic:         r.tactic,
      techniqueId:    r.technique_id,
      technique:      r.technique,
      subTechniqueId: r.sub_technique_id,
      subTechnique:   r.sub_technique,
      description:    r.description,
      platforms:      r.platforms,
      exampleTools:   r.example_tools,
      similarity:     Number(r.similarity),
    }));
  } catch (err: unknown) {
    // If table doesn't exist yet or any other error, degrade gracefully
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[mitre-rag] RAG retrieval skipped:", msg.slice(0, 120));
    return [];
  }
}

/**
 * Format retrieved techniques as a compact context block for Groq prompts.
 */
export function formatRagContext(techniques: MitreTechnique[]): string {
  if (techniques.length === 0) return "";

  const lines = techniques.map((t, i) =>
    `${i + 1}. [${t.tacticId}] ${t.tactic} → [${t.techniqueId}] ${t.technique}${
      t.subTechnique ? ` → ${t.subTechnique} (${t.subTechniqueId})` : ""
    }
   Description: ${t.description.slice(0, 200)}…
   Platforms: ${t.platforms.join(", ")}
   Example tools: ${t.exampleTools.slice(0, 4).join(", ") || "N/A"}
   Similarity: ${(t.similarity * 100).toFixed(1)}%`
  );

  return `\n\nKNOWLEDGE BASE — Top ${techniques.length} relevant MITRE ATT&CK techniques (ranked by semantic similarity):\n${lines.join("\n\n")}`;
}
