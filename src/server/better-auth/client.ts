import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import type { auth } from "~/server/better-auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), oauthProviderClient()],
});

export type Session = typeof authClient.$Infer.Session;
