import { shutdownTracing } from "./tracing";
import { API_URL, MODEL, API_KEY, DRY_RUN, LIMIT, FEEDS_LIMIT } from "./config";
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
  submitArticle,
  type SubmitBody,
} from "./api";
import { startActiveObservation } from "@langfuse/tracing";
import { FEEDS } from "./feeds";

if (!DRY_RUN && !API_KEY) {
  console.error("Error: AGENT_NEWS_API_KEY environment variable is required.");
  console.error(
    "Generate one with: bun run scripts/generate-api-key.ts <email>",
  );
  process.exit(1);
}

await checkOllama();

console.log(`API:   ${API_URL}`);
console.log(`Model: ${MODEL}`);
const activeFeeds = FEEDS_LIMIT ? FEEDS.slice(0, FEEDS_LIMIT) : FEEDS;
console.log(`Feeds: ${activeFeeds.length}${FEEDS_LIMIT ? ` (of ${FEEDS.length})` : ""}`);
if (DRY_RUN) {
  const flags = [LIMIT && `limit: ${LIMIT}/feed`, FEEDS_LIMIT && `feeds: ${FEEDS_LIMIT}`].filter(Boolean).join(", ");
  console.log(`Mode:  DRY RUN${flags ? ` (${flags})` : ""}`);
}
console.log();

const existingTags = await fetchExistingTags();
console.log(`Loaded ${existingTags.length} existing tags\n`);

let totalSubmitted = 0;
let totalSkipped = 0;
let totalDuplicates = 0;
let totalErrors = 0;
let totalExisting = 0;

for (const feed of activeFeeds) {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`Feed: ${feed.name}`);
  console.log(`      ${feed.url}`);
  console.log("═".repeat(50));

  let articles: Array<{ title: string; link: string; description: string }>;
  try {
    articles = await fetchRss(feed.url);
  } catch (e) {
    console.log(`  ✗ Failed to fetch feed: ${e}\n`);
    totalErrors++;
    continue;
  }
  console.log(`Found ${articles.length} articles`);

  if (articles.length === 0) continue;

  const urls = articles.map((a) => a.link);
  const existingUrls = await checkExistingUrls(urls);
  const newArticles = articles.filter((a) => !existingUrls.has(a.link));
  const skippedExisting = articles.length - newArticles.length;
  totalExisting += skippedExisting;

  if (skippedExisting > 0) {
    console.log(`Skipping ${skippedExisting} already in DB`);
  }

  let feedArticles = newArticles;
  if (LIMIT && feedArticles.length > LIMIT) {
    feedArticles = feedArticles.slice(0, LIMIT);
    console.log(`Limited to ${feedArticles.length} articles`);
  }

  if (feedArticles.length === 0) {
    console.log("No new articles to process\n");
    continue;
  }

  console.log(`Processing ${feedArticles.length} new articles\n`);

  for (const article of feedArticles) {
    console.log(`→ ${article.title}`);

    await startActiveObservation(
      `process-article: ${article.title}`,
      async (trace) => {
        trace.update({
          input: { url: article.link, title: article.title },
          metadata: { feed: feed.name, feedUrl: feed.url },
        });

        const page = await extractPageData(article.link);
        if (!page) {
          console.log("  Skipped: could not extract page\n");
          trace.update({ output: { status: "no-text" }, level: "WARNING" });
          totalSkipped++;
          return;
        }

        const isVideo = !!page.video;
        if (isVideo) console.log(`  Video detected: ${page.video!.embedUrl}`);

        let content: string;
        try {
          content = await extractContent(page.text);
          console.log(`  Extracted: ${content.length} chars`);
        } catch (e) {
          console.log(`  Skipped: extract error — ${e}\n`);
          trace.update({ output: { status: "extract-error" }, level: "ERROR" });
          totalErrors++;
          return;
        }

        let relevant: boolean;
        try {
          relevant = await filterRelevance({
            title: article.title,
            description: article.description,
            content,
          });
        } catch (e) {
          console.log(`  Skipped: filter error — ${e}\n`);
          trace.update({ output: { status: "filter-error" }, level: "ERROR" });
          totalSkipped++;
          return;
        }
        if (!relevant) {
          console.log("  Skipped: not relevant\n");
          trace.update({ output: { status: "filtered-out" } });
          totalSkipped++;
          return;
        }

        let summary: string;
        try {
          summary = await summarize(content);
        } catch (e) {
          console.log(`  Skipped: summarize error — ${e}\n`);
          trace.update({
            output: { status: "summarize-error" },
            level: "ERROR",
          });
          totalErrors++;
          return;
        }

        let tags: string[];
        try {
          tags = await tagArticle(content, existingTags);
        } catch (e) {
          console.log(`  Warning: tagging failed — ${e}`);
          tags = [];
        }

        // Resolve metadata: HTML meta tags first, then LLM fallback
        let ogImage = page.ogImage;
        let publishedAt = page.publishedAt;
        const favicon = page.favicon;

        if (ogImage && !(await isImageUrl(ogImage))) ogImage = null;

        if (!ogImage || !publishedAt) {
          console.log(`  Resolving missing metadata via LLM (${[!ogImage && "image", !publishedAt && "date"].filter(Boolean).join(", ")})...`);
          try {
            const fallback = await extractMetadataFallback(
              page.text,
              article.link,
              { needsImage: !ogImage, needsDate: !publishedAt },
            );
            if (!ogImage) ogImage = fallback.imageUrl ?? page.firstImage;
            if (!publishedAt) publishedAt = fallback.publishedAt;
          } catch {
            if (!ogImage) ogImage = page.firstImage;
          }
        }

        if (!publishedAt) publishedAt = new Date().toISOString();

        console.log(`  Summary: ${summary.slice(0, 100)}...`);
        console.log(`  Tags: ${tags.join(", ") || "(none)"}`);
        console.log(`  Image: ${ogImage ? "✓" : "✗"}  Date: ${publishedAt ?? "✗"}  Favicon: ${favicon ? "✓" : "✗"}${isVideo ? "  Type: VIDEO" : ""}`);

        if (DRY_RUN) {
          console.log("  ⏭ Dry run — skipped submission\n");
          trace.update({
            output: { status: "dry-run", summary, tags, ogImage, publishedAt, contentType: isVideo ? "VIDEO" : "ARTICLE" },
          });
          totalSubmitted++;
          return;
        }

        const sourceDomain = new URL(article.link).hostname.replace(
          /^www\./,
          "",
        );
        const body: SubmitBody = {
          url: article.link,
          title: article.title,
          description: article.description,
          summary,
          tags,
          sourceDomain,
          ogImage,
          favicon,
          publishedAt,
          ...(isVideo && {
            contentType: "VIDEO" as const,
            videoEmbedUrl: page.video!.embedUrl,
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
      },
    );
  }
}

console.log(`\n${"━".repeat(50)}`);
console.log(
  DRY_RUN
    ? `Done (dry run). ${totalSubmitted} processed, ${totalExisting} already in DB, ${totalSkipped} skipped, ${totalErrors} errors`
    : `Done. ${totalSubmitted} submitted, ${totalExisting} already in DB, ${totalSkipped} skipped, ${totalDuplicates} duplicates, ${totalErrors} errors`,
);

await shutdownTracing();

if (totalErrors > 0 && totalSubmitted === 0) process.exit(1);
