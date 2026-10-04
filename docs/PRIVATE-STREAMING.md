# Private playback on Vercel

## Current provider status

Horizon now runs the resolver and HLS relay inside Vercel Node functions. **Docker, Express, Puppeteer and Playwright are not required by the deployed playback routes.**

A working extractor must expose an HLS URL as JSON, clear HTML, a bounded base64 string, or a direct HLS response. On October 3, 2026, `https://vidsrc.to/embed/movie/603` returned HTTP 200 player HTML with no `.m3u8` URL. The public VidSrc addon example returned embed links only. Standard HTTP headers cannot make Axios execute an obfuscated player or reveal a stream that is absent from its response. Live VidSrc movie/episode playback remains unverified until a working public extractor is supplied. The function returns `422 NO_HLS_SOURCE` for that case, with no sample or iframe fallback.

## Install and configure

1. Use Node 22 or 24 and run `npm ci` in the repository root. Axios 1.20.0 and ipaddr.js 2.5.0 are locked dependencies. Plyr and hls.js are already installed and served locally.
2. Keep the existing `SITE_PASSWORD`, stable `AUTH_SECRET`, TMDB and database settings. The private HttpOnly login session protects the resolver, player and every media request.
3. Set these **server-only** Vercel environment variables for your working extractor:

```dotenv
# Replace these examples with a real public extractor; example.org is not a provider.
STREAM_MOVIE_EXTRACTOR_URL=https://extractor.example.org/movie/{tmdbId}
STREAM_SHOW_EXTRACTOR_URL=https://extractor.example.org/tv/{tmdbId}/{season}/{episode}
STREAM_ALLOWED_HOSTS=cdn.example.org,segments.example.org
STREAM_REFERER=https://extractor.example.org/
```

The exact extractor hostnames are included automatically. Add every verified playlist, redirect, segment, audio, subtitle and AES-key hostname to `STREAM_ALLOWED_HOSTS`. Wildcards and arbitrary browser-supplied URLs are unsupported. Do not add advertising/analytics hosts just to make a player page load.

Leaving the extractor URLs empty uses VidSrc's documented `/embed/movie/{tmdbId}` and `/embed/tv/{tmdbId}/{season}/{episode}` paths. These are embed pages, **not documented raw-stream APIs**. `STREAM_USER_AGENT` optionally changes the standard browser User-Agent. `STREAM_TICKET_SECRET` optionally separates playback encryption from `AUTH_SECRET`; neither secret should change with a deployment. No `NEXT_PUBLIC_` settings, external relay URL, bearer token or local host service is needed.

4. Redeploy after changing server environment settings. For local verification, use `.env.local` and `npm run dev`; for production parity use `npm run build` then `npm start`.
5. Sign in, open an actual movie or show details page, and select **Play**. The action order is Play → Watch trailer → Add to My List → Add to timeline. Shows provide season/episode selectors.

## API contract

The production-ready Node entry point is `api/stream.js`; it imports the complete commented implementation in `lib/stream-serverless.mjs`. `api/proxy-stream.js` exposes the companion relay. Because this repository uses Next.js, `src/app/api/stream/route.ts` and `src/app/api/proxy-stream/route.ts` mount the same core at their actual URLs, with Node runtime and a 30-second function maximum. `/api/resolve-stream` remains an alias for older player tabs.

From the signed-in, same-origin frontend:

```javascript
const response = await fetch('/api/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'movie', tmdbId: 603 }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
// Exact success shape: { "source": "https://YOUR-HORIZON-HOST/api/proxy-stream?token=..." }
hls.loadSource(result.source);
```

For an episode, send `{ type: 'show', tmdbId: 1399, season: 1, episode: 2 }`. GET also accepts these fields as query parameters and requires the same private session. POST additionally checks Origin and limits JSON to 4KB, including chunked requests.

A direct CDN URL alone would still require provider CORS and would expose the browser to that CDN. The returned absolute HTTPS `source` therefore points to Horizon's relay. That playlist rewrites every HLS resource to the same origin. Native Video.js HLS playback can consume this same `source` contract. The current Horizon player uses Plyr with hls.js and native HTML5 video.

Failures return bounded JSON with an appropriate HTTP status:

```json
{ "error": "The provider timed out. Try again shortly.", "code": "PROVIDER_TIMEOUT", "requestId": "..." }
```

Vercel logs contain request ID, operation, phase, error code, status and elapsed time. They exclude cookies, credentials, Axios configuration, signed CDN URLs, upstream HTML and stack traces. Resolution has a 20-second overall deadline, individual Axios requests a 10-second timeout, and media relay requests a 25-second deadline. Provider errors are caught rather than escaping the function.

For a standalone Node project that uses the root `api/*.js` entry points directly, install the same dependencies, include their imported helper modules, and configure:

```json
{ "functions": { "api/stream.js": { "maxDuration": 30 }, "api/proxy-stream.js": { "maxDuration": 30 } } }
```

This extra `vercel.json` mapping is unnecessary for Horizon's Next.js route handlers.

## Relay and player protection

Axios uses the Node HTTP adapter with verified TLS, a fixed User-Agent/Referer, disabled automatic redirects and no environment proxy. Every redirect is validated separately. All DNS answers must be public, and the selected address is pinned to the socket to prevent DNS rebinding. Browser cookies, authorization, IP/forwarding headers and provider cookies never go upstream.

Extractor bodies are capped at 2MB, manifests at 1MB, AES-128 keys at exactly 16 bytes and each streamed media chunk at 32MB. A playlist is validated before a playback ticket is issued. Tickets are encrypted six-hour capabilities; proxy endpoints do not accept arbitrary URLs. The relay supports byte ranges and disconnect cancellation, with backpressure rather than whole-file buffering. Streaming failures after response headers close the connection and are logged.

Only HLS playlists, approved media MIME types, subtitles and AES-128 keys are delivered. HTML, image/pixel responses, unrelated playlist metadata, DRM and unsupported HLS variable substitution are rejected. This prevents third-party player scripts and popup frames from running in the client. It does not remove advertising already encoded into the video, guarantee that a provider has a stream, or hide Vercel's own server IP from that provider.

`src/lib/stream-player.ts` contains the complete HTML, CSS and JavaScript structure. `/api/stream-player` serves it with an HTTP CSP plus matching meta tag:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-src 'none';
frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'
```

Player scripts/styles/sprites are served locally. Workers, ads and persistent player storage are disabled. Controls remain white. Existing YouTube trailers are separate from this standalone playback document.

Vercel's function limits still apply. The relay uses a streamed response, which Vercel documents as an alternative to buffered payload limits; it remains subject to duration, bandwidth and plan limits. This is a per-segment relay, not a full movie download endpoint. Verify your provider's real chunk sizes and playback on the deployed plan.

## Verification

```powershell
npm test
npm test --prefix services/stream-relay
npm run lint
npx tsc --noEmit
npm run build
```

All 32 automated tests passed, along with lint, TypeScript and a production build. A local production browser test decoded the public sample at 1920×1080 through the new serverless-compatible relay, with zero frames and all player scripts on the application origin. Desktop and mobile movie headers had no taglines or horizontal overflow.

Tests cover exact source JSON, movies/episodes, base64/HTML/JSON parsing, input/authentication limits, provider HTTP failures/timeouts, sanitized logs, SSRF defenses, encrypted tickets, HLS rewriting, invalid media/keys, byte ranges, streamed responses above 4.5MB and the classic Node HTTP adapter. Public sample HLS verifies the relay/player pipeline separately; it does not prove VidSrc extraction.

The older `services/stream-relay` Express/Docker experiment remains outside the active route dependency graph. Only its pure data/security helpers are reused; none of its browser worker or container modules are imported into Vercel functions.

Primary guidance: [Axios request configuration](https://axios-http.com/docs/req_config), [Vercel streaming](https://vercel.com/docs/functions/streaming-functions), [Vercel payload guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [VidSrc embed documentation](https://vidsrc.to/), [Plyr](https://github.com/sampotts/plyr), [hls.js](https://github.com/video-dev/hls.js).
