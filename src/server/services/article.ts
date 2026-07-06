import {
  type PrismaClient,
  Prisma,
  ContentType,
} from "../../../generated/prisma";
import * as cheerio from "cheerio";

export { ContentType };

export type ArticleDraft = {
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
  sourceDomain: string;
  publishedAt: string | null;
  contentType: ContentType;
  videoEmbedUrl: string | null;
  videoDuration: number | null;
};

function deriveSourceDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function domainToName(domain: string): string {
  return domain
    .replace(/^www\./, "")
    .replace(/\.(com|org|net|io|co|ai|dev|tech|news|blog)$/i, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const VIDEO_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "dailymotion.com",
  "twitch.tv",
  "loom.com",
]);

function extractVideoEmbedUrl(url: string, domain: string): string | null {
  try {
    const u = new URL(url);

    if (domain === "youtube.com" || domain === "youtu.be") {
      let videoId: string | null = null;
      if (domain === "youtu.be") {
        videoId = u.pathname.slice(1);
      } else if (u.pathname.startsWith("/watch")) {
        videoId = u.searchParams.get("v");
      } else if (u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.split("/embed/")[1]?.split(/[?/]/)[0] ?? null;
      } else if (u.pathname.startsWith("/shorts/")) {
        videoId = u.pathname.split("/shorts/")[1]?.split(/[?/]/)[0] ?? null;
      }
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    if (domain === "vimeo.com") {
      const match = u.pathname.match(/\/(\d+)/);
      if (match?.[1]) return `https://player.vimeo.com/video/${match[1]}`;
    }

    if (domain === "dailymotion.com") {
      const match = u.pathname.match(/\/video\/([a-zA-Z0-9]+)/);
      if (match?.[1])
        return `https://www.dailymotion.com/embed/video/${match[1]}`;
    }

    if (domain === "loom.com") {
      const match = u.pathname.match(/\/share\/([a-f0-9]+)/);
      if (match?.[1]) return `https://www.loom.com/embed/${match[1]}`;
    }
  } catch {
    // fall through
  }
  return null;
}

interface VideoDetection {
  isVideo: boolean;
  embedUrl: string | null;
  duration: number | null;
  description: string | null;
  publishedAt: string | null;
}

function detectVideoContent(
  $: cheerio.CheerioAPI,
  domain: string,
): VideoDetection {
  const ogType = $('meta[property="og:type"]').attr("content") ?? "";
  const hasOgVideo = !!$('meta[property="og:video"]').attr("content") ||
    !!$('meta[property="og:video:url"]').attr("content");
  const isOgVideo = ogType.startsWith("video");

  let duration: number | null = null;
  let embedFromMeta: string | null = null;
  let ldDescription: string | null = null;
  let ldPublishedAt: string | null = null;

  const ldJsonScripts = $('script[type="application/ld+json"]');
  let hasVideoObject = false;
  ldJsonScripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "VideoObject") {
          hasVideoObject = true;
          if (item.embedUrl) embedFromMeta = item.embedUrl;
          if (item.description) ldDescription = item.description;
          if (item.uploadDate) ldPublishedAt = item.uploadDate;
          else if (item.datePublished) ldPublishedAt = item.datePublished;
          if (item.duration) {
            const match = String(item.duration).match(
              /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/,
            );
            if (match) {
              duration =
                (parseInt(match[1] ?? "0") * 3600) +
                (parseInt(match[2] ?? "0") * 60) +
                parseInt(match[3] ?? "0");
            }
          }
        }
      }
    } catch {
      // invalid JSON-LD
    }
  });

  const isVideoDomain = VIDEO_DOMAINS.has(domain);
  const isVideo = isVideoDomain || isOgVideo || hasOgVideo || hasVideoObject;

  return {
    isVideo,
    embedUrl: embedFromMeta,
    duration,
    description: ldDescription,
    publishedAt: ldPublishedAt,
  };
}

interface OEmbedData {
  title: string | null;
  thumbnailUrl: string | null;
  authorName: string | null;
}

const OEMBED_ENDPOINTS: Record<string, string> = {
  "youtube.com": "https://www.youtube.com/oembed",
  "youtu.be": "https://www.youtube.com/oembed",
  "vimeo.com": "https://vimeo.com/api/oembed.json",
  "dailymotion.com": "https://www.dailymotion.com/services/oembed",
};

async function fetchOEmbed(
  url: string,
  domain: string,
): Promise<OEmbedData | null> {
  const endpoint = OEMBED_ENDPOINTS[domain];
  if (!endpoint) return null;

  try {
    const oembedUrl = `${endpoint}?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    return {
      title: data.title ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
      authorName: data.author_name ?? null,
    };
  } catch {
    return null;
  }
}

export async function extractMetadata(url: string): Promise<ArticleDraft> {
  const sourceDomain = deriveSourceDomain(url);
  const emptyDraft: ArticleDraft = {
    url,
    title: null,
    description: null,
    ogImage: null,
    favicon: null,
    sourceDomain,
    publishedAt: null,
    contentType: ContentType.ARTICLE,
    videoEmbedUrl: null,
    videoDuration: null,
  };

  try {
    const oembed = await fetchOEmbed(url, sourceDomain);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "AgentNewsBot/1.0",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+cb",
      },
    });
    if (!response.ok && !oembed) return emptyDraft;

    const html = response.ok ? await response.text() : "";
    const $ = cheerio.load(html);

    const scrapedTitle =
      $('meta[property="og:title"]').attr("content") ??
      $("title").text() ??
      null;

    const description =
      $('meta[property="og:description"]').attr("content") ??
      $('meta[name="description"]').attr("content") ??
      null;

    const scrapedOgImage =
      $('meta[property="og:image"]').attr("content") ?? null;

    let favicon =
      $('link[rel="icon"]').attr("href") ??
      $('link[rel="shortcut icon"]').attr("href") ??
      null;

    if (favicon && !favicon.startsWith("http")) {
      try {
        favicon = new URL(favicon, url).href;
      } catch {
        favicon = null;
      }
    }
    favicon ??= `https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=32`;

    const video = detectVideoContent($, sourceDomain);
    const contentType = video.isVideo ? ContentType.VIDEO : ContentType.ARTICLE;
    const videoEmbedUrl =
      video.embedUrl ?? extractVideoEmbedUrl(url, sourceDomain);

    const publishedAt =
      video.publishedAt ??
      $('meta[property="article:published_time"]').attr("content") ??
      $('meta[name="date"]').attr("content") ??
      $('meta[property="og:article:published_time"]').attr("content") ??
      null;

    const finalDescription = video.description ?? description;

    const title = oembed?.title ?? scrapedTitle;
    const ogImage = scrapedOgImage ?? oembed?.thumbnailUrl ?? null;

    return {
      url,
      title: title ?? null,
      description: finalDescription ?? null,
      ogImage,
      favicon,
      sourceDomain,
      publishedAt,
      contentType,
      videoEmbedUrl: contentType === ContentType.VIDEO ? videoEmbedUrl : null,
      videoDuration: contentType === ContentType.VIDEO ? video.duration : null,
    };
  } catch {
    return emptyDraft;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createArticle(
  db: PrismaClient,
  input: {
    url: string;
    title: string;
    description?: string | null;
    ogImage?: string | null;
    favicon?: string | null;
    sourceDomain?: string;
    publishedAt?: string | null;
    tags?: string[];
    summary?: string | null;
    contentType?: ContentType;
    videoEmbedUrl?: string | null;
    videoDuration?: number | null;
  },
  userId: string,
) {
  const sourceDomain = input.sourceDomain ?? deriveSourceDomain(input.url);
  const favicon =
    input.favicon ??
    `https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=32`;

  const company = await db.company.upsert({
    where: { domain: sourceDomain },
    update: {},
    create: {
      name: domainToName(sourceDomain),
      domain: sourceDomain,
      logoUrl: `https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=128`,
    },
  });

  const article = await db.article.create({
    data: {
      url: input.url,
      title: input.title,
      description: input.description ?? null,
      summary: input.summary ?? null,
      ogImage: input.ogImage ?? null,
      favicon,
      sourceDomain,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      submittedById: userId,
      companyId: company.id,
      contentType: input.contentType ?? ContentType.ARTICLE,
      videoEmbedUrl: input.videoEmbedUrl ?? null,
      videoDuration: input.videoDuration ?? null,
    },
  });

  if (input.tags && input.tags.length > 0) {
    for (const tagName of input.tags) {
      const slug = slugify(tagName);
      const tag = await db.tag.upsert({
        where: { slug },
        update: {},
        create: { name: tagName, slug },
      });
      await db.articleTag.create({
        data: { articleId: article.id, tagId: tag.id },
      });
    }
  }

  return db.article.findUniqueOrThrow({
    where: { id: article.id },
    include: {
      tags: { include: { tag: true } },
      submittedBy: { select: { name: true } },
      company: true,
    },
  });
}

export async function listArticles(
  db: PrismaClient,
  input: {
    cursor?: { publishedAt: Date; id: string };
    limit?: number;
    tagSlug?: string;
    contentType?: ContentType;
  },
) {
  const limit = input.limit ?? 20;

  const where: Prisma.ArticleWhereInput = {};

  if (input.contentType) {
    where.contentType = input.contentType;
  }

  if (input.tagSlug) {
    where.tags = { some: { tag: { slug: input.tagSlug } } };
  }

  if (input.cursor) {
    where.OR = [
      { publishedAt: { lt: input.cursor.publishedAt } },
      {
        publishedAt: input.cursor.publishedAt,
        id: { lt: input.cursor.id },
      },
    ];
  }

  const articles = await db.article.findMany({
    where,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    take: limit + 1,
    include: { tags: { include: { tag: true } }, submittedBy: { select: { name: true } } },
  });

  const hasMore = articles.length > limit;
  const items = hasMore ? articles.slice(0, limit) : articles;
  const lastItem = items[items.length - 1]!;
  const nextCursor = hasMore
    ? { publishedAt: lastItem.publishedAt ?? lastItem.createdAt, id: lastItem.id }
    : undefined;

  return { items, nextCursor };
}

export async function searchArticles(
  db: PrismaClient,
  input: {
    query: string;
    tagSlug?: string;
    limit?: number;
  },
) {
  const limit = input.limit ?? 20;

  const tagFilter = input.tagSlug
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "ArticleTag" at2
        JOIN "Tag" t ON t.id = at2."tagId"
        WHERE at2."articleId" = a.id AND t.slug = ${input.tagSlug}
      )`
    : Prisma.empty;

  // Layer 1: full-text search
  const words = input.query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  const tsQuery = words
    .map((w, i) => (i === words.length - 1 ? `${w}:*` : w))
    .join(" & ");

  if (tsQuery) {
    const results = await db.$queryRaw<
      Array<{
        id: string;
        url: string;
        title: string;
        description: string | null;
        ogImage: string | null;
        favicon: string | null;
        sourceDomain: string;
        publishedAt: Date | null;
        submittedById: string;
        createdAt: Date;
        updatedAt: Date;
        rank: number;
        submittedByName: string | null;
      }>
    >(Prisma.sql`
      SELECT a.id, a.url, a.title, a.description, a."ogImage", a.favicon, a."sourceDomain", a."publishedAt", a."submittedById", a."createdAt", a."updatedAt", ts_rank(a."searchVector", to_tsquery('english', ${tsQuery})) AS rank, u.name AS "submittedByName"
      FROM "Article" a
      LEFT JOIN "user" u ON u.id = a."submittedById"
      WHERE a."searchVector" @@ to_tsquery('english', ${tsQuery})
      ${tagFilter}
      ORDER BY rank DESC
      LIMIT ${limit}
    `);

    if (results.length > 0) {
      const articleIds = results.map((r) => r.id);
      const articleTags = await db.articleTag.findMany({
        where: { articleId: { in: articleIds } },
        include: { tag: true },
      });
      const tagsByArticle = new Map<string, Array<{ tag: { id: string; name: string; slug: string } }>>();
      for (const at of articleTags) {
        const existing = tagsByArticle.get(at.articleId) ?? [];
        existing.push({ tag: at.tag });
        tagsByArticle.set(at.articleId, existing);
      }

      return results.map((r) => ({
        ...r,
        tags: tagsByArticle.get(r.id) ?? [],
        submittedBy: r.submittedByName ? { name: r.submittedByName } : null,
      }));
    }
  }

  // Layer 2: trigram fallback
  const trigramResults = await db.$queryRaw<
    Array<{
      id: string;
      url: string;
      title: string;
      description: string | null;
      ogImage: string | null;
      favicon: string | null;
      sourceDomain: string;
      publishedAt: Date | null;
      submittedById: string;
      createdAt: Date;
      updatedAt: Date;
      similarity: number;
      submittedByName: string | null;
    }>
  >(Prisma.sql`
    SELECT a.id, a.url, a.title, a.description, a."ogImage", a.favicon, a."sourceDomain", a."publishedAt", a."submittedById", a."createdAt", a."updatedAt", similarity(a.title, ${input.query}) AS similarity, u.name AS "submittedByName"
    FROM "Article" a
    LEFT JOIN "user" u ON u.id = a."submittedById"
    WHERE similarity(a.title, ${input.query}) > 0.1
    ${tagFilter}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  const articleIds = trigramResults.map((r) => r.id);
  const articleTags = await db.articleTag.findMany({
    where: { articleId: { in: articleIds } },
    include: { tag: true },
  });
  const tagsByArticle = new Map<string, Array<{ tag: { id: string; name: string; slug: string } }>>();
  for (const at of articleTags) {
    const existing = tagsByArticle.get(at.articleId) ?? [];
    existing.push({ tag: at.tag });
    tagsByArticle.set(at.articleId, existing);
  }

  return trigramResults.map((r) => ({
    ...r,
    tags: tagsByArticle.get(r.id) ?? [],
    submittedBy: r.submittedByName ? { name: r.submittedByName } : null,
  }));
}

export async function getArticleById(db: PrismaClient, id: string) {
  return db.article.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      submittedBy: { select: { name: true } },
      company: true,
    },
  });
}

export async function getArticleByUrl(db: PrismaClient, url: string) {
  return db.article.findUnique({
    where: { url },
    include: {
      tags: { include: { tag: true } },
      submittedBy: { select: { name: true } },
      company: true,
    },
  });
}

export async function listTags(
  db: PrismaClient,
  contentType?: ContentType,
) {
  if (contentType) {
    const tags = await db.tag.findMany({
      where: {
        articles: { some: { article: { contentType } } },
      },
      include: {
        articles: {
          where: { article: { contentType } },
          select: { articleId: true },
        },
      },
      orderBy: { articles: { _count: "desc" } },
    });
    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      count: t.articles.length,
    }));
  }

  const tags = await db.tag.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { articles: { _count: "desc" } },
  });
  return tags.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    count: t._count.articles,
  }));
}

export async function updateArticleSummary(
  db: PrismaClient,
  input: { articleId?: string; url?: string; summary: string },
) {
  const where = input.articleId
    ? { id: input.articleId }
    : input.url
      ? { url: input.url }
      : null;

  if (!where) {
    throw new Error("Either articleId or url must be provided");
  }

  return db.article.update({
    where,
    data: { summary: input.summary },
    include: {
      tags: { include: { tag: true } },
      submittedBy: { select: { name: true } },
      company: true,
    },
  });
}

export async function listCompanies(db: PrismaClient) {
  return db.company.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { articles: { _count: "desc" } },
  });
}

export async function getCompanyByDomain(db: PrismaClient, domain: string) {
  return db.company.findUnique({
    where: { domain },
    include: {
      articles: {
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
        include: {
          tags: { include: { tag: true } },
          submittedBy: { select: { name: true } },
        },
      },
    },
  });
}

export async function getRelatedArticles(
  db: PrismaClient,
  articleId: string,
  tagIds: string[],
  excludeIds: string[],
  limit: number = 3,
) {
  if (tagIds.length === 0) return [];

  const allExcluded = [articleId, ...excludeIds];

  const results = await db.$queryRaw<
    Array<{
      id: string;
      url: string;
      title: string;
      description: string | null;
      ogImage: string | null;
      favicon: string | null;
      sourceDomain: string;
      publishedAt: Date | null;
      createdAt: Date;
      sharedTags: bigint;
    }>
  >(Prisma.sql`
    SELECT a.id, a.url, a.title, a.description, a."ogImage", a.favicon,
           a."sourceDomain", a."publishedAt", a."createdAt",
           COUNT(at2."tagId") AS "sharedTags"
    FROM "Article" a
    JOIN "ArticleTag" at2 ON at2."articleId" = a.id
    WHERE at2."tagId" = ANY(${tagIds}::uuid[])
      AND a.id != ALL(${allExcluded}::uuid[])
    GROUP BY a.id
    ORDER BY "sharedTags" DESC, a."createdAt" DESC
    LIMIT ${limit}
  `);

  return results.map((r) => ({ ...r, sharedTags: Number(r.sharedTags) }));
}
