"use server";

import Parser from "rss-parser";

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  creator?: string;
};

export type NewsHeadline = {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
};

export type HeadlinesResult =
  | { ok: true; headlines: NewsHeadline[] }
  | { ok: false; error: "INVALID_TITLE" | "FEED_UNAVAILABLE" };

const parser = new Parser<Record<string, never>, FeedItem>();

export async function getGoogleNewsHeadlines(rawTitle: string): Promise<HeadlinesResult> {
  if (typeof rawTitle !== "string") return { ok: false, error: "INVALID_TITLE" };
  const title = rawTitle.trim();
  if (!title || title.length > 160) return { ok: false, error: "INVALID_TITLE" };

  const feedUrl = new URL("https://news.google.com/rss/search");
  feedUrl.searchParams.set("q", title);
  feedUrl.searchParams.set("hl", "en-US");
  feedUrl.searchParams.set("gl", "US");
  feedUrl.searchParams.set("ceid", "US:en");

  try {
    const response = await fetch(feedUrl, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, error: "FEED_UNAVAILABLE" };

    const feed = await parser.parseString(await response.text());
    const headlines = feed.items.flatMap((item): NewsHeadline[] => {
      const headline = item.title?.trim();
      const url = item.link?.trim();
      if (!headline || !url) return [];

      const rawDate = item.isoDate ?? item.pubDate;
      const timestamp = rawDate ? Date.parse(rawDate) : Number.NaN;
      return [{
        title: headline,
        url,
        publisher: item.creator?.trim() || null,
        publishedAt: Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString(),
      }];
    });

    headlines.sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
      return bTime - aTime;
    });
    return { ok: true, headlines: headlines.slice(0, 4) };
  } catch {
    return { ok: false, error: "FEED_UNAVAILABLE" };
  }
}
