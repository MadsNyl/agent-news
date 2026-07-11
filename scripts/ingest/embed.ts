import { OLLAMA_EMBED_URL, EMBED_MODEL } from "./config";

/**
 * Produce a 768-dim embedding for a piece of text via the local Ollama
 * nomic-embed-text model. Throws on failure so callers can decide whether a
 * missing embedding should skip dedup for that article.
 */
export async function embed(text: string): Promise<number[]> {
  const res = await fetch(OLLAMA_EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });

  if (!res.ok) {
    throw new Error(
      `Ollama embeddings error: ${res.status} ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { embedding?: number[] };
  if (!data.embedding || data.embedding.length === 0) {
    throw new Error("Ollama returned an empty embedding");
  }
  return data.embedding;
}

/** Text we embed for an article: title carries the topic, summary the detail. */
export function embedText(title: string, summary: string): string {
  return `${title}\n\n${summary}`.trim();
}

/** Cosine similarity between two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
