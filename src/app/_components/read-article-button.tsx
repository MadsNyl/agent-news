"use client";

import { api } from "~/trpc/react";

export function ReadArticleButton({ url, articleId }: { url: string; articleId: string }) {
  const trackRead = api.article.trackRead.useMutation();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackRead.mutate({ id: articleId })}
      className="flex-1 rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      Read Article &rarr;
    </a>
  );
}
