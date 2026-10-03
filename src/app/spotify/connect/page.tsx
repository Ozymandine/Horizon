import { SpotifyConnect } from "@/components/spotify-connect";
import { safeReturnTo } from "@/lib/return-to";

export default async function SpotifyConnectPage({ searchParams }: { searchParams: Promise<{ clientId?: string; returnTo?: string }> }) {
  const { clientId, returnTo } = await searchParams;
  return <SpotifyConnect clientId={clientId?.trim() ?? ""} returnTo={safeReturnTo(returnTo || "/discover?type=MUSIC")}/>;
}
