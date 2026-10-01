import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "horizon-spotify-refresh";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const COOKIE_AGE = 60 * 60 * 24 * 180;

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function setRefreshCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/spotify/session",
    maxAge: COOKIE_AGE,
  });
}

function clearRefreshCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/spotify/session",
    maxAge: 0,
  });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function tokenRequest(body: URLSearchParams) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as TokenResponse;
  return { response, payload };
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Request origin was not accepted.", 403);
  const input = await request.json().catch(() => null) as {
    grantType?: string;
    clientId?: string;
    code?: string;
    verifier?: string;
    redirectUri?: string;
    legacyRefreshToken?: string;
  } | null;
  if (!input?.clientId?.trim()) return jsonError("Spotify Client ID is required.", 400);

  let requestBody: URLSearchParams;
  let refreshCookieFallback = "";
  if (input.grantType === "authorization_code") {
    if (!input.code || !input.verifier || !input.redirectUri) return jsonError("Spotify authorization details are incomplete.", 400);
    const redirect = new URL(input.redirectUri);
    if (redirect.origin !== new URL(request.url).origin || redirect.pathname !== "/spotify/callback") {
      return jsonError("Spotify callback URL does not match this site.", 400);
    }
    requestBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.clientId.trim(),
      code_verifier: input.verifier,
    });
  } else if (input.grantType === "refresh_token") {
    const refreshToken = request.cookies.get(COOKIE_NAME)?.value || input.legacyRefreshToken;
    if (!refreshToken) return jsonError("Spotify session expired. Please connect again.", 401);
    refreshCookieFallback = refreshToken;
    requestBody = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: input.clientId.trim(),
    });
  } else {
    return jsonError("Unsupported Spotify token request.", 400);
  }

  try {
    const { response: spotifyResponse, payload } = await tokenRequest(requestBody);
    if (!spotifyResponse.ok || !payload.access_token) {
      return jsonError(payload.error_description || "Spotify could not renew this session.", spotifyResponse.status === 400 || spotifyResponse.status === 401 ? 401 : 502);
    }
    const result = NextResponse.json({ access_token: payload.access_token, expires_in: payload.expires_in ?? 3600 });
    const refreshedToken = payload.refresh_token || refreshCookieFallback;
    if (refreshedToken) setRefreshCookie(result, refreshedToken);
    return result;
  } catch {
    return jsonError("Spotify is temporarily unavailable.", 502);
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Request origin was not accepted.", 403);
  const response = NextResponse.json({ connected: false });
  clearRefreshCookie(response);
  return response;
}
