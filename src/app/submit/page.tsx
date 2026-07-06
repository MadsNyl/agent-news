"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api } from "~/trpc/react";
import { TagInput } from "~/app/_components/tag-input";
import { authClient } from "~/server/better-auth/client";

export default function SubmitPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } =
    authClient.useSession();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [favicon, setFavicon] = useState("");
  const [sourceDomain, setSourceDomain] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [contentType, setContentType] = useState<"ARTICLE" | "VIDEO">("ARTICLE");
  const [videoEmbedUrl, setVideoEmbedUrl] = useState("");
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tagsQuery = api.article.listTags.useQuery();

  const extractMutation = api.article.extractMetadata.useMutation({
    onSuccess: (data) => {
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setOgImage(data.ogImage ?? "");
      setFavicon(data.favicon ?? "");
      setSourceDomain(data.sourceDomain);
      setPublishedAt(data.publishedAt ?? "");
      setContentType(data.contentType === "VIDEO" ? "VIDEO" : "ARTICLE");
      setVideoEmbedUrl(data.videoEmbedUrl ?? "");
      setVideoDuration(data.videoDuration ?? null);
      setFetched(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const createMutation = api.article.create.useMutation({
    onSuccess: () => {
      router.push("/");
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  if (sessionLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    extractMutation.mutate({ url: url.trim() });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      url: url.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      ogImage: ogImage.trim() || undefined,
      favicon: favicon.trim() || undefined,
      sourceDomain,
      publishedAt: publishedAt || undefined,
      tags: selectedTags,
      contentType,
      videoEmbedUrl: videoEmbedUrl.trim() || undefined,
      videoDuration: videoDuration ?? undefined,
    });
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:px-0">
      <h1 className="font-heading text-2xl font-black text-foreground">
        Submit {contentType === "VIDEO" && fetched ? "video" : "article"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter a URL to auto-extract metadata, then review and submit.
      </p>

      <form onSubmit={handleFetch} className="mt-6 flex gap-2">
        <input
          type="url"
          placeholder="https://engineering.example.com/article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={extractMutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {extractMutation.isPending ? "Fetching..." : "Fetch"}
        </button>
      </form>

      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      {fetched && (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {contentType === "VIDEO" && videoEmbedUrl ? (
            <div className="overflow-hidden rounded-lg">
              <iframe
                src={videoEmbedUrl}
                title="Video preview"
                className="aspect-video w-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : ogImage ? (
            <div className="overflow-hidden rounded-md">
              <Image
                src={ogImage}
                alt="OG preview"
                width={600}
                height={315}
                className="w-full rounded-md object-cover"
                unoptimized
              />
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                contentType === "VIDEO"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}
            >
              {contentType === "VIDEO" ? "Video" : "Article"}
            </span>
            {contentType === "VIDEO" && videoDuration != null && (
              <span className="text-xs text-muted-foreground">
                {Math.floor(videoDuration / 60)}:{String(videoDuration % 60).padStart(2, "0")}
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              Title <span className="text-destructive">*</span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              OG Image URL
            </span>
            <input
              type="url"
              value={ogImage}
              onChange={(e) => setOgImage(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                Source domain
              </span>
              <input
                type="text"
                value={sourceDomain}
                onChange={(e) => setSourceDomain(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                Published date
              </span>
              <input
                type="date"
                value={
                  publishedAt ? publishedAt.substring(0, 10) : ""
                }
                onChange={(e) =>
                  setPublishedAt(
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  )
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Tags</span>
            <TagInput
              tags={tagsQuery.data ?? []}
              selectedTags={selectedTags}
              onAdd={(tag) =>
                setSelectedTags((prev) =>
                  prev.includes(tag) ? prev : [...prev, tag],
                )
              }
              onRemove={(tag) =>
                setSelectedTags((prev) => prev.filter((t) => t !== tag))
              }
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim() || createMutation.isPending}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending
              ? "Submitting..."
              : `Submit ${contentType === "VIDEO" ? "video" : "article"}`}
          </button>
        </form>
      )}
    </div>
  );
}
