import { PrismaClient } from "../generated/prisma";
import articles from "../src/data/articles.json";

const db = new PrismaClient();

const SEED_USER_ID = "seed-user";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  // Ensure seed user exists
  await db.user.upsert({
    where: { id: SEED_USER_ID },
    update: {},
    create: {
      id: SEED_USER_ID,
      name: "Seed User",
      email: "seed@agent-news.local",
      emailVerified: true,
    },
  });

  for (const article of articles) {
    const createdArticle = await db.article.upsert({
      where: { url: article.url },
      update: {},
      create: {
        url: article.url,
        title: article.title,
        description: article.description ?? null,
        ogImage: article.ogImage ?? null,
        favicon: article.favicon ?? null,
        sourceDomain: article.sourceDomain,
        publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
        submittedById: SEED_USER_ID,
      },
    });

    for (const tagName of article.tags) {
      const slug = slugify(tagName);
      const tag = await db.tag.upsert({
        where: { slug },
        update: {},
        create: { name: tagName, slug },
      });
      await db.articleTag.upsert({
        where: {
          articleId_tagId: {
            articleId: createdArticle.id,
            tagId: tag.id,
          },
        },
        update: {},
        create: {
          articleId: createdArticle.id,
          tagId: tag.id,
        },
      });
    }
  }
  console.log(`Seeded ${articles.length} articles`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    void db.$disconnect();
    process.exit(1);
  });
