import { articleRouter } from "~/server/api/routers/article";
import { companyRouter } from "~/server/api/routers/company";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  article: articleRouter,
  company: companyRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
