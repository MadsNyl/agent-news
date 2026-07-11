import { llm } from "../llm";
import { embed, cosineSimilarity } from "../embed";

// Reuse an existing tag when a new candidate is at least this cosine-similar.
// Logged on every reuse so the threshold can be eyeballed on early runs.
const TAG_REUSE_THRESHOLD = 0.85;

// Words that should stay upper-cased when normalizing to Title Case.
const ACRONYMS = new Set([
  "ai",
  "ml",
  "llm",
  "llms",
  "rag",
  "api",
  "apis",
  "mcp",
  "sdk",
  "gpu",
  "gpus",
  "cpu",
  "ui",
  "ux",
  "ci",
  "cd",
  "nlp",
  "ocr",
  "saas",
  "b2b",
  "b2c",
  "iot",
  "ar",
  "vr",
  "aiops",
  "mlops",
  "hitl",
]);

const JUNK = new Set([
  "new-tag",
  "new tag",
  "newtag",
  "tag1",
  "tag2",
  "tag3",
  "tag",
  "tags",
  "none",
  "n/a",
  "na",
  "null",
  "undefined",
]);

/** Canonical Title-Case form for a newly created tag (kebab/snake → words). */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) =>
      ACRONYMS.has(w)
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

function isJunk(tag: string): boolean {
  const t = tag.toLowerCase().trim();
  return t.length < 2 || JUNK.has(t);
}

// Cache tag embeddings for the lifetime of the run so each tag embeds once.
const tagEmbeddingCache = new Map<string, number[]>();
async function getTagEmbedding(tag: string): Promise<number[]> {
  const key = tag.toLowerCase();
  let vec = tagEmbeddingCache.get(key);
  if (!vec) {
    vec = await embed(tag);
    tagEmbeddingCache.set(key, vec);
  }
  return vec;
}

/** Fast lexical match: same tag ignoring case, separators, and trailing plural. */
function lexicalMatch(
  candidate: string,
  existingTags: string[],
): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[-_\s]+/g, "")
      .replace(/s$/, "");
  const cn = norm(candidate);
  // Prefer an exact normalized match (e.g. reuse "Open Source AI", not the
  // shorter "open-source") before falling back to a substring match.
  const exact = existingTags.find((t) => norm(t) === cn);
  if (exact) return exact;
  return (
    existingTags.find((t) => {
      const tn = norm(t);
      return cn.includes(tn) || tn.includes(cn);
    }) ?? null
  );
}

/** Closest existing tag by embedding cosine, or null if none clear the bar. */
async function embeddingMatch(
  candidate: string,
  existingTags: string[],
): Promise<{ tag: string; sim: number } | null> {
  try {
    const cv = await getTagEmbedding(candidate);
    let best: string | null = null;
    let bestSim = 0;
    for (const t of existingTags) {
      const sim = cosineSimilarity(cv, await getTagEmbedding(t));
      if (sim > bestSim) {
        bestSim = sim;
        best = t;
      }
    }
    return best && bestSim >= TAG_REUSE_THRESHOLD
      ? { tag: best, sim: bestSim }
      : null;
  } catch {
    return null; // embedding unavailable → fall back to lexical only
  }
}

const TAG_SYSTEM = `You are a tag classifier for an AI news platform. Assign the FEWEST broad topic tags that are genuinely central to the article — 1 to 3 tags, and returning zero is acceptable when nothing fits well.

RULES:
- Tags are broad, reusable topic categories (e.g. "Open Source AI", "AI Agents", "Enterprise AI"), NEVER specific product, model, or company names (not "Llama 3", not "GPT-5.6").
- Strongly prefer an existing tag over inventing a new one. Only propose a new tag if no existing tag covers the article's main topic.
- Do NOT add a tag unless the article is substantially about it. Over-tagging is worse than under-tagging — prefer fewer, high-confidence tags.
- Only apply an open-source tag when the article is specifically about open-weight models, open datasets, or open-source code being released or discussed. NEVER apply it to proprietary or closed products (e.g. GPT, Copilot, Gemini announcements).
- Title Case, 1-3 words each.

Reply with JSON only: {"tags": [...]}. Use {"tags": []} if nothing fits.`;

async function suggestTags(
  text: string,
  existingTags: string[],
): Promise<string[]> {
  const raw = await llm(
    "tag-suggest",
    TAG_SYSTEM,
    `Existing tags: ${existingTags.join(", ") || "(none yet)"}\n\nArticle:\n${text}`,
    { temperature: 0, num_predict: 200 },
  );
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match![0]);
    return Array.isArray(parsed.tags) ? parsed.tags : [];
  } catch {
    console.log("  Warning: Could not parse tag JSON, skipping tags");
    return [];
  }
}

export async function tagArticle(
  text: string,
  existingTags: string[],
): Promise<string[]> {
  const suggested = await suggestTags(text, existingTags);

  const finalTags: string[] = [];
  for (const candidate of suggested) {
    if (typeof candidate !== "string" || isJunk(candidate)) continue;

    // 1. Exact / lexical reuse of an existing tag (keep the existing string).
    const lexical = lexicalMatch(candidate, existingTags);
    if (lexical) {
      finalTags.push(lexical);
      continue;
    }

    // 2. Semantic reuse via embedding similarity.
    const semantic = await embeddingMatch(candidate, existingTags);
    if (semantic) {
      console.log(
        `  tag: reused "${semantic.tag}" for "${candidate}" (cosine ${semantic.sim.toFixed(3)})`,
      );
      finalTags.push(semantic.tag);
      continue;
    }

    // 3. Genuinely new tag — normalize to canonical Title Case and register it.
    const created = normalizeTag(candidate);
    if (isJunk(created)) continue;
    console.log(`  tag: created "${created}"`);
    finalTags.push(created);
    existingTags.push(created);
  }

  // Collapse equivalent tags so one article never carries both "Open Source AI"
  // and "open-source" (redundant DB tags that coexist without a migration).
  return collapseEquivalent(finalTags).slice(0, 3);
}

function collapseEquivalent(tags: string[]): string[] {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[-_\s]+/g, "")
      .replace(/s$/, "");
  const kept: string[] = [];
  for (const t of tags) {
    const tn = norm(t);
    const dup = kept.some((k) => {
      const kn = norm(k);
      if (kn === tn) return true;
      const [short, long] = kn.length <= tn.length ? [kn, tn] : [tn, kn];
      // Only collapse on containment when the shorter form is substantial,
      // so tiny tokens like "ai" don't swallow distinct tags.
      return short.length >= 5 && long.includes(short);
    });
    if (!dup) kept.push(t);
  }
  return kept;
}
