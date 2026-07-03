import { type Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getCompanyByDomain } from "~/server/services/article";
import { ArticleEntry } from "~/app/_components/article-entry";

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const company = await getCompanyByDomain(db, domain);
  if (!company) return {};

  return {
    title: `${company.name} — Agent News`,
    description: `Articles from ${company.name} about AI agent implementations in enterprise.`,
  };
}

export default async function CompanyDetailPage({ params }: Props) {
  const { domain } = await params;
  const company = await getCompanyByDomain(db, domain);
  if (!company) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-6 lg:px-8">
      <header className="flex items-center gap-4 pb-6 pt-6 sm:pt-8">
        <Image
          src={
            company.logoUrl ??
            `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128`
          }
          alt=""
          width={48}
          height={48}
          className="rounded-lg"
          unoptimized
        />
        <div>
          <h1 className="font-heading text-2xl font-black text-foreground">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.articles.length}{" "}
            {company.articles.length === 1 ? "article" : "articles"}
          </p>
        </div>
      </header>

      <main className="pb-12">
        <div className="divide-y divide-border md:hidden">
          {company.articles.map((article) => (
            <ArticleEntry key={article.id} article={article} />
          ))}
        </div>
        <div className="hidden md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:gap-5">
          {company.articles.map((article) => (
            <ArticleEntry key={article.id} article={article} variant="card" />
          ))}
        </div>
      </main>
    </div>
  );
}
