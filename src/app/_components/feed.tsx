"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { ArticleEntry } from "~/app/_components/article-entry";
import { SearchBar } from "~/app/_components/search-bar";

export function Feed() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchQuery = searchParams.get("q") ?? "";
  const activeTag = searchParams.get("tag") ?? null;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router],
  );

  const handleSearch = useCallback(
    (query: string) => {
      updateParams({ q: query || null });
    },
    [updateParams],
  );

  const handleTagSelect = useCallback(
    (slug: string | null) => {
      updateParams({ tag: slug });
    },
    [updateParams],
  );

  const tagsQuery = api.article.listTags.useQuery();

  const isSearching = searchQuery.length > 0;

  const listQuery = api.article.list.useInfiniteQuery(
    { limit: 20, tagSlug: activeTag ?? undefined },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !isSearching,
    },
  );

  const searchResults = api.article.search.useQuery(
    { query: searchQuery, tagSlug: activeTag ?? undefined },
    { enabled: isSearching },
  );

  const articles = isSearching
    ? searchResults.data ?? []
    : listQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const isLoading = isSearching ? searchResults.isLoading : listQuery.isLoading;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-6 lg:px-8">
      <header className="pb-6 pt-6 sm:pt-8">
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          Curated articles about real-world AI agent implementations in
          enterprise and business.
        </p>
      </header>

      <SearchBar
        tags={tagsQuery.data ?? []}
        onSearch={handleSearch}
        onTagSelect={handleTagSelect}
        activeTag={activeTag}
        initialQuery={searchQuery}
      />

      <main className="py-6 sm:py-8">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : articles.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No articles found.
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {articles.map((article) => (
                <ArticleEntry key={article.id} article={article} />
              ))}
            </div>
            <div className="hidden md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:gap-5">
              {articles.map((article) => (
                <ArticleEntry
                  key={article.id}
                  article={article}
                  variant="card"
                />
              ))}
            </div>
          </>
        )}

        {!isSearching && listQuery.hasNextPage && (
          <div className="flex justify-center pt-6">
            <button
              onClick={() => listQuery.fetchNextPage()}
              disabled={listQuery.isFetchingNextPage}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {listQuery.isFetchingNextPage ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-8">
        <p className="text-xs text-muted-foreground">
          All articles link to their original source.
        </p>
      </footer>
    </div>
  );
}
