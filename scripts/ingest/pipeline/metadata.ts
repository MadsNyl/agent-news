import { llm } from "../llm";

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(\?|$)/i;
const IMAGE_CONTENT_TYPES = /^image\//i;

export async function isImageUrl(url: string): Promise<boolean> {
  if (IMAGE_EXTENSIONS.test(url)) return true;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
    });
    const ct = res.headers.get("content-type") ?? "";
    return IMAGE_CONTENT_TYPES.test(ct);
  } catch {
    return false;
  }
}

interface MetadataFallback {
  imageUrl: string | null;
  publishedAt: string | null;
}

interface MetadataNeeds {
  needsImage: boolean;
  needsDate: boolean;
}

export async function extractMetadataFallback(
  articleText: string,
  url: string,
  needs: MetadataNeeds,
): Promise<MetadataFallback> {
  const tasks: string[] = [];
  const fields: string[] = [];

  if (needs.needsImage) {
    tasks.push("Find the URL of the first meaningful image (not icons, logos, or tracking pixels).");
    fields.push('"imageUrl": "https://..." or null');
  }
  if (needs.needsDate) {
    tasks.push("Find the publish date, created date, or last updated date.");
    const today = new Date().toISOString().split("T")[0];
    fields.push(`"publishedAt": "${today}" or null (ISO format)`);
  }

  const raw = await llm(
    "metadata-fallback",
    `You extract metadata from article text.\n${tasks.join("\n")}\n\nReply with JSON only: {${fields.join(", ")}}. If you cannot find a value, use null.`,
    `Article URL: ${url}\n\nArticle text:\n${articleText.slice(0, 4000)}`,
    { temperature: 0, num_predict: 150 },
  );

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match![0]);
    let imageUrl = needs.needsImage && typeof parsed.imageUrl === "string"
      ? parsed.imageUrl
      : null;
    if (imageUrl && !(await isImageUrl(imageUrl))) imageUrl = null;
    return {
      imageUrl,
      publishedAt: needs.needsDate && typeof parsed.publishedAt === "string"
        ? parsed.publishedAt
        : null,
    };
  } catch {
    return { imageUrl: null, publishedAt: null };
  }
}
