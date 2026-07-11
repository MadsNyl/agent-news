/**
 * One-off: embed every Article that has no embedding yet, so the "vs-existing"
 * dedup in the ingest pipeline has something to compare against.
 *
 *   bun run scripts/backfill-embeddings.ts [--dry-run]
 *
 * Requires DATABASE_URL and a local Ollama with the embed model pulled.
 */
import { db } from "~/server/db";
import { embed, embedText } from "./ingest/embed";

const DRY_RUN = process.argv.includes("--dry-run");

const rows = await db.$queryRaw<
  Array<{ id: string; title: string; summary: string | null }>
>`SELECT id, title, summary FROM "Article" WHERE "embedding" IS NULL ORDER BY "createdAt" DESC`;

console.log(
  `${rows.length} article(s) without an embedding${DRY_RUN ? " (dry run)" : ""}`,
);

let done = 0;
let failed = 0;
for (const row of rows) {
  try {
    const vector = await embed(embedText(row.title, row.summary ?? ""));
    if (!DRY_RUN) {
      const vec = `[${vector.join(",")}]`;
      await db.$executeRaw`UPDATE "Article" SET "embedding" = ${vec}::vector WHERE id = ${row.id}::uuid`;
    }
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${rows.length}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${row.title}: ${e}`);
  }
}

console.log(`Done. ${done} embedded, ${failed} failed.`);
process.exit(failed > 0 && done === 0 ? 1 : 0);
