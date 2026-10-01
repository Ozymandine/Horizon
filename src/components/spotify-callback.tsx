"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { completeSpotifyLogin } from "@/lib/spotify-auth";

export function SpotifyCallback() {
  const params = useSearchParams();
  const code = params.get("code");
  const state = params.get("state");
  const authorizationError = params.get("error");
  const [message, setMessage] = useState(() => authorizationError
    ? "Spotify authorization was canceled."
    : !code || !state
      ? "Spotify didn’t return an authorization code. Please reconnect."
      : "Connecting your Spotify account…");

  useEffect(() => {
    if (authorizationError || !code || !state) return;
    void completeSpotifyLogin(code, state).then((returnTo) => {
      setMessage("Connected. Returning to Horizon…");
      window.location.replace(returnTo);
    }).catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Spotify connection failed."));
  }, [authorizationError, code, state]);

  return <main className="grid min-h-screen place-items-center px-5 text-center"><div className="glass max-w-md rounded-3xl p-8"><p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-100">Spotify</p><h1 className="mt-3 text-2xl font-semibold text-white">Account connection</h1><p role="status" className="mt-3 text-sm leading-6 text-white/70">{message}</p><a href="/discover?type=MUSIC" className="mt-5 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10">Back to music</a></div></main>;
}
