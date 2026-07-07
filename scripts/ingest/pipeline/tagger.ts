import { llm } from "../llm";

function findSimilarTags(
  candidate: string,
  existingTags: string[],
): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, "");
  const singular = (s: string) => s.replace(/s$/, "");
  const cn = norm(candidate);
  const cs = singular(cn);

  return existingTags.filter((tag) => {
    const tn = norm(tag);
    const ts = singular(tn);
    if (cn === tn || cs === ts) return true;
    if (cn.includes(tn) || tn.includes(cn)) return true;
    if (cs.includes(ts) || ts.includes(cs)) return true;
    return false;
  });
}

export async function tagArticle(
  text: string,
  existingTags: string[],
): Promise<string[]> {
  const tagList = existingTags.join(", ");

  const TAG_SYSTEM = `You are a tag classifier for an AI news platform. Pick 2-3 tags for the article.

RULES:
- Tags are broad topic categories, NOT specific names or terms from the article
- Tags should be reusable across many articles (e.g. "Open Source AI" not "Llama 3")
- Title Case, 1-3 words maximum
- ALWAYS prefer existing tags over creating new ones
- Only create a new tag if no existing tag fits the article's main topic

Reply with JSON only: {"tags": ["tag1", "tag2"]}`;

  const raw = await llm(
    "tag-suggest",
    TAG_SYSTEM,
    `Existing tags: ${tagList || "(none yet)"}\n\nArticle:\n${text}`,
    { temperature: 0, num_predict: 200 },
  );

  let suggested: string[];
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    suggested = JSON.parse(match![0]).tags;
  } catch {
    console.log("  Warning: Could not parse tag JSON, skipping tags");
    return [];
  }

  const junk = new Set(["new-tag", "new tag", "tag1", "tag2", "tag3", "tag"]);
  suggested = suggested.filter(
    (t) => typeof t === "string" && t.length >= 2 && !junk.has(t.toLowerCase()),
  );

  const finalTags: string[] = [];

  for (const tag of suggested) {
    const exactMatch = existingTags.find(
      (t) => t.toLowerCase() === tag.toLowerCase(),
    );
    if (exactMatch) {
      finalTags.push(exactMatch);
      continue;
    }

    let similar = findSimilarTags(tag, existingTags);

    if (similar.length === 0) {
      const fallbackRaw = await llm(
        "tag-dedup-check",
        "You check for duplicate tags. Reply with JSON only.",
        `Is the tag "${tag}" similar to any of these existing tags? ${tagList}\nReply {"similar": ["existing-tag"]} or {"similar": []}`,
        { temperature: 0, num_predict: 100 },
      );
      try {
        const match = fallbackRaw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match![0]);
        if (parsed.similar?.length > 0) {
          similar = parsed.similar.filter((s: string) =>
            existingTags.some((t) => t.toLowerCase() === s.toLowerCase()),
          );
        }
      } catch {
        // No similar found, accept as new
      }
    }

    if (similar.length > 0) {
      const resolveRaw = await llm(
        "tag-resolve",
        "You are resolving a potential duplicate tag. Reply with JSON only.",
        `You suggested "${tag}". These similar tags already exist: ${similar.join(", ")}. Should you use one of these instead, or is yours truly distinct? Reply {"use": "existing-tag"} or {"create": "new-tag"}`,
        { temperature: 0, num_predict: 50 },
      );
      try {
        const match = resolveRaw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match![0]);
        if (parsed.use) {
          const verified = existingTags.find(
            (t) => t.toLowerCase() === parsed.use.toLowerCase(),
          );
          finalTags.push(verified ?? tag);
        } else {
          finalTags.push(parsed.create ?? tag);
        }
      } catch {
        finalTags.push(tag);
      }
    } else {
      finalTags.push(tag);
      existingTags.push(tag);
    }
  }

  const seen = new Set<string>();
  return finalTags.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
