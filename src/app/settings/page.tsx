import { BackgroundSettings } from "@/components/background-settings";
import { SpotifySettings } from "@/components/spotify-settings";
import { PlaybackSettings } from "@/components/playback-settings";
import { safeReturnTo } from "@/lib/return-to";
import Image from "next/image";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnTo((await searchParams)?.returnTo);
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-slate-300">Settings</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Make Horizon feel like yours.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Your preferences and connected services stay saved in this browser.</p>
      <div className="glass mt-9 space-y-8 rounded-3xl p-5 sm:p-8">
        <SpotifySettings returnTo={returnTo} />
        <div className="border-t border-white/10 pt-8"><PlaybackSettings /></div>
        <div className="border-t border-white/10 pt-8"><BackgroundSettings /></div>
        <section className="border-t border-white/10 pt-6" aria-labelledby="credits-heading">
          <h2 id="credits-heading" className="text-base font-semibold text-white">Credits</h2>
          <a className="mt-4 block w-fit" href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><Image src="https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB" width={100} height={13} unoptimized/></a>
          <p className="mt-3 text-xs leading-6 text-white/60">Movie and TV data and images: <a className="text-cyan-100" href="https://www.themoviedb.org" target="_blank" rel="noreferrer">TMDB</a>. Streaming availability: <a className="text-cyan-100" href="https://www.justwatch.com" target="_blank" rel="noreferrer">JustWatch</a>.</p>
          <p className="mt-2 text-xs leading-6 text-white/60">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </section>
      </div>
    </main>
  );
}
