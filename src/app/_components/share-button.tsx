"use client";

import { useCallback, useState } from "react";
import { api } from "~/trpc/react";
import { Share, Check } from "~/components/icons";

export function ShareButton({ title, articleId }: { title: string; articleId: string }) {
  const [copied, setCopied] = useState(false);
  const trackShare = api.article.trackShare.useMutation();

  const handleShare = useCallback(async () => {
    const appUrl = window.location.origin;
    const url = `${appUrl}/r/${articleId}`;

    trackShare.mutate({ id: articleId });

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [title, articleId, trackShare]);

  return (
    <button
      onClick={handleShare}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
    >
      {copied ? <Check size={16} /> : <Share size={16} />}
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
