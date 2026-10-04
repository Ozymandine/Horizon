# Private playback

## Components

The movie/show details actions are **Play → Watch trailer → Add to My List → Add to timeline**. Play opens a standalone HTML5 player. Shows include season/episode selectors. No streaming iframe is embedded in Horizon.

Horizon authenticates every player, asset, resolver and media request with its existing private session. The browser sends a TMDB ID to `/api/resolve-stream`; the Next.js route forwards it to a separate Node.js/Express relay using a server-only bearer token. The relay returns an encrypted, expiring `/api/proxy-stream?token=…` link. The browser never receives a provider URL, relay credential or provider HTML.

The relay first extracts playlist URLs from JSON/HTML/base64 **as data**. For the configured VidSrc HTML interface, it can run Chromium in an ephemeral Docker worker. The worker has no network interface, dashboard credentials, mounted host files or host browser profile. A bounded RPC broker supplies allowlisted HTTPS resources through validated, pinned public IPs. Provider JavaScript, including its own deobfuscation/canvas code, runs only in that worker. We do not implement provider-specific RC4 secrets or execute provider JavaScript in the Node process.

The media relay rewrites HLS variants, audio/subtitle playlists, init segments, AES-128 keys and media segments. It supports byte ranges, bounded buffering and disconnect cancellation. It never forwards client cookies, authorization, IP headers or provider cookies to a CDN. Images, HTML and tracking metadata are rejected. This prevents client exposure to provider scripts/popups; it **does not remove ads already encoded into the video**, guarantee source availability, or conceal the relay server's IP from the provider.

## Installation (Node 22+; Docker required for the HTML resolver)

Run in the repository root:

```powershell
npm ci
npm ci --prefix services/stream-relay
docker build -f services/stream-relay/Dockerfile.worker -t horizon-resolver:1 services/stream-relay
Copy-Item services/stream-relay/.env.example services/stream-relay/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated token into `services/stream-relay/.env` as `STREAM_RELAY_TOKEN`. Put the same token in the root `.env.local` alongside:

```dotenv
STREAM_RELAY_URL=http://127.0.0.1:4100
STREAM_RELAY_TOKEN=<the same random token>
```

Keep the existing `SITE_PASSWORD`, `AUTH_SECRET`, database and TMDB settings. These env files are ignored by Git. No Axios or BeautifulSoup is necessary: Node's HTTPS streams handle retrieval and Express handles the private API. Playwright is installed in the worker; Plyr and hls.js are self-hosted from Horizon's locked npm dependencies.

Start the relay in one terminal:

```powershell
Set-Location services/stream-relay
npm start
```

Start Horizon in another terminal:

```powershell
npm run build
npm start
```

For local development use `npm run dev` instead. Sign in, open a movie/show detail page and select Play. The relay binds loopback by default. The worker requires Docker's non-root Chromium sandbox and the included seccomp profile; it fails closed if Docker or the sandbox is unavailable. Do not disable the sandbox to work around a host configuration error.

## Provider configuration and verification

The current [VidSrc page](https://vidsrc.to/) publishes `/embed/movie/{id}` and `/embed/tv/{id}/{season}/{episode}`, rather than `https://vidsrc.to{id}`. At implementation time the sampled embed pages pointed to `vsembed.ru`. The configured templates use these documented paths. Their HTML includes trackers, which are excluded from the worker's default host list.

`STREAM_ALLOWED_HOSTS` is an exact host allowlist, not a wildcard or a browser-supplied URL. Both provider pages and every playlist/segment/CDN host must be on it. A changing provider can require additional **verified** script/API/CDN hosts. Failed resolution reports blocked hostnames without signed URLs; it does not silently allow arbitrary hosts. Do not add analytics/ad hosts simply to make all page resources load. There is no automatic trust of unknown CDN hosts.

An endpoint can return HTTP 200 without exposing a usable stream. Real provider playback requires the worker to run successfully, a valid source for the requested title and the current CDN allowlist. Unsupported DRM, HLS variable substitution and provider challenges that cannot run in the isolated worker produce a clean error. There is no fallback third-party iframe.

## Self-hosting and Vercel

For a completely private deployment, run **both Horizon and the relay on your own host**, behind HTTPS and your private network/VPN. Preserve the existing application login. For local use, all browser requests go to the Next.js origin; no permissive CORS is needed.

Vercel can host the UI and authenticated forwarding routes, but cannot run this long-lived Docker resolver. `127.0.0.1:4100` on Vercel is not your computer. To connect that UI to a separately hosted relay, give the relay a reachable HTTPS origin, set `STREAM_RELAY_URL`/`STREAM_RELAY_TOKEN` in Vercel's server environment, and protect the relay behind TLS and its bearer authentication. The relay URL/token are never `NEXT_PUBLIC_` values. A Vercel UI remains cloud hosted, so choose full self-hosting if that is your privacy requirement.

## Files and tests

Verification on this workstation passed 17 automated tests, lint, TypeScript and the production build. A public Big Buck Bunny HLS sample played through the authenticated relay and native player at 1080p with no frames or external player scripts. That sample is an ignored local test fixture, not a configured movie source.

Live VidSrc extraction has **not** been verified: Docker is not installed on this workstation, and no self-hosted worker address has been supplied. The deployed UI reports the missing relay setup. Complete the Docker setup and verify the current provider/CDN allowlist before relying on movie or episode playback.

- `services/stream-relay/server.mjs`: authenticated resolver and reverse proxy.
- `services/stream-relay/security.mjs`: host/DNS checks, pinned HTTPS, ranges and encrypted capabilities.
- `services/stream-relay/hls.mjs`: data extraction and HLS rewriting.
- `services/stream-relay/resolver.mjs` / `browser-worker.mjs`: isolated worker and bounded network broker.
- `src/lib/stream-player.ts`: complete HTML, local CSS/JS and strict CSP. Player controls are white.
- `src/app/api/stream-player/*`, `resolve-stream`, `proxy-stream`: same-origin authenticated integration.

```powershell
npm test --prefix services/stream-relay
node --test --experimental-strip-types tests/spotify-pagination.test.mjs
npm run lint
npx tsc --noEmit
npm run build
```

The CSP uses local scripts/styles, same-origin connections/media plus MediaSource blobs, and `frame-src 'none'`. hls.js workers, external sprites, player ads and local-storage tracking are disabled. Existing YouTube trailers live on the details page, outside this standalone playback document.

Primary library guidance: [Plyr](https://github.com/sampotts/plyr), [hls.js](https://github.com/video-dev/hls.js), [Playwright's Docker/sandbox guidance](https://playwright.dev/docs/docker). The included seccomp profile is from Playwright's Apache-2.0 project (`utils/docker/seccomp_profile.json`).
