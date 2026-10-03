import "server-only";

type Artwork = { dictionary?: { url?: string }; cropStyle?: string };
type ArtistHeader = { id?: string; artwork?: Artwork; circleArtwork?: Artwork };
type ArtistPage = { data?: { data?: { sections?: { itemKind?: string; items?: ArtistHeader[] }[] } }[] };

function trustedArtwork(value: string | undefined) {
  if (!value) return null;
  const url = value.replaceAll("{w}", "800").replaceAll("{h}", "800").replaceAll("{c}", "bb").replaceAll("{f}", "jpg").replaceAll("&amp;", "&");
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".mzstatic.com") ? url : null;
  } catch { return null; }
}

// iTunes artist search omits portraits. Read only the artist header from Apple's
// public page, and cache it independently of search results and album artwork.
export async function artistPortrait(id: string, country = "US"): Promise<string | null> {
  if (!/^\d{1,16}$/.test(id) || !/^[A-Z]{2}$/.test(country)) return null;
  try {
    const response = await fetch(`https://music.apple.com/${country.toLowerCase()}/artist/${id}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const html = await response.text();
    const serialized = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (serialized) {
      const page = JSON.parse(serialized) as ArtistPage;
      const header = page.data?.flatMap((entry) => entry.data?.sections ?? []).find((section) => section.itemKind === "artistDetailHeader")?.items?.[0];
      const portrait = trustedArtwork(header?.circleArtwork?.dictionary?.url ?? header?.artwork?.dictionary?.url);
      if (portrait) return portrait;
    }
    const image = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1];
    // An album cover is never substituted for an artist portrait.
    return image?.includes("AMCArtistImages") ? trustedArtwork(image) : null;
  } catch { return null; }
}
