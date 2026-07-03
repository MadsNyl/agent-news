import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { getArticleById } from "~/server/services/article";

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
      type: "article",
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

export default async function ShareRedirectPage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(db, id);
  if (!article) notFound();

  await db.article.update({
    where: { id },
    data: {
      shareClickCount: { increment: 1 },
      readCount: { increment: 1 },
    },
  });

  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content={`0;url=${article.url}`} />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.location.replace(${JSON.stringify(article.url)})`,
          }}
        />
        <p>
          Redirecting to{" "}
          <a href={article.url}>{article.title}</a>...
        </p>
      </body>
    </html>
  );
}
