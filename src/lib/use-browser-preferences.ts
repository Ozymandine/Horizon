"use client";

import { useSyncExternalStore } from "react";
import { getSpotifyClientIdSnapshot, getSpotifyConnectionSnapshot, spotifyRedirectUri, subscribeSpotifyPreferences } from "@/lib/spotify-auth";
import { getBackgroundPreferenceSnapshot, subscribeBackgroundPreference } from "@/lib/background-options";

function subscribeNothing() {
  return () => undefined;
}

export function useSpotifyConnected() {
  return useSyncExternalStore(subscribeSpotifyPreferences, getSpotifyConnectionSnapshot, () => false);
}

export function useSpotifyClientId() {
  return useSyncExternalStore(subscribeSpotifyPreferences, getSpotifyClientIdSnapshot, () => "");
}

export function useSpotifyRedirectUri() {
  return useSyncExternalStore(subscribeNothing, spotifyRedirectUri, () => "https://entertainment-horizon.vercel.app/spotify/callback");
}

export function useBackgroundPreference() {
  return useSyncExternalStore(subscribeBackgroundPreference, getBackgroundPreferenceSnapshot, () => "");
}
