"use client";

import { useEffect, useRef, useState } from "react";
import { beginSpotifyLogin, disconnectSpotify, notifySpotifyPreferencesChanged, spotifyClientId, SPOTIFY_CLIENT_KEY } from "@/lib/spotify-auth";

export function SpotifyConnect({ clientId, returnTo }: { clientId: string; returnTo: string }) {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      if (!/^[a-f\d]{32}$/i.test(clientId)) throw new Error("Enter your Spotify app Client ID in Settings to connect.");
      const previous = spotifyClientId();
      if (previous && previous !== clientId) await disconnectSpotify();
      localStorage.setItem(SPOTIFY_CLIENT_KEY, clientId);
      notifySpotifyPreferencesChanged();
      await beginSpotifyLogin(clientId, returnTo);
    })().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Spotify connection couldn’t start."));
  }, [clientId, returnTo]);
  return <main className="grid min-h-screen place-items-center px-5"><section className="glass w-full max-w-md rounded-3xl p-8 text-center"><h1 className="text-2xl font-semibold">Connect Spotify</h1><p role="status" className="mt-3 text-sm text-white/65">{error || "Opening Spotify…"}</p>{error && <a href="/settings" className="detail-action mt-5">Back to Settings</a>}</section></main>;
}
