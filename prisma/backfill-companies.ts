import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

function domainToName(domain: string): string {
  return domain
    .replace(/^www\./, "")
    .replace(/\.(com|org|net|io|co|ai|dev|tech|news|blog)$/i, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const domains = await db.article.findMany({
    select: { sourceDomain: true },
    distinct: ["sourceDomain"],
  });

  for (const { sourceDomain } of domains) {
    const company = await db.company.upsert({
      where: { domain: sourceDomain },
      update: {},
      create: {
        name: domainToName(sourceDomain),
        domain: sourceDomain,
        logoUrl: `https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=128`,
      },
    });

    await db.article.updateMany({
      where: { sourceDomain, companyId: null },
      data: { companyId: company.id },
    });
  }

  console.log(`Backfilled ${domains.length} companies`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
