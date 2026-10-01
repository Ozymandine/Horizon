"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Disc3, ExternalLink, LogOut } from "lucide-react";
import { beginSpotifyLogin, disconnectSpotify, notifySpotifyPreferencesChanged, SPOTIFY_CLIENT_KEY, SPOTIFY_PRODUCTION_REDIRECT_URI, spotifyAccessToken } from "@/lib/spotify-auth";
import { useSpotifyClientId, useSpotifyConnected, useSpotifyRedirectUri } from "@/lib/use-browser-preferences";

export function SpotifySettings({ returnTo = "/discover?type=MUSIC" }: { returnTo?: string }) {
  const clientId = useSpotifyClientId();
  const redirectUri = useSpotifyRedirectUri();
  const [draft, setDraft] = useState("");
  const connected = useSpotifyConnected();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (connected) void spotifyAccessToken().then((token) => {
      if (token) setMessage("Your Spotify account is connected in this browser.");
    });
  }, [connected]);

  async function saveClientId() {
    const next = draft.trim();
    if (!next) return;
    setBusy(true);
    try {
      if (clientId && clientId !== next && connected) await disconnectSpotify();
      localStorage.setItem(SPOTIFY_CLIENT_KEY, next);
      notifySpotifyPreferencesChanged();
      setDraft("");
      setMessage("Client ID saved. Connect Spotify to finish setup.");
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    const id = (draft.trim() || clientId).trim();
    if (!id) {
      setMessage("Add your Spotify app Client ID first.");
      return;
    }
    if (draft.trim() && draft.trim() !== clientId) {
      if (connected) await disconnectSpotify();
      localStorage.setItem(SPOTIFY_CLIENT_KEY, draft.trim());
      notifySpotifyPreferencesChanged();
      setDraft("");
    }
    setBusy(true);
    setMessage("Opening Spotify authorization…");
    await beginSpotifyLogin(id, returnTo);
  }

  async function copyRedirect() {
    await navigator.clipboard.writeText(SPOTIFY_PRODUCTION_REDIRECT_URI);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function disconnect() {
    setBusy(true);
    await disconnectSpotify();
    setMessage("Spotify disconnected from this browser.");
    setBusy(false);
  }

  return <section aria-labelledby="spotify-settings-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-100">Music service</p>
        <h2 id="spotify-settings-title" className="mt-2 text-2xl font-semibold text-white">Spotify</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Connect once in this browser to search Spotify’s catalog and play full tracks. Horizon keeps your connection in a secure browser session and renews it when needed.</p>
      </div>
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${connected ? "border-emerald-200/25 bg-emerald-200/10 text-emerald-100" : "border-white/15 bg-white/[.05] text-white/60"}`}><Disc3 size={14}/>{connected ? "Connected" : "Not connected"}</span>
    </div>

    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)]">
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
        <label htmlFor="spotify-client-id" className="block text-sm font-medium text-white">Spotify app Client ID</label>
        <p className="mt-1 text-xs leading-5 text-white/55">Saved locally in this browser. This is the public Client ID from your Spotify Developer app.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input id="spotify-client-id" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={clientId ? `Saved · ${clientId.slice(0, 7)}…` : "Paste Client ID"} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-200/60" />
          {draft.trim() && <button type="button" disabled={busy} onClick={() => void saveClientId()} className="rounded-full border border-white/15 bg-white/[.08] px-4 py-2 text-sm text-white transition hover:bg-white/[.13] disabled:opacity-50">Save ID</button>}
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[.035] p-3">
          <p className="text-xs font-medium text-white/75">Permanent production redirect URI</p>
          <div className="mt-2 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all text-[11px] leading-5 text-white/65">{SPOTIFY_PRODUCTION_REDIRECT_URI}</code>
            <button type="button" onClick={() => void copyRedirect()} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-white/75 hover:bg-white/10"><span>{copied ? <Check size={13}/> : <Copy size={13}/>}</span>{copied ? "Copied" : "Copy"}</button>
          </div>
          {redirectUri && redirectUri !== SPOTIFY_PRODUCTION_REDIRECT_URI && <p className="mt-2 text-[11px] leading-5 text-amber-100/70">This is a preview or local address. Connect from entertainment-horizon.vercel.app to use the permanent URI; previews use their own origin.</p>}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/55 underline decoration-white/25 underline-offset-2 hover:text-white/80">Spotify Developer Dashboard <ExternalLink size={11}/></a>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
        <div><h3 className="font-medium text-white">Account connection</h3><p className="mt-2 text-xs leading-5 text-white/60">After the first connection, this browser can refresh Spotify access automatically. Use the same browser profile to stay connected.</p>{message && <p role="status" className="mt-3 text-xs text-emerald-100/80">{message}</p>}</div>
        {connected ? <button type="button" disabled={busy} onClick={() => void disconnect()} className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"><LogOut size={15}/>Disconnect Spotify</button> : <button type="button" disabled={busy} onClick={() => void connect()} className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100 disabled:opacity-50"><Disc3 size={15}/>{busy ? "Connecting…" : "Connect Spotify"}</button>}
      </div>
    </div>
    <p className="mt-4 text-[11px] leading-5 text-white/45">Spotify Premium is required for full-track playback in Horizon. Spotify controls catalog access and availability.</p>
  </section>;
}
