import * as cheerio from "cheerio";

export interface Article {
  title: string;
  link: string;
  description: string;
}

export async function fetchRss(url: string): Promise<Article[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch RSS: ${response.status} ${response.statusText}`,
    );
  }
  const xml = await response.text();
  const $ = cheerio.load(xml, { xml: true });

  const articles: Article[] = [];
  const isAtom = $("feed > entry").length > 0;

  if (isAtom) {
    $("entry").each((_i, el) => {
      const title = $(el).find("title").first().text().trim();
      const link =
        $(el).find('link[rel="alternate"]').attr("href") ??
        $(el).find("link").attr("href") ??
        "";
      const description =
        $(el).find("summary").first().text().trim() ||
        $(el).find("content").first().text().trim();
      if (title && link && !title.toLowerCase().includes("(sponsor)")) {
        articles.push({ title, link, description });
      }
    });
  } else {
    $("item").each((_i, el) => {
      const title = $(el).find("title").first().text().trim();
      const link =
        $(el).find("link").first().text().trim() ||
        $(el).find("guid").first().text().trim();
      const description = $(el).find("description").first().text().trim();
      if (title && link && !title.toLowerCase().includes("(sponsor)")) {
        articles.push({ title, link, description });
      }
    });
  }
  return articles;
}

export interface VideoEmbed {
  embedUrl: string;
  videoId: string;
}

export interface PageData {
  text: string;
  ogImage: string | null;
  publishedAt: string | null;
  favicon: string | null;
  firstImage: string | null;
  video: VideoEmbed | null;
}

export async function extractPageData(
  url: string,
): Promise<PageData | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AgentNews/1.0; +https://github.com)",
      },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const ogImage =
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      null;

    const publishedAt =
      $('meta[property="article:published_time"]').attr("content") ??
      $('meta[name="pubdate"]').attr("content") ??
      $('meta[name="date"]').attr("content") ??
      $('meta[name="DC.date.issued"]').attr("content") ??
      $("time[datetime]").first().attr("datetime") ??
      null;

    const origin = new URL(url).origin;
    const faviconHref =
      $('link[rel="icon"]').attr("href") ??
      $('link[rel="shortcut icon"]').attr("href") ??
      null;
    const favicon = faviconHref
      ? faviconHref.startsWith("http")
        ? faviconHref
        : `${origin}${faviconHref.startsWith("/") ? "" : "/"}${faviconHref}`
      : null;

    let video: VideoEmbed | null = null;
    const videoPatterns = [
      /youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /player\.vimeo\.com\/video\/(\d+)/,
    ];
    $("iframe[src]").each((_i, el) => {
      if (video) return;
      const src = $(el).attr("src") ?? "";
      for (const pattern of videoPatterns) {
        const match = src.match(pattern);
        if (match) {
          const videoId = match[1]!;
          const isVimeo = pattern.source.includes("vimeo");
          video = {
            embedUrl: isVimeo
              ? `https://player.vimeo.com/video/${videoId}`
              : `https://www.youtube.com/embed/${videoId}`,
            videoId,
          };
          return;
        }
      }
    });

    if (!video) {
      const playerUrl = $('meta[name="twitter:player"]').attr("content") ?? "";
      for (const pattern of videoPatterns) {
        const match = playerUrl.match(pattern);
        if (match) {
          const videoId = match[1]!;
          const isVimeo = pattern.source.includes("vimeo");
          video = {
            embedUrl: isVimeo
              ? `https://player.vimeo.com/video/${videoId}`
              : `https://www.youtube.com/embed/${videoId}`,
            videoId,
          };
          break;
        }
      }
    }

    $(
      "nav, footer, header, aside, script, style, noscript, iframe, [role='banner'], [role='navigation'], [role='complementary']",
    ).remove();

    let contentEl = $("article").first();
    if (!contentEl.length) contentEl = $("main").first();
    if (!contentEl.length) contentEl = $("[role='main']").first();
    if (!contentEl.length) contentEl = $("body");

    const firstImg = contentEl.find("img[src]").first().attr("src") ?? null;
    const firstImage = firstImg
      ? firstImg.startsWith("http")
        ? firstImg
        : `${origin}${firstImg.startsWith("/") ? "" : "/"}${firstImg}`
      : null;

    const text = contentEl.text().replace(/\s+/g, " ").trim().slice(0, 16000);
    if (text.length === 0) return null;

    return { text, ogImage, publishedAt, favicon, firstImage, video };
  } catch {
    return null;
  }
}
