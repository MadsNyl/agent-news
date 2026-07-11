/**
 * Report semantic duplicate articles in the DB (read-only).
 *
 *   bun run scripts/find-duplicate-articles.ts [--threshold 0.90]
 *
 * Groups articles whose embeddings are >= threshold cosine-similar into
 * clusters, showing which one would be KEPT (earliest published) and which
 * would be deleted. Deletes nothing — use delete-duplicate-articles.ts for that.
 */
import { db } from "~/server/db";
import {
  findDuplicateClusters,
  parseThreshold,
  DEFAULT_THRESHOLD,
} from "./lib/article-duplicates";

const threshold = parseThreshold(process.argv);

console.log(
  `Scanning for duplicates at cosine >= ${threshold}${threshold === DEFAULT_THRESHOLD ? " (default)" : ""}\n`,
);

const clusters = await findDuplicateClusters(threshold);

const fmtDate = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : "????-??-??";

if (clusters.length === 0) {
  console.log("No duplicate clusters found.");
} else {
  let totalDupes = 0;
  clusters.forEach((c, i) => {
    totalDupes += c.duplicates.length;
    console.log(`Cluster ${i + 1} (${c.duplicates.length + 1} articles):`);
    console.log(
      `  KEEP    ${fmtDate(c.keep.publishedAt)}  [${c.keep.sourceDomain}]  ${c.keep.title}`,
    );
    for (const d of c.duplicates) {
      console.log(
        `  DELETE  ${fmtDate(d.publishedAt)}  [${d.sourceDomain}]  ${d.title}  (cosine ${d.similarity.toFixed(3)}, reads ${d.readCount})`,
      );
    }
    console.log();
  });
  console.log(
    `${clusters.length} cluster(s), ${totalDupes} duplicate(s) that could be deleted.`,
  );
}

await db.$disconnect();
process.exit(0);
