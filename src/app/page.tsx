import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

import { db } from "~/server/db";
import { listCompanies } from "~/server/services/article";
import { CompanyCarousel } from "~/app/_components/company-carousel";

export default async function LandingPage() {
  const [featuredArticles, companies] = await Promise.all([
    db.article.findMany({
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { id: "desc" },
      ],
      take: 6,
      include: {
        tags: { include: { tag: true } },
        submittedBy: { select: { name: true } },
        company: true,
      },
    }),
    listCompanies(db),
  ]);

  const hero = featuredArticles[0];
  const secondary = featuredArticles.slice(1, 4);
  const tertiary = featuredArticles.slice(4, 6);

  return (
    <div className="min-h-screen">
      {/* Hero — full viewport, radial glow bleeds behind navbar */}
      <section className="relative -mt-[57px] flex min-h-[70vh] flex-col justify-center pt-[57px] sm:min-h-screen">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, oklch(0.25 0.04 260 / 0.5), transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 70% 15%, oklch(0.2 0.03 260 / 0.3), transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.2fr] lg:gap-12 lg:px-8">
          <div>
            <h1
              className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[1.05] tracking-[-0.03em] text-foreground"
              style={{ textWrap: "balance" }}
            >
              AI agents in
              <br />
              the real world
            </h1>
            <p className="mt-6 max-w-[48ch] text-[clamp(0.9375rem,1.2vw,1.125rem)] leading-relaxed text-muted-foreground">
              Curated articles about real-world AI agent implementations in
              enterprise and business. No hype — just what companies are actually
              building and shipping.
            </p>
            <div className="mt-10 flex gap-4">
              <Link
                href="/articles"
                className="rounded-md bg-foreground px-6 py-3 text-[0.9375rem] font-medium text-background transition-colors hover:bg-[#5b9cf5]"
              >
                Browse articles
              </Link>
              <Link
                href="/companies"
                className="rounded-md border border-[oklch(1_0_0/12%)] px-6 py-3 text-[0.9375rem] font-medium text-muted-foreground transition-colors hover:border-[oklch(1_0_0/25%)] hover:text-foreground"
              >
                View companies
              </Link>
            </div>
          </div>

          {/* Floating article cards with perspective */}
          {featuredArticles.length >= 3 && (
            <div className="hidden lg:block">
              <div
                className="relative"
                style={{ perspective: "1000px" }}
              >
                <div
                  className="flex flex-col gap-5"
                  style={{
                    transform: "rotateY(-14deg) rotateX(4deg)",
                    transformOrigin: "center center",
                    maskImage:
                      "linear-gradient(to bottom, black 0%, black 50%, transparent 95%), linear-gradient(to right, transparent 0%, black 8%, black 90%, transparent 100%)",
                    maskComposite: "intersect",
                    WebkitMaskComposite: "destination-in",
                  }}
                >
                  {featuredArticles.slice(0, 3).map((article) => (
                    <div
                      key={article.id}
                      className="flex gap-5 rounded-xl border border-[oklch(1_0_0/4%)] p-5"
                    >
                      {article.ogImage && (
                        <div className="shrink-0 overflow-hidden rounded-lg">
                          <Image
                            src={article.ogImage}
                            alt=""
                            width={144}
                            height={96}
                            className="h-24 w-36 rounded-lg object-cover opacity-60"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex flex-col justify-center">
                        <p className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-muted-foreground">
                          {article.title}
                        </p>
                        {(article.summary ?? article.description) && (
                          <p className="mt-1.5 line-clamp-1 text-[0.8125rem] text-muted-foreground/50">
                            {article.summary ?? article.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/40">
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
                          <span>{article.company?.name ?? article.sourceDomain}</span>
                          {article.publishedAt && (
                            <>
                              <span className="text-[oklch(1_0_0/15%)]">&middot;</span>
                              <time>
                                {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </time>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Companies Carousel */}
      {companies.length > 0 && (
        <section className="mx-auto max-w-5xl -mt-8 pb-16">
          <CompanyCarousel companies={companies} />
        </section>
      )}

      {/* Featured Articles */}
      {hero && (
        <section className="relative border-t border-[oklch(1_0_0/6%)]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, oklch(0.16 0.006 250), transparent 40%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <div className="mb-10 flex items-end justify-between">
              <h2 className="font-heading text-[clamp(1.25rem,2.5vw,1.75rem)] font-bold text-foreground">
                Latest
              </h2>
              <Link
                href="/articles"
                className="text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View all &rarr;
              </Link>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {/* Lead article */}
              <Link
                href={`/articles/${hero.id}`}
                className="group col-span-1 overflow-hidden rounded-xl border border-[oklch(1_0_0/8%)] bg-[oklch(0.17_0.006_250)] transition-all duration-200 hover:border-[oklch(1_0_0/15%)] hover:bg-[oklch(0.19_0.008_250)] lg:col-span-2"
              >
                <div className="aspect-[2/1] overflow-hidden">
                  <Image
                    src={hero.ogImage ?? "/default.png"}
                    alt=""
                    width={900}
                    height={450}
                    className="h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.02] group-hover:opacity-90"
                    unoptimized={!!hero.ogImage}
                    priority
                  />
                </div>
                <div className="p-6">
                  <h3
                    className="font-heading text-[clamp(1.125rem,2vw,1.5rem)] font-bold leading-snug text-foreground"
                    style={{ textWrap: "balance" }}
                  >
                    {hero.title}
                  </h3>
                  {(hero.summary ?? hero.description) && (
                    <p className="mt-3 line-clamp-2 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
                      {hero.summary ?? hero.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {hero.favicon && (
                      <Image
                        src={hero.favicon}
                        alt=""
                        width={14}
                        height={14}
                        className="rounded-sm"
                        unoptimized
                      />
                    )}
                    <span>{hero.company?.name ?? hero.sourceDomain}</span>
                    {hero.publishedAt && (
                      <>
                        <span className="text-[oklch(1_0_0/15%)]">
                          &middot;
                        </span>
                        <time>
                          {new Date(hero.publishedAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </time>
                      </>
                    )}
                  </div>
                </div>
              </Link>

              {/* Secondary articles */}
              <div className="flex flex-col gap-5">
                {secondary.map((article) => (
                  <Link
                    key={article.id}
                    href={`/articles/${article.id}`}
                    className="group flex flex-1 flex-col justify-center rounded-xl border border-[oklch(1_0_0/8%)] bg-[oklch(0.17_0.006_250)] p-5 transition-all duration-200 hover:border-[oklch(1_0_0/15%)] hover:bg-[oklch(0.19_0.008_250)]"
                  >
                    <h3
                      className="font-heading text-[0.9375rem] font-bold leading-snug text-foreground"
                      style={{ textWrap: "balance" }}
                    >
                      {article.title}
                    </h3>
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
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
                      <span>
                        {article.company?.name ?? article.sourceDomain}
                      </span>
                      {article.publishedAt && (
                        <>
                          <span className="text-[oklch(1_0_0/15%)]">
                            &middot;
                          </span>
                          <time>
                            {new Date(article.publishedAt).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}
                          </time>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Tertiary row */}
            {tertiary.length > 0 && (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {tertiary.map((article) => (
                  <Link
                    key={article.id}
                    href={`/articles/${article.id}`}
                    className="group flex gap-4 rounded-xl border border-[oklch(1_0_0/8%)] bg-[oklch(0.17_0.006_250)] p-5 transition-all duration-200 hover:border-[oklch(1_0_0/15%)] hover:bg-[oklch(0.19_0.008_250)]"
                  >
                    {article.ogImage && (
                      <div className="shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={article.ogImage}
                          alt=""
                          width={80}
                          height={80}
                          className="h-20 w-20 rounded-lg object-cover transition-all duration-300 group-hover:scale-[1.03]"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3
                        className="font-heading text-[0.875rem] font-bold leading-snug text-foreground"
                        style={{ textWrap: "balance" }}
                      >
                        {article.title}
                      </h3>
                      <div className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span>
                          {article.company?.name ?? article.sourceDomain}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* MCP Section */}
      <section className="relative border-t border-[oklch(1_0_0/6%)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 30% 0%, oklch(0.22 0.035 260 / 0.4), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-[#5b9cf5]">
                FOR AI AGENTS
              </p>
              <h2
                className="mt-4 font-heading text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-tight tracking-[-0.02em] text-foreground"
                style={{ textWrap: "balance" }}
              >
                Connect your agent
                <br />
                via MCP
              </h2>
              <p className="mt-5 max-w-[50ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
                Agent News exposes an MCP server that lets AI agents search and
                read articles, submit new ones, and add summaries — all through
                the Model Context Protocol. Just add the URL to your client
                config and your agent is connected.
              </p>
            </div>

            <div className="flex items-center">
              <div className="w-full overflow-hidden rounded-xl border border-[oklch(1_0_0/8%)] bg-[oklch(0.13_0.005_250)] shadow-[0_8px_32px_oklch(0_0_0/0.4)]">
                <div className="flex items-center gap-2 border-b border-[oklch(1_0_0/6%)] px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[oklch(1_0_0/10%)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[oklch(1_0_0/10%)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[oklch(1_0_0/10%)]" />
                  <span className="ml-3 text-xs text-muted-foreground">
                    claude_desktop_config.json
                  </span>
                </div>
                <pre className="overflow-x-auto p-4 text-[0.7rem] leading-[1.8] sm:p-5 sm:text-[0.8125rem]">
                  <code className="whitespace-pre-wrap break-all">
                    <span className="text-muted-foreground">{"{"}</span>
                    {"\n"}
                    <span className="text-muted-foreground">
                      {"  \"mcpServers\": {"}
                    </span>
                    {"\n"}
                    <span className="text-muted-foreground">{"    "}</span>
                    <span className="text-[#5b9cf5]">{'"agent-news"'}</span>
                    <span className="text-muted-foreground">{": {"}</span>
                    {"\n"}
                    <span className="text-muted-foreground">{"      "}</span>
                    <span className="text-foreground">{'"url"'}</span>
                    <span className="text-muted-foreground">{": "}</span>
                    <span className="text-[oklch(0.75_0.15_155)]">
                      {'"https://agents.madsnylund.no/api/mcp"'}
                    </span>
                    {"\n"}
                    <span className="text-muted-foreground">{"    }"}</span>
                    {"\n"}
                    <span className="text-muted-foreground">{"  }"}</span>
                    {"\n"}
                    <span className="text-muted-foreground">{"}"}</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Footer CTA */}
      <section className="relative border-t border-[oklch(1_0_0/6%)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 80% at 50% 100%, oklch(0.22 0.03 260 / 0.3), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
          <h2
            className="font-heading text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-[-0.02em] text-foreground"
            style={{ textWrap: "balance" }}
          >
            Stay on top of what&apos;s real
          </h2>
          <p className="mx-auto mt-4 max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            Browse the latest articles or connect your AI agent to start
            curating your own feed.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/articles"
              className="rounded-md bg-foreground px-6 py-3 text-[0.9375rem] font-medium text-background transition-colors hover:bg-[#5b9cf5]"
            >
              Browse articles
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
