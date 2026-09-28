import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";

export const runtime = "nodejs";

type RedditFeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  creator?: string;
};

const parser = new Parser<Record<string, never>, RedditFeedItem>();

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 160) {
    return NextResponse.json({ error: "Provide a search query up to 160 characters." }, { status: 400 });
  }

  const feedUrl = new URL("https://www.reddit.com/search.rss");
  feedUrl.searchParams.set("q", query);
  feedUrl.searchParams.set("sort", "new");
  feedUrl.searchParams.set("limit", "10");

  try {
    const response = await fetch(feedUrl, {
      headers: {
        Accept: "application/atom+xml, application/rss+xml, application/xml",
        "User-Agent": "EntertainmentHorizon/0.1",
      },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Reddit feed unavailable." }, { status: 502 });
    }

    const feed = await parser.parseString(await response.text());
    const items = feed.items.flatMap((item) => {
      const title = item.title?.trim();
      const url = item.link?.trim();
      if (!title || !url) return [];
      const rawDate = item.isoDate ?? item.pubDate;
      const timestamp = rawDate ? Date.parse(rawDate) : Number.NaN;
      return [{
        title,
        url,
        publisher: item.creator?.trim() || "Reddit",
        publishedAt: Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString(),
      }];
    });
    items.sort((a, b) => (b.publishedAt ? Date.parse(b.publishedAt) : -Infinity) - (a.publishedAt ? Date.parse(a.publishedAt) : -Infinity));
    return NextResponse.json({ items: items.slice(0, 4) }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "Reddit feed unavailable." }, { status: 502 });
  }
}
