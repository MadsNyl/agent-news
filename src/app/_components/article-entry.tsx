import Image from "next/image";
import Link from "next/link";
import { Play } from "~/components/icons";

interface Article {
  id: string;
  url: string;
  title: string;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
  sourceDomain: string;
  publishedAt: Date | string | null;
  contentType?: string;
  tags: Array<{ tag: { id: string; name: string; slug: string } }>;
  submittedBy?: { name: string } | null;
}

function timeAgo(dateInput: Date | string): string {
  const now = new Date();
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = [
    { label: "y", seconds: 31536000 },
    { label: "mo", seconds: 2592000 },
    { label: "d", seconds: 86400 },
    { label: "h", seconds: 3600 },
    { label: "m", seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) return `${count}${interval.label} ago`;
  }
  return "just now";
}

function ArticleCard({ article }: { article: Article }) {
  const publishedAtStr =
    article.publishedAt instanceof Date
      ? article.publishedAt.toISOString()
      : article.publishedAt;
  const isVideo = article.contentType === "VIDEO";

  return (
    <Link
      href={`/articles/${article.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors duration-150 ease-out hover:border-muted-foreground/25"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <Image
          src={article.ogImage ?? "/default.png"}
          alt=""
          width={600}
          height={338}
          className="h-full w-full object-cover transition-opacity duration-150 group-hover:opacity-80"
          unoptimized={!!article.ogImage}
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
              <Play weight="Filled" className="ml-0.5 h-5 w-5" />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2
          className="font-heading text-[0.9375rem] font-bold leading-snug text-foreground transition-colors duration-150 group-hover:text-accent-foreground"
          style={{ textWrap: "balance" }}
        >
          {article.title}
        </h2>

        {article.description && (
          <p
            className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted-foreground"
            style={{ textWrap: "pretty" }}
          >
            {article.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-2 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {article.favicon && (
              <Image
                src={article.favicon}
                alt=""
                width={14}
                height={14}
                className="rounded-sm"
                unoptimized
              />
            )}
            <span>{article.sourceDomain}</span>
          </span>

          {publishedAtStr && (
            <>
              <span className="text-border">&middot;</span>
              <time dateTime={publishedAtStr}>
                {timeAgo(article.publishedAt!)}
              </time>
            </>
          )}

          {article.submittedBy?.name && (
            <>
              <span className="text-border">&middot;</span>
              <span>{article.submittedBy.name}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function ArticleRow({ article }: { article: Article }) {
  const publishedAtStr =
    article.publishedAt instanceof Date
      ? article.publishedAt.toISOString()
      : article.publishedAt;
  const isVideo = article.contentType === "VIDEO";

  return (
    <Link
      href={`/articles/${article.id}`}
      className="group flex gap-4 px-4 py-5 transition-colors duration-150 ease-out hover:bg-card"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2
          className="font-heading text-[1.0625rem] font-bold leading-snug text-foreground transition-colors duration-150 group-hover:text-accent-foreground"
          style={{ textWrap: "balance" }}
        >
          {article.title}
        </h2>

        {article.description && (
          <p
            className="line-clamp-2 text-[0.9375rem] leading-relaxed text-muted-foreground"
            style={{ textWrap: "pretty" }}
          >
            {article.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {article.favicon && (
              <Image
                src={article.favicon}
                alt=""
                width={14}
                height={14}
                className="rounded-sm"
                unoptimized
              />
            )}
            <span>{article.sourceDomain}</span>
          </span>

          {publishedAtStr && (
            <>
              <span className="text-border">&middot;</span>
              <time dateTime={publishedAtStr}>
                {timeAgo(article.publishedAt!)}
              </time>
            </>
          )}

          {article.submittedBy?.name && (
            <>
              <span className="text-border">&middot;</span>
              <span>{article.submittedBy.name}</span>
            </>
          )}

          {article.tags.length > 0 && (
            <>
              <span className="text-border">&middot;</span>
              <span className="flex gap-1.5">
                {article.tags.slice(0, 3).map(({ tag }) => (
                  <span
                    key={tag.slug}
                    className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                  >
                    {tag.name}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="relative shrink-0 overflow-hidden rounded-md">
        <Image
          src={article.ogImage ?? "/default.png"}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 rounded-md object-cover"
          unoptimized={!!article.ogImage}
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
              <Play weight="Filled" className="ml-0.5 h-3.5 w-3.5" />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export function ArticleEntry({
  article,
  variant = "row",
}: {
  article: Article;
  variant?: "row" | "card";
}) {
  if (variant === "card") return <ArticleCard article={article} />;
  return <ArticleRow article={article} />;
}
