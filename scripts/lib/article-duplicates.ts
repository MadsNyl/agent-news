import { db } from "~/server/db";

/**
 * Shared duplicate-detection used by both the report and delete scripts, so
 * they always agree on what a duplicate is. Two articles are duplicates when
 * their stored embeddings are at least `threshold` cosine-similar. Duplicates
 * are grouped into clusters; within each cluster one article is kept and the
 * rest are candidates for deletion.
 */

// Matches the ingestion pipeline's INGEST_DEDUP_THRESHOLD default.
export const DEFAULT_THRESHOLD = 0.9;

export interface ArticleMeta {
  id: string;
  title: string;
  url: string;
  sourceDomain: string;
  publishedAt: Date | null;
  createdAt: Date;
  readCount: number;
}

export interface DuplicateCluster {
  keep: ArticleMeta;
  duplicates: Array<ArticleMeta & { similarity: number }>;
}

/** Read a `--threshold <n>` flag from argv, falling back to the default. */
export function parseThreshold(argv: string[]): number {
  const i = argv.indexOf("--threshold");
  if (i !== -1 && argv[i + 1]) {
    const v = parseFloat(argv[i + 1]!);
    if (!Number.isNaN(v)) return v;
  }
  return DEFAULT_THRESHOLD;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root)! !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur)! !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string): void {
    this.parent.set(this.find(a), this.find(b));
  }
}

// Keep the original: earliest publishedAt (fallback createdAt), then lowest id.
function keySort(a: ArticleMeta): number {
  return (a.publishedAt ?? a.createdAt).getTime();
}
function pickKeep(members: ArticleMeta[]): ArticleMeta {
  return [...members].sort(
    (a, b) => keySort(a) - keySort(b) || a.id.localeCompare(b.id),
  )[0]!;
}

export async function findDuplicateClusters(
  threshold: number = DEFAULT_THRESHOLD,
): Promise<DuplicateCluster[]> {
  // All article pairs whose embeddings are at least `threshold` similar.
  // O(n^2) over embedded rows — fine for an occasional maintenance run.
  const pairs = await db.$queryRawUnsafe<
    Array<{ id_a: string; id_b: string; similarity: number }>
  >(
    `SELECT a.id AS id_a, b.id AS id_b,
            1 - (a.embedding <=> b.embedding) AS similarity
     FROM "Article" a
     JOIN "Article" b ON a.id < b.id
     WHERE a.embedding IS NOT NULL AND b.embedding IS NOT NULL
       AND 1 - (a.embedding <=> b.embedding) >= $1`,
    threshold,
  );
  if (pairs.length === 0) return [];

  // Group connected articles into clusters.
  const uf = new UnionFind();
  const ids = new Set<string>();
  for (const p of pairs) {
    uf.union(p.id_a, p.id_b);
    ids.add(p.id_a);
    ids.add(p.id_b);
  }

  // Load metadata for every article involved in a duplicate cluster.
  const rows = await db.$queryRawUnsafe<ArticleMeta[]>(
    `SELECT id, title, url, "sourceDomain", "publishedAt", "createdAt", "readCount"
     FROM "Article" WHERE id = ANY($1::uuid[])`,
    [...ids],
  );
  const metaById = new Map(rows.map((r) => [r.id, r]));

  // Fast similarity lookup for reporting each duplicate against the kept one.
  const simByPair = new Map<string, number>();
  for (const p of pairs) {
    simByPair.set(`${p.id_a}|${p.id_b}`, Number(p.similarity));
    simByPair.set(`${p.id_b}|${p.id_a}`, Number(p.similarity));
  }

  const clusters = new Map<string, ArticleMeta[]>();
  for (const id of ids) {
    const root = uf.find(id);
    const meta = metaById.get(id);
    if (!meta) continue;
    (clusters.get(root) ?? clusters.set(root, []).get(root)!).push(meta);
  }

  const result: DuplicateCluster[] = [];
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const keep = pickKeep(members);
    const duplicates = members
      .filter((m) => m.id !== keep.id)
      .map((m) => ({
        ...m,
        similarity: simByPair.get(`${keep.id}|${m.id}`) ?? threshold,
      }))
      .sort((a, b) => b.similarity - a.similarity);
    result.push({ keep, duplicates });
  }

  // Largest clusters first.
  return result.sort((a, b) => b.duplicates.length - a.duplicates.length);
}
