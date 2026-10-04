export type SpotifyPage<T> = { items: T[]; next: string | null; total: number };

/** Collect the catalog before publishing it, so groups never appear half loaded. */
export async function completeSpotifyPage<T extends { id: string }>(
  first: SpotifyPage<T>,
  fetchPage: (url: string) => Promise<SpotifyPage<T>>,
  cancelled: () => boolean = () => false,
): Promise<T[]> {
  const items = new Map(first.items.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let next = first.next;
  while (next) {
    if (cancelled()) throw new Error("Catalog request cancelled.");
    const url = new URL(next);
    if (url.origin !== "https://api.spotify.com" || !url.pathname.startsWith("/v1/")) throw new Error("Invalid Spotify pagination URL.");
    if (visited.has(next)) throw new Error("Spotify returned a repeated catalog page.");
    visited.add(next);
    const page = await fetchPage(next);
    for (const item of page.items) items.set(item.id, item);
    next = page.next;
  }
  return [...items.values()];
}
