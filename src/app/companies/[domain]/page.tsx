import { type Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getCompanyByDomain } from "~/server/services/article";
import { CompanyContentTabs } from "~/app/_components/company-content-tabs";

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const company = await getCompanyByDomain(db, domain);
  if (!company) return {};

  return {
    title: `${company.name} — Agent News`,
    description: `Content from ${company.name} about AI agent implementations in enterprise.`,
  };
}

export default async function CompanyDetailPage({ params }: Props) {
  const { domain } = await params;
  const company = await getCompanyByDomain(db, domain);
  if (!company) notFound();

  const articleCount = company.articles.filter((a) => a.contentType === "ARTICLE").length;
  const videoCount = company.articles.filter((a) => a.contentType === "VIDEO").length;

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
            {articleCount > 0 && (
              <>{articleCount} {articleCount === 1 ? "article" : "articles"}</>
            )}
            {articleCount > 0 && videoCount > 0 && <> &middot; </>}
            {videoCount > 0 && (
              <>{videoCount} {videoCount === 1 ? "video" : "videos"}</>
            )}
          </p>
        </div>
      </header>

      <main className="pb-12">
        <Suspense>
          <CompanyContentTabs articles={company.articles} />
        </Suspense>
      </main>
    </div>
  );
}
