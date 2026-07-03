// @ts-nocheck — MCP SDK + Better Auth OAuth generics exceed TS instantiation depth
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { db } from "~/server/db";
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
        "Submit an external article. Provide the URL and metadata directly. Requires authentication.",
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
