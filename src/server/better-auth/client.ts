import { createAuthClient } from "better-auth/react";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  plugins: [oauthProviderClient()],
});

export type Session = typeof authClient.$Infer.Session;
