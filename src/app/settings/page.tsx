import { BackgroundSettings } from "@/components/background-settings";
import { SpotifySettings } from "@/components/spotify-settings";
import { safeReturnTo } from "@/lib/return-to";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnTo((await searchParams)?.returnTo);
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-slate-300">Settings</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Make Horizon feel like yours.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Your preferences and connected services stay saved in this browser.</p>
      <div className="glass mt-9 space-y-8 rounded-3xl p-5 sm:p-8">
        <SpotifySettings returnTo={returnTo} />
        <div className="border-t border-white/10 pt-8"><BackgroundSettings /></div>
      </div>
    </main>
  );
}
