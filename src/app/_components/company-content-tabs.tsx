"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { ArticleEntry } from "~/app/_components/article-entry";

interface Article {
  id: string;
  url: string;
  title: string;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
  sourceDomain: string;
  publishedAt: Date | string | null;
  contentType: string;
  tags: Array<{ tag: { id: string; name: string; slug: string } }>;
  submittedBy?: { name: string } | null;
}

type Tab = "articles" | "videos";

export function CompanyContentTabs({ articles }: { articles: Article[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("type") as Tab) ?? "articles";

  const setTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "articles") {
        params.delete("type");
      } else {
        params.set("type", tab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const filtered = articles.filter((a) =>
    activeTab === "videos" ? a.contentType === "VIDEO" : a.contentType === "ARTICLE",
  );

  const articleCount = articles.filter((a) => a.contentType === "ARTICLE").length;
  const videoCount = articles.filter((a) => a.contentType === "VIDEO").length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "articles", label: "Articles", count: articleCount },
    { key: "videos", label: "Videos", count: videoCount },
  ];

  return (
    <>
      <LayoutGroup>
        <div className="flex gap-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {tab.count}
              </span>
              {activeTab === tab.key && (
                <motion.span
                  layoutId="company-tab-indicator"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      </LayoutGroup>

      <div className="pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {activeTab === "videos" ? "No videos found." : "No articles found."}
              </div>
            ) : (
              <>
                <div className="divide-y divide-border md:hidden">
                  {filtered.map((article) => (
                    <ArticleEntry key={article.id} article={article} />
                  ))}
                </div>
                <div className="hidden md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:gap-5">
                  {filtered.map((article) => (
                    <ArticleEntry key={article.id} article={article} variant="card" />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
