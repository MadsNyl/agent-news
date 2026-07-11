import { shutdownTracing } from "./tracing";
import {
  API_URL,
  MODEL,
  API_KEY,
  DRY_RUN,
  LIMIT,
  FEEDS_LIMIT,
  FEED_FETCH_LIMIT,
  POOL_SIZE,
  DEDUP_THRESHOLD,
  DEDUP_SHADOW,
} from "./config";
import { checkOllama } from "./llm";
import { fetchRss, extractPageData } from "./rss";
import { extractContent } from "./pipeline/extract";
import { filterRelevance } from "./pipeline/filter";
import { summarize } from "./pipeline/summarize";
import { tagArticle } from "./pipeline/tagger";
import { extractMetadataFallback, isImageUrl } from "./pipeline/metadata";
import {
  checkExistingUrls,
  fetchExistingTags,
  findSimilar,
  submitArticle,
  type SubmitBody,
} from "./api";
import { embed, embedText, cosineSimilarity } from "./embed";
import { startActiveObservation } from "@langfuse/tracing";
import { FEEDS, type Feed } from "./feeds";

if (!DRY_RUN && !API_KEY) {
  console.error("Error: AGENT_NEWS_API_KEY environment variable is required.");
  console.error(
    "Generate one with: bun run scripts/generate-api-key.ts <email>",
  );
  process.exit(1);
}

type Candidate = {
  feed: Feed;
  title: string;
  link: string;
  description: string;
};

type PageData = NonNullable<Awaited<ReturnType<typeof extractPageData>>>;

type Enriched = Candidate & {
  page: PageData;
  content: string;
  summary: string;
  embedding: number[];
  isVideo: boolean;
};

await checkOllama();

console.log(`API:   ${API_URL}`);
console.log(`Model: ${MODEL}`);
const activeFeeds = FEEDS_LIMIT ? FEEDS.slice(0, FEEDS_LIMIT) : FEEDS;
console.log(
  `Feeds: ${activeFeeds.length}${FEEDS_LIMIT ? ` (of ${FEEDS.length})` : ""}`,
);
console.log(
  `Pool:  ${POOL_SIZE} candidates  •  dedup ≥ ${DEDUP_THRESHOLD}${DEDUP_SHADOW ? " (SHADOW)" : ""}`,
);
if (DRY_RUN) {
  const flags = [
    LIMIT && `limit: ${LIMIT}/feed`,
    FEEDS_LIMIT && `feeds: ${FEEDS_LIMIT}`,
  ]
    .filter(Boolean)
    .join(", ");
  console.log(`Mode:  DRY RUN${flags ? ` (${flags})` : ""}`);
}
console.log();

const existingTags = await fetchExistingTags();
console.log(`Loaded ${existingTags.length} existing tags`);

let totalSubmitted = 0;
let totalSkipped = 0;
let totalDuplicates = 0;
let totalErrors = 0;
let totalExisting = 0;
let totalDedupIntra = 0;
let totalDedupExisting = 0;
let totalShadowDropped = 0;

// ─────────────────────────────────────────────────────────────────────────
// PHASE 1 — GATHER: build one cross-feed candidate pool
// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log("Phase 1 — Gather pool");
console.log("═".repeat(50));

const feedGroups: Candidate[][] = [];
for (const feed of activeFeeds) {
  try {
    const articles = await fetchRss(feed.url);
    // Dev --limit (if set) wins; otherwise cap to the recent-items fetch limit.
    const perFeed = articles.slice(0, LIMIT ?? FEED_FETCH_LIMIT);
    feedGroups.push(
      perFeed.map((a) => ({
        feed,
        title: a.title,
        link: a.link,
        description: a.description,
      })),
    );
    console.log(`  ${feed.name}: ${perFeed.length} articles`);
  } catch (e) {
    console.log(`  ${feed.name}: ✗ fetch failed — ${e}`);
    totalErrors++;
  }
}

// Round-robin interleave so no single feed dominates the pool.
let pool: Candidate[] = [];
const maxLen = Math.max(0, ...feedGroups.map((g) => g.length));
for (let i = 0; i < maxLen; i++) {
  for (const group of feedGroups) {
    const item = group[i];
    if (item) pool.push(item);
  }
}

// Drop exact-URL duplicates within the pool, keeping the highest-priority feed.
const byUrl = new Map<string, Candidate>();
for (const c of pool) {
  const existing = byUrl.get(c.link);
  if (!existing || c.feed.priority < existing.feed.priority)
    byUrl.set(c.link, c);
}
pool = [...byUrl.values()];

// Drop URLs already in the DB (cheap, before any LLM work).
const existingUrls = await checkExistingUrls(pool.map((c) => c.link));
const beforeExisting = pool.length;
pool = pool.filter((c) => !existingUrls.has(c.link));
totalExisting = beforeExisting - pool.length;
if (totalExisting > 0)
  console.log(`  Skipped ${totalExisting} already in DB (by URL)`);

// Cap to the configured pool size.
if (pool.length > POOL_SIZE) {
  console.log(`  Capping pool ${pool.length} → ${POOL_SIZE}`);
  pool = pool.slice(0, POOL_SIZE);
}
console.log(`  Pool: ${pool.length} candidates`);

// ─────────────────────────────────────────────────────────────────────────
// PHASE 2 — ENRICH: extract → filter → summarize → embed
// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log("Phase 2 — Enrich");
console.log("═".repeat(50));

const enriched: Enriched[] = [];
for (const c of pool) {
  await startActiveObservation(`enrich: ${c.title}`, async (trace) => {
    trace.update({
      input: { url: c.link, title: c.title },
      metadata: { feed: c.feed.name, feedUrl: c.feed.url },
    });
    console.log(`→ ${c.title}  [${c.feed.name}]`);

    const page = await extractPageData(c.link);
    if (!page) {
      console.log("  Skipped: could not extract page");
      trace.update({ output: { status: "no-text" }, level: "WARNING" });
      totalSkipped++;
      return;
    }

    let content: string;
    try {
      content = await extractContent(page.text);
    } catch (e) {
      console.log(`  Skipped: extract error — ${e}`);
      trace.update({ output: { status: "extract-error" }, level: "ERROR" });
      totalErrors++;
      return;
    }

    if (content.trim().toUpperCase() === "SPONSORED") {
      console.log("  Skipped: sponsored content");
      trace.update({ output: { status: "sponsored" } });
      totalSkipped++;
      return;
    }

    let relevant: boolean;
    try {
      relevant = await filterRelevance({
        title: c.title,
        description: c.description,
        content,
      });
    } catch (e) {
      console.log(`  Skipped: filter error — ${e}`);
      trace.update({ output: { status: "filter-error" }, level: "ERROR" });
      totalSkipped++;
      return;
    }
    if (!relevant) {
      console.log("  Skipped: not relevant");
      trace.update({ output: { status: "filtered-out" } });
      totalSkipped++;
      return;
    }

    let summary: string;
    try {
      summary = await summarize(content);
    } catch (e) {
      console.log(`  Skipped: summarize error — ${e}`);
      trace.update({ output: { status: "summarize-error" }, level: "ERROR" });
      totalErrors++;
      return;
    }

    let embedding: number[];
    try {
      embedding = await embed(embedText(c.title, summary));
    } catch (e) {
      console.log(`  Skipped: embed error — ${e}`);
      trace.update({ output: { status: "embed-error" }, level: "ERROR" });
      totalErrors++;
      return;
    }

    console.log(`  ✓ enriched (${content.length} chars)`);
    trace.update({ output: { status: "enriched" } });
    enriched.push({
      ...c,
      page,
      content,
      summary,
      embedding,
      isVideo: !!page.video,
    });
  });
}

console.log(`\n  ${enriched.length} articles enriched`);

// ─────────────────────────────────────────────────────────────────────────
// PHASE 3 — DEDUP: intra-pool clustering, then vs. existing DB
// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(
  `Phase 3 — Dedup${DEDUP_SHADOW ? " (SHADOW — nothing dropped)" : ""}`,
);
console.log("═".repeat(50));

const drop = DEDUP_SHADOW ? "SHADOW DROP" : "DROP";

// Intra-pool: highest priority (then longest content) becomes the representative.
const sorted = [...enriched].sort((a, b) => {
  if (a.feed.priority !== b.feed.priority)
    return a.feed.priority - b.feed.priority;
  return b.content.length - a.content.length;
});

const reps: Enriched[] = [];
const intraDropped = new Set<Enriched>();
for (const e of sorted) {
  let best: Enriched | null = null;
  let bestSim = 0;
  for (const r of reps) {
    const sim = cosineSimilarity(e.embedding, r.embedding);
    if (sim > bestSim) {
      bestSim = sim;
      best = r;
    }
  }
  if (best && bestSim >= DEDUP_THRESHOLD) {
    intraDropped.add(e);
    totalDedupIntra++;
    console.log(
      `  ${drop} intra-pool: "${e.title}" [${e.feed.name}]\n` +
        `    ~ "${best.title}" [${best.feed.name}] (cosine ${bestSim.toFixed(3)})`,
    );
  } else {
    reps.push(e);
  }
}

// Vs. existing: nearest-neighbour query against embedded articles in the DB.
const existingDropped = new Set<Enriched>();
for (const r of reps) {
  const matches = await findSimilar(r.embedding, DEDUP_THRESHOLD, 1);
  const match = matches[0];
  if (match) {
    existingDropped.add(r);
    totalDedupExisting++;
    console.log(
      `  ${drop} vs-existing: "${r.title}" [${r.feed.name}]\n` +
        `    ~ "${match.title}" [${match.sourceDomain}] (cosine ${match.similarity.toFixed(3)})`,
    );
  }
}

// Survivors: in shadow mode we submit everything; otherwise only clean reps.
const survivors = DEDUP_SHADOW
  ? enriched
  : reps.filter((r) => !existingDropped.has(r));

totalShadowDropped = DEDUP_SHADOW
  ? intraDropped.size + existingDropped.size
  : 0;

console.log(
  `\n  ${survivors.length} to submit  •  ${totalDedupIntra} intra-pool dup(s)  •  ${totalDedupExisting} existing dup(s)` +
    (DEDUP_SHADOW ? "  (shadow — none dropped)" : ""),
);

// ─────────────────────────────────────────────────────────────────────────
// PHASE 4 — SUBMIT: tag + resolve metadata + submit survivors
// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log("Phase 4 — Submit");
console.log("═".repeat(50));

for (const e of survivors) {
  await startActiveObservation(`submit: ${e.title}`, async (trace) => {
    trace.update({ input: { url: e.link, title: e.title } });
    console.log(`→ ${e.title}  [${e.feed.name}]`);

    let tags: string[];
    try {
      tags = await tagArticle(e.content, existingTags);
    } catch (err) {
      console.log(`  Warning: tagging failed — ${err}`);
      tags = [];
    }

    let ogImage = e.page.ogImage;
    let publishedAt = e.page.publishedAt;
    const favicon = e.page.favicon;

    if (ogImage && !(await isImageUrl(ogImage))) ogImage = null;

    if (!ogImage || !publishedAt) {
      try {
        const fallback = await extractMetadataFallback(e.page.text, e.link, {
          needsImage: !ogImage,
          needsDate: !publishedAt,
        });
        if (!ogImage) ogImage = fallback.imageUrl ?? e.page.firstImage;
        if (!publishedAt) publishedAt = fallback.publishedAt;
      } catch {
        if (!ogImage) ogImage = e.page.firstImage;
      }
    }
    if (!publishedAt) publishedAt = new Date().toISOString();

    console.log(`  Summary: ${e.summary.slice(0, 100)}...`);
    console.log(`  Tags: ${tags.join(", ") || "(none)"}`);
    console.log(
      `  Image: ${ogImage ? "✓" : "✗"}  Date: ${publishedAt}  Favicon: ${favicon ? "✓" : "✗"}${e.isVideo ? "  Type: VIDEO" : ""}`,
    );

    if (DRY_RUN) {
      console.log("  ⏭ Dry run — skipped submission\n");
      trace.update({ output: { status: "dry-run", summary: e.summary, tags } });
      totalSubmitted++;
      return;
    }

    const sourceDomain = new URL(e.link).hostname.replace(/^www\./, "");
    const body: SubmitBody = {
      url: e.link,
      title: e.title,
      description: e.description,
      summary: e.summary,
      tags,
      sourceDomain,
      ogImage,
      favicon,
      publishedAt,
      embedding: e.embedding,
      ...(e.isVideo && {
        contentType: "VIDEO" as const,
        videoEmbedUrl: e.page.video!.embedUrl,
      }),
    };
    const result = await submitArticle(body);

    if (result === "submitted") {
      console.log("  ✓ Submitted\n");
      trace.update({ output: { status: "submitted", ...body } });
      totalSubmitted++;
    } else if (result === "duplicate") {
      console.log("  Skipped: already submitted\n");
      trace.update({ output: { status: "duplicate" } });
      totalDuplicates++;
    } else {
      console.log("  ✗ Error\n");
      trace.update({ output: { status: "submit-error" }, level: "ERROR" });
      totalErrors++;
    }
  });
}

console.log(`\n${"━".repeat(50)}`);
const dedupSummary = DEDUP_SHADOW
  ? `${totalShadowDropped} would-drop (shadow)`
  : `${totalDedupIntra + totalDedupExisting} deduped (${totalDedupIntra} intra, ${totalDedupExisting} existing)`;
console.log(
  DRY_RUN
    ? `Done (dry run). ${totalSubmitted} processed, ${totalExisting} URL-existing, ${dedupSummary}, ${totalSkipped} skipped, ${totalErrors} errors`
    : `Done. ${totalSubmitted} submitted, ${totalExisting} URL-existing, ${dedupSummary}, ${totalSkipped} skipped, ${totalDuplicates} duplicates, ${totalErrors} errors`,
);

await shutdownTracing();

if (totalErrors > 0 && totalSubmitted === 0) process.exit(1);
