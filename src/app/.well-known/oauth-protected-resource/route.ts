import { protectedResourceHandler } from "mcp-handler";

const handler = protectedResourceHandler({
  authServerUrls: [new URL("/api/auth", process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").href],
  resourceUrl: new URL("/api/mcp", process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").href,
});

export { handler as GET };
