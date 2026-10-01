import { Suspense } from "react";
import { SpotifyCallback } from "@/components/spotify-callback";

export default function SpotifyCallbackPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center text-sm text-white/75">Connecting Spotify…</main>}><SpotifyCallback /></Suspense>;
}
