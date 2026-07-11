const args = process.argv.slice(2);
const flagIndex = (flag: string) => args.indexOf(flag);

function parseFlag(flag: string): boolean {
  const i = flagIndex(flag);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}

function parseFlagValue(flag: string): string | undefined {
  const i = flagIndex(flag);
  if (i === -1) return undefined;
  const val = args[i + 1];
  args.splice(i, 2);
  return val;
}

export const DRY_RUN = parseFlag("--dry-run");
const limitStr = parseFlagValue("--limit") ?? process.env.INGEST_LIMIT;
export const LIMIT = limitStr ? parseInt(limitStr, 10) : undefined;
const feedsStr = parseFlagValue("--feeds") ?? process.env.INGEST_FEEDS;
export const FEEDS_LIMIT = feedsStr ? parseInt(feedsStr, 10) : undefined;

export const OLLAMA_URL =
  process.env.OLLAMA_URL ?? "http://localhost:11434/api/chat";
export const MODEL = process.env.OLLAMA_MODEL ?? "openbmb/minicpm5";

// Embeddings share the Ollama host with chat; swap the endpoint path.
export const OLLAMA_EMBED_URL =
  process.env.OLLAMA_EMBED_URL ??
  OLLAMA_URL.replace(/\/api\/chat\/?$/, "/api/embeddings");
export const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

// Cap per-feed items taken at gather time. Feeds serve their whole archive
// (hundreds of items); we only need the most recent few from each. Keeps the
// pre-pool URL-existence check to a light DB query instead of thousands of rows.
const feedFetchStr =
  parseFlagValue("--feed-limit") ?? process.env.INGEST_FEED_LIMIT;
export const FEED_FETCH_LIMIT = feedFetchStr ? parseInt(feedFetchStr, 10) : 25;

// Size of the cross-feed candidate pool gathered before dedup runs.
const poolStr = parseFlagValue("--pool") ?? process.env.INGEST_POOL_SIZE;
export const POOL_SIZE = poolStr ? parseInt(poolStr, 10) : 40;

// Cosine similarity at/above which two articles are treated as the same story.
const thresholdStr =
  parseFlagValue("--dedup-threshold") ?? process.env.INGEST_DEDUP_THRESHOLD;
export const DEDUP_THRESHOLD = thresholdStr ? parseFloat(thresholdStr) : 0.88;

// Shadow mode: log would-be drops but still submit everything.
export const DEDUP_SHADOW =
  parseFlag("--dedup-shadow") || process.env.INGEST_DEDUP_SHADOW === "true";
export const API_URL = process.env.AGENT_NEWS_URL ?? "http://localhost:3000";
export const API_KEY = process.env.AGENT_NEWS_API_KEY;
