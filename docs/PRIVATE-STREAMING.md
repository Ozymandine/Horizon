# Private playback on Vercel

## Current provider status

Horizon runs the resolver and HLS relay inside Vercel Node functions by default. Setting the server-only `RENDER_URL` enables the managed Express service in `backend/`; the browser still uses Horizon's same-origin APIs. Docker, Puppeteer and Playwright are not required by either deployment.

On October 4, 2026, the Node resolver successfully resolved **The Matrix (TMDB 603)** and **Game of Thrones S1E1 (TMDB 1399)** through VidCore. Local checks fetched the live master, a 1920×1080 rendition, its initialization file and three media segments through Horizon's authenticated relay. These were actual provider streams, not sample files. Provider availability and keys can change; this does not guarantee every title or mirror.

On October 5, 2026, **Miami, Boise and Orlando passed live Vercel relay checks**: Miami and Orlando resolved movie requests and Boise resolved a TV episode; Horizon fetched each playlist, two video segments, and initialization data where present through the authenticated same-origin relay. Browser checks also decoded the movie at 1920×1080 and advanced playback with zero iframes or external resource origins. Orlando uses an independently verified CDN. Render is optional for these adapters.

Earlier Vercel checks in `iad1` and `fra1` received HTTP 403 from VidSrc/VidCore catalog pages; VidLink returned no HLS source and Embed.su failed DNS. Those legacy adapters remain opt-in. Native decoding cannot remove an upstream access block, and a verified provider can still lack a particular title or episode.

The default fallback array is `miami,boise,orlando`. Every attempt has a deadline, and success is the exact `{ "source": "https://YOUR-HORIZON-HOST/api/proxy-stream?token=..." }` response. HLS playlists and a video rendition are validated before issuing a ticket. All providers failing returns controlled `502 ALL_PROVIDERS_FAILED` JSON. Manual selection attempts only the chosen enabled server and returns its controlled error if unavailable.

| Provider | Implementation | Current limitation |
| --- | --- | --- |
| Miami / Boise / Orlando | Native seed-bound mvm1 byte decoding using the public source API; no downloaded scripts or crypto helper | All three verified through Vercel's relay for tested movie/episode requests; availability can change. |
| VidSrc | Native byte-based RC4 source decoding, two-pass Vidplay ID encoding and futoken protocol | Current embed returns no legacy episode token locally; Vercel previously returned 403. Cryptography cannot remove an upstream IP block. |
| VidCore | Axios catalog/CSRF handshake and ranked mirror unlock, with a server-side token helper | Verified locally for a movie and episode; catalog page returns 403 from both tested Vercel regions. |
| VidLink | Native AES-CBC when a compatible key is configured; current token helper otherwise | Current test returned `null`; MP4/DASH are not mislabeled as HLS. |
| Embed.su | Native bounded base64/config/server-hash decoding, then `/api/e/{hash}` | Host currently fails DNS locally; its historical protocol is regression tested with fixtures. |

The default Miami/Boise/Orlando adapters use only native byte and integer operations. Seeds are cached for their short lifetime, capped at 60 seconds and 128 entries, and refreshed once after an upstream 401. The optional VidCore adapter uses `enc-dec.app` for its rotating token format. No helper or provider JavaScript runs in the browser or Node.

## Install and configure

For the managed Render backend, follow [backend/README.md](../backend/README.md). The root `render.yaml` declares its native Node build, start command, health check and generated secret. Set `RENDER_URL` and the matching `STREAM_RELAY_TOKEN` on Vercel to enable it. Live provider access from Render remains unverified; moving hosts cannot guarantee the removal of upstream blocks. The Vercel-only status below remains relevant when `RENDER_URL` is unset.

1. Use Node 22 or 24 and run `npm ci` in the repository root. Axios 1.20.0 and ipaddr.js 2.5.0 are locked dependencies. Plyr and hls.js are already installed and served locally.
2. Keep the existing `SITE_PASSWORD`, stable `AUTH_SECRET`, TMDB and database settings. The private HttpOnly login session protects the resolver, player and every media request.
3. Built-in providers require no new environment variables. Keep `AUTH_SECRET` stable across commits. Optional **server-only** settings:

```dotenv
STREAM_PROVIDER_ORDER=miami,boise,orlando
STREAM_CRYPTO_API_URL=https://enc-dec.app/api
# Only needed when the corresponding legacy protocol rotates:
STREAM_VIDPLAY_KEYS=["KEY_ONE","KEY_TWO"]
STREAM_VIDLINK_KEY=YOUR_64_HEX_CHARACTER_KEY
```

To use a custom extractor, set:

```dotenv
# Replace these examples with a real public extractor; example.org is not a provider.
STREAM_MOVIE_EXTRACTOR_URL=https://extractor.example.org/movie/{tmdbId}
STREAM_SHOW_EXTRACTOR_URL=https://extractor.example.org/tv/{tmdbId}/{season}/{episode}
STREAM_ALLOWED_HOSTS=cdn.example.org,segments.example.org
STREAM_REFERER=https://extractor.example.org/
```

The exact extractor hostnames are included automatically. Add every verified playlist, redirect, segment, audio, subtitle and AES-key hostname to `STREAM_ALLOWED_HOSTS`. Wildcards and arbitrary browser-supplied URLs are unsupported. Do not add advertising/analytics hosts just to make a player page load.

Leaving the extractor URLs empty enables the built-in fallback array. Setting custom URLs uses `custom` alone by default; explicitly set `STREAM_PROVIDER_ORDER=custom,vidcore,vidlink,embedsu` to combine it with fallbacks. `STREAM_USER_AGENT` optionally changes the standard browser User-Agent. `STREAM_TICKET_SECRET` optionally separates playback encryption from `AUTH_SECRET`; neither secret should change with a deployment. In direct Vercel mode no external relay host or bearer token is needed. Render mode uses the server-only `RENDER_URL` and `STREAM_RELAY_TOKEN`; neither mode needs `NEXT_PUBLIC_` settings or a local host service.

The built-in media allowlist contains `moon.zenoak.top`, `pulsedesk.top`, `emberwave.top`, and the exact Orlando worker hostname `dawn-dew-dd4f.barbaraadamse463.workers.dev`, verified during the live checks. A newly rotated CDN must be verified and added as an exact hostname to `STREAM_ALLOWED_HOSTS`. Resolver responses cannot grant arbitrary host access. Encrypted tickets preserve the selected provider's server-owned Referer across playlist, initialization, segment and key requests. Browser cookies, IP, Origin and authorization never go upstream; CSRF headers are sent only during provider control requests and cannot follow a redirect to another origin.

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

For an episode, send `{ type: 'show', tmdbId: 1399, season: 1, episode: 2 }`. Add `server: 'miami'`, `'boise'`, or `'orlando'` for manual selection, or omit it for Automatic. GET also accepts these fields and requires the private session. POST checks Origin and limits JSON to 4KB. `GET /api/stream/servers` returns only configured IDs and Horizon-owned names; Render mode retrieves the service's list.

A direct CDN URL alone would still require provider CORS and would expose the browser to that CDN. The returned absolute HTTPS `source` therefore points to Horizon's relay. That playlist rewrites every HLS resource to the same origin. Native Video.js HLS playback can consume this same `source` contract. The current Horizon player uses Plyr with hls.js and native HTML5 video.

Failures return bounded JSON with an appropriate HTTP status:

```json
{ "error": "The provider timed out. Try again shortly.", "code": "PROVIDER_TIMEOUT", "requestId": "..." }
```

Vercel logs contain request ID, operation, phase, provider name, error code, status, upstream HTTP status and hostname when available, and elapsed time. They exclude signed paths/queries, cookies, credentials, Axios configuration, upstream HTML and stacks. Resolution has a 28-second overall deadline within the 30-second function budget. Miami/Boise allow 6 seconds each and Orlando 8; legacy adapters retain their own deadlines. Individual Axios requests time out at 10 seconds and the relay at 25 seconds. Provider errors are caught rather than escaping the function.

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

Player scripts/styles/sprites are served locally. Workers, ads and persistent player storage are disabled. Controls remain white. The server selector preserves playback position when switching or retrying; changing episode starts at the beginning. Stale resolver and HLS callbacks cannot overwrite a newer selection. Existing YouTube trailers remain separate.

Vercel's function limits still apply. The relay uses a streamed response, which Vercel documents as an alternative to buffered payload limits; it remains subject to duration, bandwidth and plan limits. This is a per-segment relay, not a full movie download endpoint. Verify your provider's real chunk sizes and playback on the deployed plan.

## Verification

```powershell
npm test
npm run build --prefix backend
npm test --prefix backend
npm run lint
npx tsc --noEmit
npm run build
```

The regression suite now includes native cipher vectors, the complete VidCore handshake, failed-provider/failed-mirror fallback, cancellation, helper host validation, mismatched title rejection and Referer preservation across child tickets. Live movie and episode checks additionally fetch 1080p initialization and media bytes through the real relay. A previous local production browser test decoded the public sample at 1920×1080 with zero frames and same-origin player scripts; that sample check is separate from live extraction.

Tests cover exact source JSON, movies/episodes, base64/HTML/JSON parsing, input/authentication limits, provider HTTP failures/timeouts, sanitized logs, SSRF defenses, encrypted tickets, HLS rewriting, invalid media/keys, byte ranges, streamed responses above 4.5MB and the classic Node HTTP adapter. Public sample HLS verifies the relay/player pipeline separately; it does not prove VidSrc extraction.

The older `services/stream-relay` Express/Docker experiment remains outside the active route dependency graph. Only its pure data/security helpers are reused; none of its browser worker or container modules are imported into Vercel functions.

Primary guidance: [Axios request configuration](https://axios-http.com/docs/req_config), [Vercel streaming](https://vercel.com/docs/functions/streaming-functions), [Vercel payload guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [VidSrc embed documentation](https://vidsrc.to/), [Plyr](https://github.com/sampotts/plyr), [hls.js](https://github.com/video-dev/hls.js).

Protocol research: [scara78's legacy VidSrc protocol](https://github.com/scara78/vidsrc-new), [cool-dev-guy's separate VidSrc.net protocol](https://github.com/cool-dev-guy/vidsrc.ts), [historical Embed.su/VidLink protocols](https://github.com/heyitswit/vidsrc-bypass), [current crypto helper API and examples](https://github.com/smy778/EncDecEndpoints), [VidCore native resolver research](https://github.com/sharoon7171/vidcore-io-stream-resolver). The last framework recovers live material using a JavaScript VM; Horizon does not import or run that code. The adapters implement the documented data protocols and standard ciphers without fetching executable modules.
