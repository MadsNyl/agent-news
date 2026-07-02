"use client";

import { authClient } from "~/server/better-auth/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function NavBar() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  return (
    <nav className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-0">
      <Link
        href="/"
        className="font-heading text-lg font-black tracking-tight text-foreground"
      >
        Agent News
      </Link>

      <div className="flex items-center gap-3">
        {isPending ? (
          <div className="h-8 w-16 animate-pulse rounded bg-secondary" />
        ) : session ? (
          <>
            <Link
              href="/submit"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Submit
            </Link>
            <button
              onClick={async () => {
                await authClient.signOut();
                router.refresh();
              }}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
