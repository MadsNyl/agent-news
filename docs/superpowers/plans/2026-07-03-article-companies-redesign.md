# Article Detail Pages, Companies & Summary Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add article detail pages with SEO metadata, AI-generated summaries via MCP, and a company directory derived from article source domains.

**Architecture:** Extend the Prisma schema with a `summary` field on Article and a new Company model. Auto-create Company records when articles are submitted. Add Next.js pages for article detail (`/articles/[id]`), companies grid (`/companies`), and company detail (`/companies/[domain]`). Add dynamic `generateMetadata` for SEO on detail pages. Extend MCP with `update_article_summary` tool and add `summary` to `submit_article`.

**Tech Stack:** Next.js 15 (App Router), Prisma 6, PostgreSQL, tRPC 11, MCP SDK, React 19, Tailwind CSS 4, shadcn/ui

## Global Constraints

- Database: PostgreSQL with Prisma ORM
- All new pages use App Router (RSC by default, `"use client"` only when needed)
- Follow existing code patterns: services in `src/server/services/`, tRPC routers in `src/server/api/routers/`
- Use existing `ArticleEntry` component where possible
- Company logos via Google S2 Favicon API: `https://www.google.com/s2/favicons?domain={domain}&sz=128`
- No hard character limit on summaries — Zod description guides agents

---

### Task 1: Schema Changes — Company Model & Article Summary

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Company` model with fields `id`, `name`, `domain` (unique), `logoUrl`, `createdAt`, `updatedAt`. `Article` model gains `summary String?` and `companyId String? @db.Uuid` with relation to Company.

- [ ] **Step 1: Add Company model and update Article model in Prisma schema**

In `prisma/schema.prisma`, add the Company model after the Article model, and add `summary`, `companyId`, and `company` to Article:

```prisma
model Article {
  id            String                   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  url           String                   @unique
  title         String
  description   String?
  summary       String?
  ogImage       String?
  favicon       String?
  sourceDomain  String
  publishedAt   DateTime?
  submittedById String
  companyId     String?                  @db.Uuid
  createdAt     DateTime                 @default(now())
  updatedAt     DateTime                 @updatedAt
  searchVector  Unsupported("tsvector")?

  submittedBy User         @relation(fields: [submittedById], references: [id])
  company     Company?     @relation(fields: [companyId], references: [id])
  tags        ArticleTag[]

  @@index([createdAt])
  @@index([searchVector], type: Gin)
  @@index([title(ops: raw("gin_trgm_ops"))], type: Gin)
  @@index([companyId])
}

model Company {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  domain    String   @unique
  logoUrl   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  articles Article[]
}
```

- [ ] **Step 2: Generate and apply the migration**

Run:
```bash
bunx prisma migrate dev --name add-company-and-summary
```

Expected: Migration applies successfully, creates `Company` table, adds `summary` and `companyId` columns to `Article`.

- [ ] **Step 3: Write a backfill script for existing articles**

Create `prisma/backfill-companies.ts`:

```ts
import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

function domainToName(domain: string): string {
  return domain
    .replace(/^www\./, "")
    .replace(/\.(com|org|net|io|co|ai|dev|tech|news|blog)$/i, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const domains = await db.article.findMany({
    select: { sourceDomain: true },
    distinct: ["sourceDomain"],
  });

  for (const { sourceDomain } of domains) {
    const company = await db.company.upsert({
      where: { domain: sourceDomain },
      update: {},
      create: {
        name: domainToName(sourceDomain),
        domain: sourceDomain,
        logoUrl: `https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=128`,
      },
    });

    await db.article.updateMany({
      where: { sourceDomain, companyId: null },
      data: { companyId: company.id },
    });
  }

  console.log(`Backfilled ${domains.length} companies`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
```

- [ ] **Step 4: Run the backfill script**

Run:
```bash
bunx tsx prisma/backfill-companies.ts
```

Expected: Output like `Backfilled N companies` with no errors.

- [ ] **Step 5: Verify in database**

Run:
```bash
bunx prisma studio
```

Check: Company table has entries, Article records have `companyId` populated.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ prisma/backfill-companies.ts
git commit -m "feat: add Company model and summary field to Article"
```

---

### Task 2: Article Service — Company Auto-Creation & Summary Update

**Files:**
- Modify: `src/server/services/article.ts`

**Interfaces:**
- Consumes: `Company` and updated `Article` Prisma models from Task 1
- Produces:
  - `createArticle()` now auto-creates/links Company via `sourceDomain`
  - `updateArticleSummary(db: PrismaClient, input: { articleId?: string; url?: string; summary: string }): Promise<Article>` — new function
  - `getArticleById()` and `getArticleByUrl()` now include `company` in their response
  - `listCompanies(db: PrismaClient): Promise<Array<{ id, name, domain, logoUrl, _count: { articles } }>>` — new function
  - `getCompanyByDomain(db: PrismaClient, domain: string): Promise<Company & { articles }>` — new function

- [ ] **Step 1: Add `domainToName` helper to `src/server/services/article.ts`**

Add this function near the top of the file, after `deriveSourceDomain`:

```ts
function domainToName(domain: string): string {
  return domain
    .replace(/^www\./, "")
    .replace(/\.(com|org|net|io|co|ai|dev|tech|news|blog)$/i, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
```

- [ ] **Step 2: Update `createArticle` to auto-create Company**

In `createArticle`, after computing `sourceDomain` and `favicon`, add company upsert logic before the `db.article.create` call. Then include `companyId` in the article creation:

```ts
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
```

- [ ] **Step 3: Update `getArticleById` and `getArticleByUrl` to include company**

```ts
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
```

- [ ] **Step 4: Add `updateArticleSummary` function**

Add at the end of `src/server/services/article.ts`:

```ts
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
```

- [ ] **Step 5: Add `listCompanies` function**

```ts
export async function listCompanies(db: PrismaClient) {
  return db.company.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { articles: { _count: "desc" } },
  });
}
```

- [ ] **Step 6: Add `getCompanyByDomain` function**

```ts
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
```

- [ ] **Step 7: Add `getRelatedArticles` function**

This fetches articles sharing tags with a given article, excluding a set of IDs (for "More from Company" dedup):

```ts
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
```

- [ ] **Step 8: Commit**

```bash
git add src/server/services/article.ts
git commit -m "feat: add company auto-creation, summary update, and related articles service functions"
```

---

### Task 3: MCP Tools — Summary on Submit & Update Summary Tool

**Files:**
- Modify: `src/app/api/[transport]/route.ts`

**Interfaces:**
- Consumes: `createArticle()` (updated, accepts `summary`), `updateArticleSummary()` from Task 2
- Produces: `submit_article` tool now accepts optional `summary`. New `update_article_summary` tool.

- [ ] **Step 1: Add `summary` to `submit_article` input schema**

In `src/app/api/[transport]/route.ts`, update the `submit_article` tool's `inputSchema` to add:

```ts
summary: z
  .string()
  .optional()
  .describe(
    "A short and concise summary to give the reader a brief insight into what the article is about",
  ),
```

Add it after the `tags` field in the `z.object({...})`.

- [ ] **Step 2: Add the import for `updateArticleSummary`**

Update the import from `~/server/services/article`:

```ts
import {
  searchArticles,
  createArticle,
  listTags,
  getArticleById,
  getArticleByUrl,
  updateArticleSummary,
} from "~/server/services/article";
```

- [ ] **Step 3: Register the `update_article_summary` tool**

Add after the `get_article` tool registration in `initServer`:

```ts
server.registerTool(
  "update_article_summary",
  {
    title: "Update Article Summary",
    description:
      "Add or update the summary of an existing article. Requires authentication.",
    inputSchema: z.object({
      articleId: z.string().uuid().optional().describe("Article UUID"),
      url: z.string().url().optional().describe("Article URL"),
      summary: z
        .string()
        .describe(
          "A short and concise summary to give the reader a brief insight into what the article is about",
        ),
    }),
  },
  async ({ articleId, url, summary }, { authInfo }) => {
    const userId = authInfo?.extra?.userId;
    if (!userId) {
      return {
        content: [
          {
            type: "text",
            text: "Authentication required. Please connect with OAuth first.",
          },
        ],
        isError: true,
      };
    }

    if (!articleId && !url) {
      return {
        content: [
          {
            type: "text",
            text: "Either articleId or url must be provided.",
          },
        ],
        isError: true,
      };
    }

    const article = await updateArticleSummary(db, {
      articleId,
      url,
      summary,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(article, null, 2),
        },
      ],
    };
  },
);
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/\[transport\]/route.ts
git commit -m "feat: add summary to submit_article and new update_article_summary MCP tool"
```

---

### Task 4: tRPC Router — Article Detail & Company Queries

**Files:**
- Modify: `src/server/api/routers/article.ts`
- Create: `src/server/api/routers/company.ts`
- Modify: `src/server/api/root.ts`

**Interfaces:**
- Consumes: `getArticleById()`, `getRelatedArticles()`, `listCompanies()`, `getCompanyByDomain()` from Task 2
- Produces: `article.getById` now returns article with company. New `company.list` and `company.getByDomain` tRPC procedures.

- [ ] **Step 1: Update the article router import to include `getRelatedArticles`**

In `src/server/api/routers/article.ts`, update imports:

```ts
import {
  extractMetadata,
  createArticle,
  listArticles,
  searchArticles,
  getArticleById,
  getRelatedArticles,
  listTags,
} from "~/server/services/article";
```

- [ ] **Step 2: Add `getRelated` procedure to the article router**

Add after the `getById` procedure:

```ts
getRelated: publicProcedure
  .input(
    z.object({
      articleId: z.string().uuid(),
      tagIds: z.array(z.string().uuid()),
      excludeIds: z.array(z.string().uuid()).optional(),
      limit: z.number().min(1).max(10).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    return getRelatedArticles(
      ctx.db,
      input.articleId,
      input.tagIds,
      input.excludeIds ?? [],
      input.limit ?? 3,
    );
  }),
```

- [ ] **Step 3: Create the company tRPC router**

Create `src/server/api/routers/company.ts`:

```ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  listCompanies,
  getCompanyByDomain,
} from "~/server/services/article";

export const companyRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return listCompanies(ctx.db);
  }),

  getByDomain: publicProcedure
    .input(z.object({ domain: z.string() }))
    .query(async ({ ctx, input }) => {
      return getCompanyByDomain(ctx.db, input.domain);
    }),
});
```

- [ ] **Step 4: Register the company router in the root router**

Read and modify `src/server/api/root.ts` to add the company router. Add the import:

```ts
import { companyRouter } from "~/server/api/routers/company";
```

And add `company: companyRouter` to the `createTRPCRouter` call alongside the existing `article: articleRouter`.

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/article.ts src/server/api/routers/company.ts src/server/api/root.ts
git commit -m "feat: add company tRPC router and related articles query"
```

---

### Task 5: Article Detail Page (`/articles/[id]`)

**Files:**
- Create: `src/app/articles/[id]/page.tsx`

**Interfaces:**
- Consumes: `getArticleById()`, `getRelatedArticles()` from Task 2 via direct Prisma calls (server component). `Article` type from existing `article-entry.tsx`.

- [ ] **Step 1: Create the article detail page**

Create `src/app/articles/[id]/page.tsx`:

```tsx
import { type Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getArticleById, getRelatedArticles } from "~/server/services/article";
import { ArticleEntry } from "~/app/_components/article-entry";
import { ShareButton } from "~/app/_components/share-button";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(db, id);
  if (!article) return {};

  const description = article.summary ?? article.description ?? "";

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      images: article.ogImage ? [article.ogImage] : [],
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.ogImage ? [article.ogImage] : [],
    },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(db, id);
  if (!article) notFound();

  const tagIds = article.tags.map((t) => t.tag.id);

  const companyArticles = article.company
    ? await db.article.findMany({
        where: {
          companyId: article.company.id,
          id: { not: article.id },
        },
        orderBy: [
          { publishedAt: { sort: "desc", nulls: "last" } },
          { id: "desc" },
        ],
        take: 3,
        include: {
          tags: { include: { tag: true } },
          submittedBy: { select: { name: true } },
        },
      })
    : [];

  const companyArticleIds = companyArticles.map((a) => a.id);
  const relatedArticles = await getRelatedArticles(
    db,
    article.id,
    tagIds,
    companyArticleIds,
    3,
  );

  const publishedAtStr =
    article.publishedAt instanceof Date
      ? article.publishedAt.toISOString()
      : article.publishedAt;

  return (
    <div className="mx-auto max-w-[700px] px-4 py-8 sm:py-12">
      {article.ogImage && (
        <div className="mb-8 overflow-hidden rounded-lg">
          <Image
            src={article.ogImage}
            alt=""
            width={700}
            height={394}
            className="w-full object-cover"
            unoptimized
            priority
          />
        </div>
      )}

      <h1
        className="font-heading text-2xl font-black leading-tight text-foreground sm:text-3xl"
        style={{ textWrap: "balance" }}
      >
        {article.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {article.favicon && (
            <Image
              src={article.favicon}
              alt=""
              width={16}
              height={16}
              className="rounded-sm"
              unoptimized
            />
          )}
          {article.company ? (
            <Link
              href={`/companies/${article.company.domain}`}
              className="hover:text-foreground transition-colors"
            >
              {article.company.name}
            </Link>
          ) : (
            <span>{article.sourceDomain}</span>
          )}
        </span>

        {publishedAtStr && (
          <>
            <span className="text-border">&middot;</span>
            <time dateTime={publishedAtStr}>
              {new Date(publishedAtStr).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </>
        )}

        {article.submittedBy?.name && (
          <>
            <span className="text-border">&middot;</span>
            <span>Submitted by {article.submittedBy.name}</span>
          </>
        )}
      </div>

      {article.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {article.tags.map(({ tag }) => (
            <Link
              key={tag.slug}
              href={`/?tag=${tag.slug}`}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      {article.summary && (
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          {article.summary}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <ShareButton title={article.title} />
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Read Article &rarr;
        </a>
      </div>

      {companyArticles.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-heading text-lg font-bold text-foreground">
            More from{" "}
            <Link
              href={`/companies/${article.company!.domain}`}
              className="hover:text-accent-foreground transition-colors"
            >
              {article.company!.name}
            </Link>
          </h2>
          <div className="mt-4 divide-y divide-border">
            {companyArticles.map((a) => (
              <ArticleEntry key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {relatedArticles.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-heading text-lg font-bold text-foreground">
            Related Articles
          </h2>
          <div className="mt-4 space-y-4">
            {relatedArticles.map((a) => (
              <Link
                key={a.id}
                href={`/articles/${a.id}`}
                className="group block rounded-lg border border-border p-4 transition-colors hover:border-muted-foreground/25"
              >
                <h3 className="font-heading text-sm font-bold text-foreground transition-colors group-hover:text-accent-foreground">
                  {a.title}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{a.sourceDomain}</span>
                  {a.publishedAt && (
                    <>
                      <span className="text-border">&middot;</span>
                      <time>
                        {new Date(a.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the ShareButton client component**

Create `src/app/_components/share-button.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [title]);

  return (
    <button
      onClick={handleShare}
      className="flex-1 rounded-md bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
```

- [ ] **Step 3: Update ArticleEntry to link to detail page**

In `src/app/_components/article-entry.tsx`, update both `ArticleCard` and `ArticleRow` components. Change the outer `<a>` tag's `href` from `article.url` to `/articles/${article.id}`. Remove `target="_blank"` and `rel="noopener noreferrer"` since it's now an internal link. Use Next.js `Link` component instead of `<a>`:

Add import at the top:
```ts
import Link from "next/link";
```

In `ArticleCard`, replace the outer `<a>` with:
```tsx
<Link
  href={`/articles/${article.id}`}
  className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors duration-150 ease-out hover:border-muted-foreground/25"
>
```

Close with `</Link>` instead of `</a>`.

In `ArticleRow`, replace the outer `<a>` with:
```tsx
<Link
  href={`/articles/${article.id}`}
  className="group flex gap-4 px-4 py-5 transition-colors duration-150 ease-out hover:bg-card"
>
```

Close with `</Link>` instead of `</a>`.

- [ ] **Step 4: Verify the article detail page works**

Run:
```bash
bun dev
```

Navigate to `http://localhost:3000`, click on an article, verify:
- Redirects to `/articles/{id}` detail page
- Hero image, title, metadata row, tags display correctly
- Share button copies URL / opens native share
- "Read Article →" opens original URL
- "More from [Company]" section shows (if applicable)
- "Related Articles" section shows (if applicable)

- [ ] **Step 5: Commit**

```bash
git add src/app/articles/\[id\]/page.tsx src/app/_components/share-button.tsx src/app/_components/article-entry.tsx
git commit -m "feat: add article detail page with SEO metadata, share, and related articles"
```

---

### Task 6: Companies Pages (`/companies` and `/companies/[domain]`)

**Files:**
- Create: `src/app/companies/page.tsx`
- Create: `src/app/companies/[domain]/page.tsx`
- Modify: `src/app/_components/nav-bar.tsx`

**Interfaces:**
- Consumes: `listCompanies()`, `getCompanyByDomain()` from Task 2 via direct Prisma calls.

- [ ] **Step 1: Create the companies grid page**

Create `src/app/companies/page.tsx`:

```tsx
import { type Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { db } from "~/server/db";
import { listCompanies } from "~/server/services/article";

export const metadata: Metadata = {
  title: "Companies — Agent News",
  description:
    "Companies publishing articles about AI agent implementations in enterprise.",
};

export default async function CompaniesPage() {
  const companies = await listCompanies(db);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-6 lg:px-8">
      <header className="pb-6 pt-6 sm:pt-8">
        <h1 className="font-heading text-2xl font-black text-foreground">
          Companies
        </h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          Sources publishing about AI agent implementations in enterprise.
        </p>
      </header>

      <main className="grid grid-cols-2 gap-4 pb-12 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {companies.map((company) => (
          <Link
            key={company.id}
            href={`/companies/${company.domain}`}
            className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-5 text-center transition-colors hover:border-muted-foreground/25"
          >
            <Image
              src={
                company.logoUrl ??
                `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128`
              }
              alt=""
              width={48}
              height={48}
              className="rounded-lg"
              unoptimized
            />
            <div>
              <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-accent-foreground">
                {company.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {company._count.articles}{" "}
                {company._count.articles === 1 ? "article" : "articles"}
              </p>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create the company detail page**

Create `src/app/companies/[domain]/page.tsx`:

```tsx
import { type Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getCompanyByDomain } from "~/server/services/article";
import { ArticleEntry } from "~/app/_components/article-entry";

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const company = await getCompanyByDomain(db, domain);
  if (!company) return {};

  return {
    title: `${company.name} — Agent News`,
    description: `Articles from ${company.name} about AI agent implementations in enterprise.`,
  };
}

export default async function CompanyDetailPage({ params }: Props) {
  const { domain } = await params;
  const company = await getCompanyByDomain(db, domain);
  if (!company) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-6 lg:px-8">
      <header className="flex items-center gap-4 pb-6 pt-6 sm:pt-8">
        <Image
          src={
            company.logoUrl ??
            `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128`
          }
          alt=""
          width={48}
          height={48}
          className="rounded-lg"
          unoptimized
        />
        <div>
          <h1 className="font-heading text-2xl font-black text-foreground">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.articles.length}{" "}
            {company.articles.length === 1 ? "article" : "articles"}
          </p>
        </div>
      </header>

      <main className="pb-12">
        <div className="divide-y divide-border md:hidden">
          {company.articles.map((article) => (
            <ArticleEntry key={article.id} article={article} />
          ))}
        </div>
        <div className="hidden md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:gap-5">
          {company.articles.map((article) => (
            <ArticleEntry key={article.id} article={article} variant="card" />
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add "Companies" link to the NavBar**

In `src/app/_components/nav-bar.tsx`, add a Companies link. Update the left side of the nav to include the link after the logo:

```tsx
<nav className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-0">
  <div className="flex items-center gap-6">
    <Link
      href="/"
      className="font-heading text-lg font-black tracking-tight text-foreground"
    >
      Agent News
    </Link>
    <Link
      href="/companies"
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      Companies
    </Link>
  </div>

  <div className="flex items-center gap-3">
    {/* ... existing auth buttons unchanged ... */}
  </div>
</nav>
```

- [ ] **Step 4: Verify both companies pages work**

Run:
```bash
bun dev
```

Navigate to `http://localhost:3000/companies`:
- Grid of company cards with logos, names, article counts
- Click a company → navigates to `/companies/{domain}`
- Company detail page shows header with logo and all articles
- NavBar shows "Companies" link on all pages

- [ ] **Step 5: Commit**

```bash
git add src/app/companies/ src/app/_components/nav-bar.tsx
git commit -m "feat: add companies grid and company detail pages with nav link"
```

---

### Task 7: Next.js Image Configuration & Final Polish

**Files:**
- Modify: `next.config.js` (or `next.config.ts`)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working image domains config for Google S2 favicons

- [ ] **Step 1: Check current next.config and add Google S2 domain**

Read the current `next.config.js` or `next.config.ts`. Add `www.google.com` to the `images.remotePatterns` array so Next.js Image can load Google S2 favicons:

```ts
images: {
  remotePatterns: [
    // ... existing patterns ...
    {
      protocol: "https",
      hostname: "www.google.com",
      pathname: "/s2/favicons/**",
    },
  ],
},
```

Note: The existing code already uses `unoptimized` on external images, so this may already work. Only add this if the Google S2 images fail to load without it.

- [ ] **Step 2: End-to-end verification**

Run `bun dev` and verify the full flow:

1. Home page → click article → article detail page with correct metadata
2. Article detail → "Share" button works (copies URL)
3. Article detail → "Read Article →" opens original URL
4. Article detail → "More from [Company]" section appears when applicable
5. Article detail → "Related Articles" section appears when applicable
6. Article detail → company name links to `/companies/[domain]`
7. Article detail → tag pills link to `/?tag={slug}`
8. NavBar → "Companies" link → companies grid with logos
9. Company card → company detail page with all articles
10. View page source on `/articles/[id]` — confirm OG meta tags are present

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore: image config and final polish"
```
