import { ExploreFeed } from "@/components/explore-feed";
import { discoveryState } from "@/lib/discovery-options";

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  return <ExploreFeed key={params.toString()} initialState={discoveryState(params)} initialView={params.get("view") === "continue" ? "continue" : "browse"} />;
}
