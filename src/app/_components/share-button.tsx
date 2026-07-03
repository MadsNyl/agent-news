"use client";

import { useCallback, useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;

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
  }, [title]);

  return (
    <button
      onClick={handleShare}
      className="flex-1 rounded-md bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
