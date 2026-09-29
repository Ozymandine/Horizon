import { BackgroundSettings } from "@/components/background-settings";

export default function SettingsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-slate-300">Settings</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Make Horizon feel like yours.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Your appearance choice stays saved in this browser.</p>
      <div className="glass mt-9 rounded-3xl p-5 sm:p-8"><BackgroundSettings /></div>
    </main>
  );
}
