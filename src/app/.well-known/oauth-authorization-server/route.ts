const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export async function GET() {
  const res = await fetch(`${baseUrl}/api/auth/.well-known/oauth-authorization-server`);
  const metadata = await res.json() as Record<string, unknown>;

  metadata.registration_endpoint = `${baseUrl}/api/auth/oauth2/register`;

  return Response.json(metadata, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
