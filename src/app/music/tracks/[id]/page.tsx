import { notFound } from "next/navigation";
import Link from "next/link";
import { SpotifyTrackLyricsPage } from "@/components/spotify-music";

export default async function SpotifyTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{22}$/.test(id)) notFound();
  return <main className="mx-auto min-h-screen max-w-[1500px] px-4 pb-32 pt-4 sm:px-8 sm:pt-8">
    <div className="mb-4"><Link href="/discover?type=MUSIC" className="text-sm text-white/65 hover:text-white">← Music</Link></div>
    <SpotifyTrackLyricsPage spotifyTrackId={id}/>
  </main>;
}
