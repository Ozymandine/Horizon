import { notFound } from "next/navigation";
import Link from "next/link";
import { SpotifyAlbumProfile } from "@/components/spotify-music";

export default async function SpotifyAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{22}$/.test(id)) notFound();
  return <main className="mx-auto min-h-screen max-w-[1400px] px-5 pb-40 pt-8 sm:px-8 lg:px-12">
    <div className="mb-5"><Link href="/discover?type=MUSIC" className="text-sm text-white/65 hover:text-white">← Music</Link></div>
    <SpotifyAlbumProfile spotifyAlbumId={id}/>
  </main>;
}
