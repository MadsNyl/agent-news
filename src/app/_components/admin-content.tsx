"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";

const PAGE_SIZE = 50;

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function TypeBadge({ type }: { type: "ARTICLE" | "VIDEO" }) {
  const isVideo = type === "VIDEO";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide ${
        isVideo
          ? "bg-purple-500/15 text-purple-400"
          : "bg-blue-500/15 text-blue-400"
      }`}
    >
      {isVideo ? "Video" : "Article"}
    </span>
  );
}

/** Build a windowed list of page numbers with `null` sentinels for ellipses. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | null)[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push(null);
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push(null);
  pages.push(total);
  return pages;
}

export function AdminContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();

  const isSuperAdmin = session?.user.isSuperAdmin === true;

  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);

  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!isPending && !isSuperAdmin) {
      router.replace("/");
    }
  }, [isPending, isSuperAdmin, router]);

  const utils = api.useUtils();
  const query = api.article.adminList.useQuery(
    { page: currentPage, limit: PAGE_SIZE },
    { enabled: isSuperAdmin, placeholderData: (prev) => prev },
  );

  const deleteMutation = api.article.delete.useMutation({
    onSuccess: async () => {
      const title = pendingDelete?.title;
      setPendingDelete(null);
      await utils.article.adminList.invalidate();
      toast.success(
        title ? `Deleted "${title}"` : "Content deleted",
      );
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete content");
    },
  });

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const goToPage = (page: number) => {
    router.push(hrefForPage(page), { scroll: false });
  };

  if (isPending || !isSuperAdmin) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    );
  }

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const totalCount = query.data?.totalCount ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-heading text-2xl font-black tracking-tight text-foreground">
          All Content
        </h1>
        <span className="text-sm text-muted-foreground">
          {totalCount} item{totalCount === 1 ? "" : "s"}
        </span>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 w-full animate-pulse rounded bg-secondary"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">No content yet.</p>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-card">
                    <td className="px-4 py-3">
                      <TypeBadge type={item.contentType} />
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <Link
                        href={`/articles/${item.id}`}
                        className="line-clamp-1 font-medium text-foreground hover:text-accent-foreground"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.sourceDomain}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      <time dateTime={item.createdAt.toISOString()}>
                        {formatTimestamp(item.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() =>
                          setPendingDelete({ id: item.id, title: item.title })
                        }
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: list */}
          <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <TypeBadge type={item.contentType} />
                  <time
                    dateTime={item.createdAt.toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {formatTimestamp(item.createdAt)}
                  </time>
                </div>
                <Link
                  href={`/articles/${item.id}`}
                  className="font-medium leading-snug text-foreground"
                >
                  {item.title}
                </Link>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {item.sourceDomain}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() =>
                      setPendingDelete({ id: item.id, title: item.title })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={hrefForPage(currentPage - 1)}
                    aria-disabled={currentPage <= 1}
                    className={
                      currentPage <= 1
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) goToPage(currentPage - 1);
                    }}
                  />
                </PaginationItem>

                {pageWindow(currentPage, totalPages).map((p, i) =>
                  p === null ? (
                    <PaginationItem key={`ellipsis-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href={hrefForPage(p)}
                        isActive={p === currentPage}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(p);
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <PaginationNext
                    href={hrefForPage(currentPage + 1)}
                    aria-disabled={currentPage >= totalPages}
                    className={
                      currentPage >= totalPages
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) goToPage(currentPage + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete content</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.title}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate({ id: pendingDelete.id });
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
