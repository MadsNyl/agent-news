import { type Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getArticleById, getRelatedArticles } from "~/server/services/article";
import { ArticleEntry } from "~/app/_components/article-entry";
import { ReadArticleButton } from "~/app/_components/read-article-button";
import { ShareButton } from "~/app/_components/share-button";
import { Eye, Share } from "~/components/icons";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(db, id);
  if (!article) return {};

  const description = article.summary ?? article.description ?? "";

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      images: article.ogImage ? [article.ogImage] : [],
      type: article.contentType === "VIDEO" ? "video.other" : "article",
      publishedTime: article.publishedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.ogImage ? [article.ogImage] : [],
    },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(db, id);
  if (!article) notFound();

  const tagIds = article.tags.map((t) => t.tag.id);

  const companyArticles = article.company
    ? await db.article.findMany({
        where: {
          companyId: article.company.id,
          id: { not: article.id },
        },
        orderBy: [
          { publishedAt: { sort: "desc", nulls: "last" } },
          { id: "desc" },
        ],
        take: 3,
        include: {
          tags: { include: { tag: true } },
          submittedBy: { select: { name: true } },
        },
      })
    : [];

  const companyArticleIds = companyArticles.map((a) => a.id);
  const relatedArticles = await getRelatedArticles(
    db,
    article.id,
    tagIds,
    companyArticleIds,
    3,
  );

  const publishedAtStr =
    article.publishedAt instanceof Date
      ? article.publishedAt.toISOString()
      : article.publishedAt;

  return (
    <div className="mx-auto max-w-[700px] px-4 py-8 sm:py-12">
      {article.contentType === "VIDEO" && article.videoEmbedUrl ? (
        <div className="mb-8 overflow-hidden rounded-lg">
          <iframe
            src={article.videoEmbedUrl}
            title={article.title}
            className="aspect-video w-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : article.ogImage ? (
        <div className="mb-8 overflow-hidden rounded-lg">
          <Image
            src={article.ogImage}
            alt=""
            width={700}
            height={394}
            className="w-full object-cover"
            unoptimized
            priority
          />
        </div>
      ) : null}

      <h1
        className="font-heading text-2xl font-black leading-tight text-foreground sm:text-3xl"
        style={{ textWrap: "balance" }}
      >
        {article.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {article.favicon && (
            <Image
              src={article.favicon}
              alt=""
              width={16}
              height={16}
              className="rounded-sm"
              unoptimized
            />
          )}
          {article.company ? (
            <Link
              href={`/companies/${article.company.domain}`}
              className="hover:text-foreground transition-colors"
            >
              {article.company.name}
            </Link>
          ) : (
            <span>{article.sourceDomain}</span>
          )}
        </span>

        {publishedAtStr && (
          <>
            <span className="text-border">&middot;</span>
            <time dateTime={publishedAtStr}>
              {new Date(publishedAtStr).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </>
        )}

        {article.submittedBy?.name && (
          <>
            <span className="text-border">&middot;</span>
            <span>Submitted by {article.submittedBy.name}</span>
          </>
        )}

        {(article.readCount > 0 || article.shareCount > 0) && (
          <>
            <span className="text-border">&middot;</span>
            {article.readCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye size={14} />
                {article.readCount}
              </span>
            )}
            {article.shareCount > 0 && (
              <span className="flex items-center gap-1">
                <Share size={14} />
                {article.shareCount}
              </span>
            )}
          </>
        )}
      </div>

      {article.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {article.tags.map(({ tag }) => (
            <Link
              key={tag.slug}
              href={`/?tag=${tag.slug}`}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      {article.summary && (
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          {article.summary}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <ShareButton title={article.title} articleId={article.id} />
        <ReadArticleButton url={article.url} articleId={article.id} contentType={article.contentType} />
      </div>

      {companyArticles.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-heading text-lg font-bold text-foreground">
            {article.contentType === "VIDEO" ? "More videos from" : "More from"}{" "}
            <Link
              href={`/companies/${article.company!.domain}`}
              className="hover:text-accent-foreground transition-colors"
            >
              {article.company!.name}
            </Link>
          </h2>
          <div className="mt-4 divide-y divide-border">
            {companyArticles.map((a) => (
              <ArticleEntry key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {relatedArticles.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-heading text-lg font-bold text-foreground">
            {article.contentType === "VIDEO" ? "Related Videos" : "Related Articles"}
          </h2>
          <div className="mt-4 space-y-4">
            {relatedArticles.map((a) => (
              <Link
                key={a.id}
                href={`/articles/${a.id}`}
                className="group block rounded-lg border border-border p-4 transition-colors hover:border-muted-foreground/25"
              >
                <h3 className="font-heading text-sm font-bold text-foreground transition-colors group-hover:text-accent-foreground">
                  {a.title}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{a.sourceDomain}</span>
                  {a.publishedAt && (
                    <>
                      <span className="text-border">&middot;</span>
                      <time>
                        {new Date(a.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
