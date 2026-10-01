export const SPOTIFY_CLIENT_KEY = "horizon-spotify-client-id";
export const SPOTIFY_PRODUCTION_REDIRECT_URI = "https://entertainment-horizon.vercel.app/spotify/callback";
const TOKEN_KEY = "horizon-spotify-access-token";
const TOKEN_EXPIRY_KEY = "horizon-spotify-token-expiry";
const LEGACY_REFRESH_KEY = "horizon-spotify-refresh-token";
const CONNECTED_KEY = "horizon-spotify-connected";
const VERIFIER_KEY = "horizon-spotify-code-verifier";
const STATE_KEY = "horizon-spotify-oauth-state";
const RETURN_KEY = "horizon-spotify-return-to";
const REDIRECT_KEY = "horizon-spotify-redirect-uri";

function notifySpotifyConnection() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("horizon:spotify-connection-changed"));
}

export function notifySpotifyPreferencesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("horizon:spotify-client-id-changed"));
}

export function subscribeSpotifyPreferences(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("horizon:spotify-connection-changed", onChange);
  window.addEventListener("horizon:spotify-client-id-changed", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("horizon:spotify-connection-changed", onChange);
    window.removeEventListener("horizon:spotify-client-id-changed", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function spotifyRedirectUri() {
  if (typeof window === "undefined") return SPOTIFY_PRODUCTION_REDIRECT_URI;
  const origin = window.location.origin;
  return origin === "https://entertainment-horizon.vercel.app"
    ? SPOTIFY_PRODUCTION_REDIRECT_URI
    : `${origin}/spotify/callback`;
}

export function spotifyClientId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SPOTIFY_CLIENT_KEY) || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || "";
}

export function getSpotifyClientIdSnapshot() {
  return spotifyClientId();
}

export function getSpotifyConnectionSnapshot() {
  return spotifyConnected();
}

function randomString(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[byte % 62]).join("");
}

function base64Url(value: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function beginSpotifyLogin(clientId: string, returnTo?: string) {
  const verifier = randomString(64);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64Url(digest);
  const state = randomString(32);
  const redirectUri = spotifyRedirectUri();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, returnTo || `${window.location.pathname}${window.location.search}`);
  sessionStorage.setItem(REDIRECT_KEY, redirectUri);
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "streaming user-read-playback-state user-modify-playback-state",
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString();
  window.location.assign(url);
}

export async function completeSpotifyLogin(code: string, returnedState: string) {
  const clientId = spotifyClientId();
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  if (!clientId || !verifier || !state || state !== returnedState) throw new Error("Spotify authorization could not be verified. Please connect again.");
  const redirectUri = sessionStorage.getItem(REDIRECT_KEY) || spotifyRedirectUri();
  const response = await fetch("/api/spotify/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grantType: "authorization_code", clientId, code, verifier, redirectUri }),
  });
  const payload = await response.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error || "Spotify could not authorize this account.");
  sessionStorage.setItem(TOKEN_KEY, payload.access_token);
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (payload.expires_in ?? 3600) * 1000));
  sessionStorage.removeItem(LEGACY_REFRESH_KEY);
  localStorage.setItem(CONNECTED_KEY, "true");
  notifySpotifyConnection();
  notifySpotifyPreferencesChanged();
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  return sessionStorage.getItem(RETURN_KEY) || "/discover?type=MUSIC";
}

export async function spotifyAccessToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expires = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY) ?? 0);
  const legacyRefreshToken = sessionStorage.getItem(LEGACY_REFRESH_KEY);
  if (token && expires > Date.now() + 60_000 && !legacyRefreshToken) return token;
  const clientId = spotifyClientId();
  if (!clientId) return null;
  const response = await fetch("/api/spotify/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grantType: "refresh_token", clientId, ...(legacyRefreshToken ? { legacyRefreshToken } : {}) }),
  }).catch(() => null);
  if (!response) return null;
  const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number };
  if (!response.ok || !payload.access_token) {
    if (response.status === 401) {
      localStorage.removeItem(CONNECTED_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
      sessionStorage.removeItem(LEGACY_REFRESH_KEY);
      notifySpotifyConnection();
    }
    return null;
  }
  sessionStorage.setItem(TOKEN_KEY, payload.access_token);
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (payload.expires_in ?? 3600) * 1000));
  sessionStorage.removeItem(LEGACY_REFRESH_KEY);
  localStorage.setItem(CONNECTED_KEY, "true");
  notifySpotifyConnection();
  return payload.access_token;
}

export async function refreshSpotifyAccessToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  return spotifyAccessToken();
}

export function spotifyConnected() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(CONNECTED_KEY) || sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(LEGACY_REFRESH_KEY));
}

export async function disconnectSpotify() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  sessionStorage.removeItem(LEGACY_REFRESH_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  localStorage.removeItem(CONNECTED_KEY);
  notifySpotifyConnection();
  await fetch("/api/spotify/session", { method: "DELETE" }).catch(() => undefined);
}

export function spotifyReturnTo() {
  return sessionStorage.getItem(RETURN_KEY) || "/discover?type=MUSIC";
}
