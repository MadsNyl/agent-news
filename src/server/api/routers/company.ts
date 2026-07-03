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
