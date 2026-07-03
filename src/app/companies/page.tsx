import { type Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

import { db } from "~/server/db";
import { listCompanies } from "~/server/services/article";

export const metadata: Metadata = {
  title: "Companies — Agent News",
  description:
    "Companies publishing articles about AI agent implementations in enterprise.",
};

export default async function CompaniesPage() {
  const companies = await listCompanies(db);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-6 lg:px-8">
      <header className="pb-6 pt-6 sm:pt-8">
        <h1 className="font-heading text-2xl font-black text-foreground">
          Companies
        </h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          Sources publishing about AI agent implementations in enterprise.
        </p>
      </header>

      <main className="grid grid-cols-2 gap-4 pb-12 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {companies.map((company) => (
          <Link
            key={company.id}
            href={`/companies/${company.domain}`}
            className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-5 text-center transition-colors hover:border-muted-foreground/25"
          >
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
              <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-accent-foreground">
                {company.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {company._count.articles}{" "}
                {company._count.articles === 1 ? "article" : "articles"}
              </p>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
