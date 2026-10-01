"use client";

import { useEffect, useRef, useState } from "react";
import type { RadarItem } from "@/lib/radar";

export type Collection = { items: RadarItem[]; hasMore: boolean };
const collections = new Map<string, { data: Collection; time: number }>();
const pending = new Map<string, Promise<Collection>>();
export async function fetchCollection(key: string, page = 1): Promise<Collection> {
  const cacheKey = `${key}&page=${page}`;
  const cached = collections.get(cacheKey);
  if (cached && Date.now() - cached.time < 5 * 60_000) return cached.data;
  if (pending.has(cacheKey)) return pending.get(cacheKey)!;
  const request = fetch(`/api/discover?${cacheKey}`, { signal: AbortSignal.timeout(25_000) }).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "This collection couldn’t load.");
    const result = data as Collection;
    collections.set(cacheKey, { data: result, time: Date.now() });
    if (collections.size > 100) collections.delete(collections.keys().next().value!);
    return result;
  }).finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, request);
  return request;
}
export function useDiscoveryCollection(key: string, enabled = true) {
  const [result, setResult] = useState<{ key: string; data: Collection } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [more, setMore] = useState(false);
  const page = useRef(1);
  const activeKey = useRef(key);
  useEffect(() => {
    activeKey.current = key;
    page.current = 1;
    if (!enabled) return;
    let cancelled = false;
    void fetchCollection(key).then((data) => {
      if (!cancelled) { setResult({ key, data }); setFailure(null); }
    }).catch((error: unknown) => {
      if (!cancelled) setFailure({ key, message: error instanceof Error ? error.message : "Please try again." });
    });
    return () => { cancelled = true; };
  }, [key, enabled, retry]);
  const data = result?.key === key ? result.data : null;
  const error = failure?.key === key ? failure.message : "";
  async function loadMore() {
    if (!data?.hasMore || more) return;
    setMore(true);
    const requestKey = key;
    try {
      const nextPage = page.current + 1;
      const next = await fetchCollection(key, nextPage);
      if (activeKey.current !== requestKey) return;
      page.current = nextPage;
      setResult((previous) => {
        if (previous?.key !== requestKey) return previous;
        const unique = new Map(previous.data.items.map((item) => [`${item.source}:${item.sourceId}`, item]));
        next.items.forEach((item) => unique.set(`${item.source}:${item.sourceId}`, item));
        return { key: requestKey, data: { items: [...unique.values()], hasMore: next.hasMore } };
      });
      setFailure(null);
    } catch (cause) {
      if (activeKey.current === requestKey) setFailure({ key: requestKey, message: cause instanceof Error ? cause.message : "More titles couldn’t load." });
    } finally { setMore(false); }
  }
  return { data, error, loading: enabled && !data && !error, more, loadMore, retry: () => { setFailure(null); setRetry((value) => value + 1); } };
}
