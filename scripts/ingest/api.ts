import { API_URL, API_KEY } from "./config";

// POST (not GET) so large pools don't blow the URL-length limit; chunk anyway
// to stay within the endpoint's input cap.
const CHECK_URLS_CHUNK = 1000;

async function checkUrlsChunk(urls: string[]): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/trpc/article.checkUrls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY!,
    },
    body: JSON.stringify({ json: { urls } }),
  });
  if (!res.ok) {
    console.warn(
      `Warning: checkUrls returned ${res.status} for ${urls.length} urls`,
    );
    return [];
  }
  const data = (await res.json()) as { result: { data: { json: string[] } } };
  return data.result.data.json;
}

export async function checkExistingUrls(urls: string[]): Promise<Set<string>> {
  try {
    const existing = new Set<string>();
    for (let i = 0; i < urls.length; i += CHECK_URLS_CHUNK) {
      const chunk = urls.slice(i, i + CHECK_URLS_CHUNK);
      for (const url of await checkUrlsChunk(chunk)) existing.add(url);
    }
    return existing;
  } catch {
    console.warn(
      "Warning: Could not check existing URLs (is the app running?)",
    );
    return new Set();
  }
}

export async function fetchExistingTags(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/trpc/article.listTags`, {
      headers: { "X-API-Key": API_KEY! },
    });
    if (!res.ok) {
      console.error(`Failed to fetch tags: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      result: { data: { json: Array<{ name: string }> } };
    };
    return data.result.data.json.map((t) => t.name);
  } catch {
    console.warn(
      "Warning: Could not fetch existing tags (is the app running?)",
    );
    return [];
  }
}

export interface SimilarArticle {
  id: string;
  url: string;
  title: string;
  sourceDomain: string;
  similarity: number;
}

/**
 * Ask the server for existing articles whose embedding is within `threshold`
 * cosine similarity of the given vector. Returns [] on any failure so dedup
 * degrades to "no existing match" rather than blocking ingestion.
 */
export async function findSimilar(
  embedding: number[],
  threshold: number,
  limit = 5,
): Promise<SimilarArticle[]> {
  try {
    const res = await fetch(`${API_URL}/api/trpc/article.findSimilar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY!,
      },
      body: JSON.stringify({ json: { embedding, threshold, limit } }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      result: { data: { json: SimilarArticle[] } };
    };
    return data.result.data.json;
  } catch {
    console.warn("Warning: Could not query similar articles");
    return [];
  }
}

export interface SubmitBody {
  url: string;
  title: string;
  description: string;
  summary: string;
  tags: string[];
  sourceDomain: string;
  ogImage?: string | null;
  favicon?: string | null;
  publishedAt?: string | null;
  contentType?: "ARTICLE" | "VIDEO";
  videoEmbedUrl?: string | null;
  embedding?: number[];
}

export async function submitArticle(
  article: SubmitBody,
): Promise<"submitted" | "duplicate" | "error"> {
  const res = await fetch(`${API_URL}/api/trpc/article.create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY!,
    },
    body: JSON.stringify({ json: article }),
  });

  if (res.ok) return "submitted";

  const body = await res.text();
  if (body.includes("already been submitted")) return "duplicate";

  console.error(`  Submit error: ${res.status} ${body}`);
  return "error";
}
