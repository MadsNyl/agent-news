"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function ConsentForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const clientId = searchParams.get("client_id") ?? "Unknown app";
  const scope = searchParams.get("scope") ?? "";
  const scopes = scope.split(" ").filter(Boolean);
  const oauthQuery = searchParams.toString();

  async function handleConsent(accept: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept, oauth_query: oauthQuery }),
      });

      const data = (await res.json()) as {
        redirect?: boolean;
        url?: string;
        redirect_uri?: string;
      };
      const redirectUrl = data.url ?? data.redirect_uri;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 pt-24 sm:pt-32">
      <h1 className="font-heading text-2xl font-black text-foreground">
        Authorize application
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{clientId}</span> wants
        access to your account.
      </p>

      {scopes.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-foreground">
            Requested permissions
          </p>
          <ul className="mt-2 space-y-1.5">
            {scopes.map((s) => (
              <li
                key={s}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="text-primary">&#10003;</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <button
          onClick={() => handleConsent(true)}
          disabled={loading}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Authorizing..." : "Allow"}
        </button>
        <button
          onClick={() => handleConsent(false)}
          disabled={loading}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentForm />
    </Suspense>
  );
}
