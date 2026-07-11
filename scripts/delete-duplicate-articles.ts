/**
 * Delete semantic duplicate articles, keeping the earliest-published one in
 * each cluster. Dry-run by default — you must pass --apply to actually delete.
 *
 *   bun run scripts/delete-duplicate-articles.ts                 # preview only
 *   bun run scripts/delete-duplicate-articles.ts --apply         # delete
 *   bun run scripts/delete-duplicate-articles.ts --threshold 0.92 --apply
 *
 * ArticleTag rows cascade-delete with the article (see schema).
 */
import { db } from "~/server/db";
import {
  findDuplicateClusters,
  parseThreshold,
} from "./lib/article-duplicates";

const APPLY = process.argv.includes("--apply");
const threshold = parseThreshold(process.argv);

const fmtDate = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : "????-??-??";

console.log(
  `Duplicate deletion at cosine >= ${threshold}  •  ${APPLY ? "APPLY (will delete)" : "DRY RUN (no changes)"}\n`,
);

const clusters = await findDuplicateClusters(threshold);

if (clusters.length === 0) {
  console.log("No duplicate clusters found. Nothing to delete.");
  await db.$disconnect();
  process.exit(0);
}

const toDelete: string[] = [];
for (const c of clusters) {
  console.log(
    `KEEP    ${fmtDate(c.keep.publishedAt)}  [${c.keep.sourceDomain}]  ${c.keep.title}`,
  );
  for (const d of c.duplicates) {
    console.log(
      `  ✗ del ${fmtDate(d.publishedAt)}  [${d.sourceDomain}]  ${d.title}  (cosine ${d.similarity.toFixed(3)})`,
    );
    toDelete.push(d.id);
  }
}

console.log(
  `\n${toDelete.length} article(s) across ${clusters.length} cluster(s) to delete.`,
);

if (!APPLY) {
  console.log("\nDry run — no changes made. Re-run with --apply to delete.");
  await db.$disconnect();
  process.exit(0);
}

const { count } = await db.article.deleteMany({
  where: { id: { in: toDelete } },
});
console.log(`\n✓ Deleted ${count} duplicate article(s).`);

await db.$disconnect();
process.exit(0);
