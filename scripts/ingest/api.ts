import { API_URL, API_KEY } from "./config";

export async function checkExistingUrls(urls: string[]): Promise<Set<string>> {
  try {
    const input = encodeURIComponent(JSON.stringify({ json: { urls } }));
    const res = await fetch(
      `${API_URL}/api/trpc/article.checkUrls?input=${input}`,
      { headers: { "X-API-Key": API_KEY! } },
    );
    if (!res.ok) return new Set();
    const data = (await res.json()) as {
      result: { data: { json: string[] } };
    };
    return new Set(data.result.data.json);
  } catch {
    console.warn("Warning: Could not check existing URLs (is the app running?)");
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
    console.warn("Warning: Could not fetch existing tags (is the app running?)");
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
