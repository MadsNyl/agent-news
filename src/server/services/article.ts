import { type PrismaClient, Prisma } from "../../../generated/prisma";
import * as cheerio from "cheerio";

export type ArticleDraft = {
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
  sourceDomain: string;
  publishedAt: string | null;
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
  };

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "AgentNewsBot/1.0" },
    });
    if (!response.ok) return emptyDraft;

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content") ??
      $("title").text() ??
      null;

    const description =
      $('meta[property="og:description"]').attr("content") ??
      $('meta[name="description"]').attr("content") ??
      null;

    const ogImage = $('meta[property="og:image"]').attr("content") ?? null;

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

    const publishedAt =
      $('meta[property="article:published_time"]').attr("content") ??
      $('meta[name="date"]').attr("content") ??
      $('meta[property="og:article:published_time"]').attr("content") ??
      null;

    return {
      url,
      title: title ?? null,
      description: description ?? null,
      ogImage,
      favicon,
      sourceDomain,
      publishedAt,
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
  },
) {
  const limit = input.limit ?? 20;

  const where: Prisma.ArticleWhereInput = {};

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

export async function listTags(db: PrismaClient) {
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
