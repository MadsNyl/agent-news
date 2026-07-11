"use client";

import { useState, useEffect } from "react";
import { Search } from "~/components/icons";

interface TagOption {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export function SearchBar({
  tags,
  onSearch,
  onTagSelect,
  activeTag,
  initialQuery,
  placeholder = "Search articles...",
}: {
  tags: TagOption[];
  onSearch: (query: string) => void;
  onTagSelect: (slug: string | null) => void;
  activeTag: string | null;
  initialQuery?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {tags.length > 0 && (
        <div className="relative">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {tags
              .filter((t) => t.count > 1 || activeTag === t.slug)
              .map((tag) => (
                <button
                  key={tag.slug}
                  onClick={() =>
                    onTagSelect(activeTag === tag.slug ? null : tag.slug)
                  }
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeTag === tag.slug
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
        </div>
      )}
    </div>
  );
}
