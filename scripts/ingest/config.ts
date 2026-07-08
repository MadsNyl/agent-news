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
export const API_URL =
  process.env.AGENT_NEWS_URL ?? "http://localhost:3000";
export const API_KEY = process.env.AGENT_NEWS_API_KEY;
