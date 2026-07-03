# Article Detail Pages, Companies & Summary Support

## Overview

Extend agent-news with article detail pages, AI-generated summaries, SEO-optimized sharing, and a company directory derived from article source domains.

## Schema Changes

### Article model — add field

- `summary` — `String?` (nullable, no length limit). Stores an AI-generated summary of the article.
- `companyId` — `String?` (nullable FK to Company). Links to the auto-created company.
- `company` — relation to Company.

### New Company model

| Field       | Type       | Notes                                      |
|-------------|------------|--------------------------------------------|
| `id`        | `String`   | UUID, `gen_random_uuid()`                  |
| `name`      | `String`   | Derived from domain (e.g. "TechCrunch")    |
| `domain`    | `String`   | Unique. The raw source domain.             |
| `logoUrl`   | `String?`  | Defaults to Google S2 favicon URL at 128px |
| `createdAt` | `DateTime` | Auto-set                                   |
| `updatedAt` | `DateTime` | Auto-updated                               |

Relations: `Company` has `articles Article[]`.

### Auto-creation logic

When `createArticle()` runs, check if a Company exists for the article's `sourceDomain`. If not, create one:
- `name`: strip common TLDs, capitalize (e.g. `techcrunch.com` → `TechCrunch`)
- `domain`: raw `sourceDomain` value
- `logoUrl`: `https://www.google.com/s2/favicons?domain={domain}&sz=128`

Link the new article to the company via `companyId`.

### Migration for existing data

A migration script creates Company records for all distinct `sourceDomain` values in existing articles and backfills `companyId`.

## Routing

### `/articles/[id]` — Article detail page

Layout inspired by Replit blog — clean, centered, single-column (~700px max-width).

**Sections top to bottom:**
1. **Hero image**: Full-width OG image (with fallback placeholder if none)
2. **Title**: Large heading
3. **Metadata row**: Source domain (with favicon) · published date · submitter name
4. **Tags**: Tag pills
5. **Summary**: Prominent paragraph (shown only if available)
6. **Action buttons**: Side by side
   - "Share" — copies the detail page URL via navigator.share / clipboard fallback
   - "Read Article →" — opens original URL in new tab
7. **"More from [Company]"**: Up to 3 other articles from the same company (hidden if none)
8. **"Related Articles"**: Up to 3 articles that share at least one tag with the current article, ordered by number of shared tags descending then by `createdAt` descending. Excludes articles already shown in "More from [Company]". Hidden if none.

### `/companies` — Companies grid

- Grid of company cards: logo (128px from `logoUrl`) + company name + article count
- Sorted by article count descending
- Cards link to `/companies/[domain]`

### `/companies/[domain]` — Company detail page

- Header: large logo + company name
- Full list of articles from this company using existing `ArticleEntry` components
- Dynamic metadata (company name as title)

### Navigation

Add "Companies" link to the NavBar alongside existing links.

## SEO / Share Metadata

### Article detail page — dynamic `generateMetadata`

```ts
{
  title: article.title,
  description: article.summary ?? article.description,
  openGraph: {
    title: article.title,
    description: article.summary ?? article.description,
    images: article.ogImage ? [article.ogImage] : [],
    type: "article",
    publishedTime: article.publishedAt?.toISOString(),
  },
  twitter: {
    card: "summary_large_image",
    title: article.title,
    description: article.summary ?? article.description,
    images: article.ogImage ? [article.ogImage] : [],
  },
}
```

When someone shares an article detail URL, the preview shows the article's own title, summary, and OG image — but the link routes to the Agent News site.

### Company detail page — dynamic `generateMetadata`

```ts
{
  title: `${company.name} — Agent News`,
  description: `Articles from ${company.name} about AI agent implementations in enterprise.`,
}
```

## MCP Tool Changes

### Modified: `submit_article`

Add optional `summary` parameter to the input schema:
```ts
summary: z.string().optional().describe(
  "A short and concise summary to give the reader a brief insight into what the article is about"
)
```

The tool's `createArticle` call now also triggers Company auto-creation.

### New: `update_article_summary`

- **Input**: `articleId` (string, UUID) OR `url` (string), plus `summary` (string, required)
- **Summary Zod description**: "A short and concise summary to give the reader a brief insight into what the article is about"
- **Auth**: Requires OAuth (same as `submit_article`)
- **Returns**: Updated article object

## Company Logo Strategy

Use Google S2 Favicon API as the default: `https://www.google.com/s2/favicons?domain={domain}&sz=128`

- Free, no API key, reliable
- Returns the site's favicon at 128px
- Good enough for company cards and detail pages
- `logoUrl` is stored on the Company record and can be manually overridden later if needed

## What's NOT in scope

- No MCP CRUD tools for companies (companies are auto-managed)
- No company description/bio field
- No article slugs (using UUID in URLs)
- No image processing or watermarking for shares
- No search on the companies page (just a sorted grid)
