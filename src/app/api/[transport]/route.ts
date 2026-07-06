// @ts-nocheck — MCP SDK + Better Auth OAuth generics exceed TS instantiation depth
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { db } from "~/server/db";
import { ContentType } from "../../../../generated/prisma";
import {
  searchArticles,
  createArticle,
  listTags,
  getArticleById,
  getArticleByUrl,
  updateArticleSummary,
} from "~/server/services/article";

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000";

const jwks = createRemoteJWKSet(
  new URL("/api/auth/jwks", baseUrl),
);

async function verifyToken(_req, bearerToken) {
  if (!bearerToken) return undefined;

  try {
    const { payload } = await jwtVerify(bearerToken, jwks);

    return {
      token: bearerToken,
      clientId: payload.azp ?? "",
      scopes: typeof payload.scope === "string" ? payload.scope.split(" ") : [],
      expiresAt: payload.exp,
      extra: { userId: payload.sub },
    };
  } catch {
    return undefined;
  }
}

function initServer(server) {
  server.registerTool(
    "search_articles",
    {
      title: "Search Articles",
      description:
        "Search for articles about AI agent implementations in enterprise. Uses full-text search with fuzzy fallback.",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        tagSlug: z
          .string()
          .optional()
          .describe("Filter by tag slug, e.g. 'developer-tools'"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe("Max results (default 20)"),
      }),
    },
    async ({ query, tagSlug, limit }) => {
      const results = await searchArticles(db, { query, tagSlug, limit });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "submit_article",
    {
      title: "Submit Article",
      description:
        "Submit a written article. Provide the URL and metadata directly. For videos, use submit_video instead. Requires authentication.",
      inputSchema: z.object({
        url: z.string().url().describe("Article URL"),
        title: z.string().describe("Article title"),
        description: z
          .string()
          .optional()
          .describe("Article description"),
        ogImage: z.string().optional().describe("OG image URL"),
        favicon: z.string().optional().describe("Favicon URL"),
        sourceDomain: z.string().optional().describe("Source domain name"),
        publishedAt: z.string().optional().describe("ISO date string"),
        tags: z.array(z.string()).optional().describe("Tags to apply"),
        summary: z
          .string()
          .optional()
          .describe(
            "A short and concise summary to give the reader a brief insight into what the article is about",
          ),
      }),
    },
    async (input, { authInfo }) => {
      const userId = authInfo?.extra?.userId;
      if (!userId) {
        return {
          content: [{ type: "text", text: "Authentication required. Please connect with OAuth first." }],
          isError: true,
        };
      }

      const article = await createArticle(db, input, userId);
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

  server.registerTool(
    "submit_video",
    {
      title: "Submit Video",
      description:
        "Submit a video from YouTube, Vimeo, Dailymotion, Loom, or other video platforms. Provide the URL and metadata directly. For written articles, use submit_article instead. Requires authentication.",
      inputSchema: z.object({
        url: z.string().url().describe("Video URL (e.g. https://www.youtube.com/watch?v=...)"),
        title: z.string().describe("Video title"),
        description: z
          .string()
          .optional()
          .describe("Video description"),
        ogImage: z
          .string()
          .optional()
          .describe("Thumbnail image URL"),
        favicon: z.string().optional().describe("Favicon URL"),
        sourceDomain: z.string().optional().describe("Source domain name"),
        publishedAt: z.string().optional().describe("ISO date string of when the video was published"),
        tags: z.array(z.string()).optional().describe("Tags to apply"),
        summary: z
          .string()
          .optional()
          .describe(
            "A short and concise summary to give the viewer a brief insight into what the video covers",
          ),
        videoEmbedUrl: z
          .string()
          .optional()
          .describe("Embeddable video URL (e.g. https://www.youtube.com/embed/VIDEO_ID). Auto-derived from URL for YouTube, Vimeo, Dailymotion, and Loom if omitted"),
        videoDuration: z
          .number()
          .int()
          .optional()
          .describe("Video duration in seconds"),
      }),
    },
    async (input, { authInfo }) => {
      const userId = authInfo?.extra?.userId;
      if (!userId) {
        return {
          content: [{ type: "text", text: "Authentication required. Please connect with OAuth first." }],
          isError: true,
        };
      }

      const article = await createArticle(
        db,
        { ...input, contentType: ContentType.VIDEO },
        userId,
      );
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

  server.registerTool(
    "list_tags",
    {
      title: "List Tags",
      description: "List all available tags with article counts.",
      inputSchema: z.object({}),
    },
    async () => {
      const tags = await listTags(db);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tags, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_article",
    {
      title: "Get Article",
      description: "Get a single article by ID or URL.",
      inputSchema: z.object({
        id: z.string().optional().describe("Article UUID"),
        url: z.string().optional().describe("Article URL"),
      }),
    },
    async ({ id, url }) => {
      let article = null;
      if (id) article = await getArticleById(db, id);
      else if (url) article = await getArticleByUrl(db, url);

      if (!article) {
        return {
          content: [{ type: "text", text: "Article not found" }],
        };
      }
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

  server.registerTool(
    "update_article",
    {
      title: "Update Article",
      description:
        "Update an article you submitted. You can only update articles you own.",
      inputSchema: z.object({
        id: z.string().uuid().describe("Article UUID"),
        title: z.string().optional().describe("New title"),
        description: z.string().optional().describe("New description"),
        summary: z.string().optional().describe("New summary"),
        ogImage: z.string().optional().describe("New OG image URL"),
        favicon: z.string().optional().describe("New favicon URL"),
        tags: z.array(z.string()).optional().describe("Replace tags with these"),
      }),
    },
    async ({ id, tags, ...updates }, { authInfo }) => {
      const userId = authInfo?.extra?.userId;
      if (!userId) {
        return {
          content: [{ type: "text", text: "Authentication required." }],
          isError: true,
        };
      }

      const article = await db.article.findUnique({ where: { id } });
      if (!article) {
        return {
          content: [{ type: "text", text: "Article not found." }],
          isError: true,
        };
      }
      if (article.submittedById !== userId) {
        return {
          content: [{ type: "text", text: "You can only update articles you submitted." }],
          isError: true,
        };
      }

      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) data[key] = value;
      }

      if (tags) {
        await db.articleTag.deleteMany({ where: { articleId: id } });
        for (const tagName of tags) {
          const tag = await db.tag.upsert({
            where: { slug: tagName.toLowerCase().replace(/\s+/g, "-") },
            create: { name: tagName, slug: tagName.toLowerCase().replace(/\s+/g, "-") },
            update: {},
          });
          await db.articleTag.create({ data: { articleId: id, tagId: tag.id } });
        }
      }

      const updated = Object.keys(data).length > 0
        ? await db.article.update({ where: { id }, data, include: { tags: { include: { tag: true } }, company: true } })
        : await db.article.findUnique({ where: { id }, include: { tags: { include: { tag: true } }, company: true } });

      return {
        content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
      };
    },
  );

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
}

const mcpHandler = createMcpHandler(initServer, {}, {
  basePath: "/api",
  maxDuration: 60,
});

const handler = withMcpAuth(mcpHandler, verifyToken, { required: true });

export { handler as GET, handler as POST, handler as DELETE };
