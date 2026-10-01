import { notFound } from "next/navigation";
import Link from "next/link";
import { SpotifyArtistCatalog } from "@/components/spotify-music";

export default async function SpotifyArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{22}$/.test(id)) notFound();
  return <main className="mx-auto min-h-screen max-w-[1400px] px-5 pb-40 pt-8 sm:px-8 lg:px-12">
    <div className="mb-5"><Link href="/discover?type=MUSIC" className="text-sm text-white/65 hover:text-white">← Music</Link></div>
    <SpotifyArtistCatalog spotifyArtistId={id} artistName="" returnTo={`/music/artists/${id}`} fallback={<div className="glass rounded-3xl p-6 text-sm leading-6 text-white/75"><h1 className="text-2xl font-semibold text-white">Connect Spotify to view this artist</h1><p className="mt-2">This is an in-app artist page. Connect Spotify in Settings to load the artist’s catalog and play songs.</p><Link href="/settings" className="mt-4 inline-flex rounded-full border border-white/15 px-4 py-2 text-white hover:bg-white/10">Open Settings</Link></div>} />
  </main>;
}
