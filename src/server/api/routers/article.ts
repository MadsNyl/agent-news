import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  extractMetadata,
  createArticle,
  listArticles,
  searchArticles,
  getArticleById,
  getRelatedArticles,
  listTags,
} from "~/server/services/article";

function urlVariants(url: string): string[] {
  const withSlash = url.endsWith("/") ? url : `${url}/`;
  const withoutSlash = url.endsWith("/") ? url.slice(0, -1) : url;
  return [withSlash, withoutSlash];
}

export const articleRouter = createTRPCRouter({
  extractMetadata: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const variants = urlVariants(input.url);
      const existing = await ctx.db.article.findFirst({
        where: { url: { in: variants } },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This article has already been submitted.",
        });
      }
      return extractMetadata(input.url);
    }),

  create: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        title: z.string().min(1),
        description: z.string().nullish(),
        ogImage: z.string().nullish(),
        favicon: z.string().nullish(),
        sourceDomain: z.string().optional(),
        publishedAt: z.string().nullish(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const variants = urlVariants(input.url);
      const existing = await ctx.db.article.findFirst({
        where: { url: { in: variants } },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This article has already been submitted.",
        });
      }
      return createArticle(ctx.db, input, ctx.session.user.id);
    }),

  list: publicProcedure
    .input(
      z
        .object({
          cursor: z
            .object({
              publishedAt: z.date(),
              id: z.string(),
            })
            .optional(),
          limit: z.number().min(1).max(50).optional(),
          tagSlug: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return listArticles(ctx.db, input ?? {});
    }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        tagSlug: z.string().optional(),
        limit: z.number().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return searchArticles(ctx.db, input);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getArticleById(ctx.db, input.id);
    }),

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

  listTags: publicProcedure.query(async ({ ctx }) => {
    return listTags(ctx.db);
  }),
});
