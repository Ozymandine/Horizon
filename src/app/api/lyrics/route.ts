import { NextRequest, NextResponse } from "next/server";

type MusixmatchEnvelope<T> = { message?: { header?: { status_code?: number }; body?: T } };
type SubtitleBody = { subtitle?: { subtitle_body?: string; lyrics_copyright?: string; script_tracking_url?: string } };
type LyricsBody = { lyrics?: { lyrics_body?: string; lyrics_copyright?: string; script_tracking_url?: string } };

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim().slice(0, 160) ?? "";
  const artist = request.nextUrl.searchParams.get("artist")?.trim().slice(0, 160) ?? "";
  const duration = Number(request.nextUrl.searchParams.get("duration"));
  if (!title || !artist) return NextResponse.json({ message: "A track title and artist are required." }, { status: 400 });

  const apiKey = process.env.MUSIXMATCH_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, lines: [], message: "MUSIXMATCH_API_KEY is not configured on the server." });

  const fetchMusixmatch = async <T,>(method: string) => {
    const url = new URL(`https://api.musixmatch.com/ws/1.1/${method}`);
    url.searchParams.set("q_track", title);
    url.searchParams.set("q_artist", artist);
    url.searchParams.set("apikey", apiKey);
    if (Number.isFinite(duration) && duration >= 30 && duration <= 1800) {
      url.searchParams.set("f_subtitle_length", String(duration));
      url.searchParams.set("f_subtitle_length_max_deviation", "15");
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 3600 } });
    if (!response.ok) throw new Error("Lyrics provider request failed.");
    return response.json() as Promise<MusixmatchEnvelope<T>>;
  };

  try {
    const synchronized = await fetchMusixmatch<SubtitleBody>("matcher.subtitle.get");
    const subtitle = synchronized.message?.body?.subtitle;
    if (synchronized.message?.header?.status_code === 200 && subtitle?.subtitle_body) {
      const lines = subtitle.subtitle_body.split(/\r?\n/).flatMap((line) => {
        const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
        if (!match || !match[3]) return [];
        return [{ text: match[3], timeMs: Math.round((Number(match[1]) * 60 + Number(match[2])) * 1000) }];
      });
      if (lines.length) return NextResponse.json({ configured: true, lines, copyright: subtitle.lyrics_copyright, attributionUrl: "https://www.musixmatch.com/" });
    }

    const plainResult = await fetchMusixmatch<LyricsBody>("matcher.lyrics.get");
    const lyrics = plainResult.message?.body?.lyrics;
    const plainLines = lyrics?.lyrics_body?.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^\*{3,}/.test(line)) ?? [];
    return NextResponse.json({ configured: true, lines: plainLines.map((text) => ({ text })), copyright: lyrics?.lyrics_copyright, attributionUrl: "https://www.musixmatch.com/" });
  } catch {
    return NextResponse.json({ configured: true, lines: [], message: "The licensed lyrics service is unavailable right now." }, { status: 502 });
  }
}
