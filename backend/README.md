# Horizon's managed Node stream service

This native Express service resolves TMDB movie/show requests and relays HLS resources on Render. The website and player stay on Vercel. No Docker, headless browser, local daemon, or downloaded JavaScript execution is required.

Render is optional. Miami and Boise have also passed live movie and episode relay checks directly from Vercel. Leave `RENDER_URL` unset for that verified mode.

## Deploy

1. Push these files, including `backend/package-lock.json` and the root `render.yaml`, to the repository's `main` branch.
2. In Render, create a **Blueprint** from this repository using the root `render.yaml`. It declares a native Node web service in Frankfurt, `/health` checks, a generated secret, and deployment on matching commits. The selected free plan is for initial verification.
3. After it starts, copy its `https://…onrender.com` URL and generated **STREAM_RELAY_TOKEN** from Render's environment settings.
4. Set these two **server-only** values on the existing Vercel project, for the environment you deploy:

   ```dotenv
   RENDER_URL=https://YOUR-SERVICE.onrender.com
   STREAM_RELAY_TOKEN=THE_SAME_SECRET_GENERATED_BY_RENDER
   ```

   The URL must be an HTTPS origin with no endpoint path. Never use `NEXT_PUBLIC_` for the token. Keep this token and any `STREAM_TICKET_SECRET` stable across commits.
5. Redeploy Horizon on Vercel. Sign in, open a movie or show details page, and choose **Play**. Episode selectors are passed through automatically.

The Blueprint already contains these exact commands, run from the **repository root**:

```sh
npm ci --prefix backend --omit=dev && npm run build --prefix backend
npm start --prefix backend
```

Leave Render's Root Directory unset. The build copies the shared resolver, native cipher loops, and relay helpers into `backend/.build`, then uses the backend's locked dependencies. It does not install/build Next.js or require the frontend database. Render supplies `PORT` and `RENDER_EXTERNAL_URL` automatically.

## Frontend connection

The player asynchronously POSTs `{ type, tmdbId, season?, episode?, server? }` to Horizon's authenticated `/api/stream`. That route reads `process.env.RENDER_URL`, calls Render with the private bearer token, and translates the result to exactly:

```json
{ "source": "https://YOUR-HORIZON-HOST/api/proxy-stream?token=ENCRYPTED_CAPABILITY" }
```

Playlist variants, audio, subtitles, initialization files, segments, and AES keys use Horizon's same-origin `/api/proxy-stream`, then the authenticated Render relay. The player keeps `connect-src 'self'`, `media-src 'self' blob:`, and `frame-src 'none'`. Browser cookies, bearer credentials, and signed CDN URLs never go to a provider or appear in player code. Open `cors()` allows preflight requests; protected endpoints still require the bearer token.

Leaving `RENDER_URL` empty preserves the direct Vercel resolver. A configured Render service failing returns a controlled error; it does not substitute a sample or iframe.

## Backend endpoints

| Endpoint | Authentication | Result |
| --- | --- | --- |
| `GET /health` | None | Process health JSON; does not prove provider availability |
| `GET /api/stream/servers` | Same bearer | Configured server IDs and names |
| `POST /api/stream` | `Authorization: Bearer STREAM_RELAY_TOKEN` | Exact `{ "source": "https://SERVICE/api/proxy-stream?token=…" }` |
| `GET /api/stream?type=show&tmdbId=1399&season=1&episode=1` | Same bearer | Same source contract |
| `POST /api/resolve-stream` | Same bearer | Compatibility alias |
| `GET /api/proxy-stream?token=…` | Same bearer | Rewritten HLS, bounded media, or JSON error |

JSON input is limited to 4KB. Resolving has a 28-second deadline, four concurrent requests, and twelve starts per minute. Relaying has a 25-second deadline and a 32MB chunk limit. All protected requests share a concurrency limit of 24. DNS is restricted to approved public hosts and pinned to the connection. Provider requests use server-owned User-Agent/Referer headers. Upstream and post-header stream errors produce sanitized structured logs. SIGTERM drains requests before shutdown.

## Protocols and remaining playback dependency

The byte RC4 loops for VidSrc/Vidplay, AES-256-CBC token encoding/decoding for VidLink, and bounded base64/reversal loops for Embed.su live in `lib/stream-providers.mjs` and are packaged with this service. `server.js` supplies the historical VidLink key; `STREAM_VIDLINK_KEY` and `STREAM_VIDPLAY_KEYS` can override compatible rotated keys.

**These are known protocol implementations, not a guarantee that today's providers accept them.** VidSrc and VidCore catalog requests were blocked from both tested Vercel regions, VidLink returned no source, and Embed.su failed DNS. Moving to Render does not guarantee access. Live extraction and playback must be verified from the deployed Render service before calling it operational.

The default order is `miami,boise,orlando,paris,munich`. Their seed-bound `mvm1` responses are decoded entirely in Node by `lib/stream-movy.mjs`, with no external cryptographic helper. Seeds are cached for their short lifetime, capped at 60 seconds and 128 entries; simultaneous checks share a pending seed request. Explicit server selection attempts only that server. Automatic checks up to three servers concurrently, returns the first source with checked initial media, and tries every enabled server before reporting unavailable. Successful responses retain exact `{source}` JSON and include `X-Horizon-Stream-Server` for the selected registered ID. Paris and Munich movie media passed local checks October 7; Munich episode preflight also passed. Deployment availability can change.

Legacy adapters remain opt-in through `STREAM_PROVIDER_ORDER`. VidCore's rotating token format uses the server-side `https://enc-dec.app/api` data helper. That optional adapter has an external dependency; no helper scripts execute in Node or the browser. Override `STREAM_CRYPTO_API_URL` only with a compatible trusted data API.

If every provider fails, the endpoint returns `502 ALL_PROVIDERS_FAILED`, never a fabricated playback link. A changed CDN also fails closed until its exact verified hostname is added to `STREAM_ALLOWED_HOSTS`. If providers block Render too, an accessible compatible extractor remains necessary; see `docs/PRIVATE-STREAMING.md` for custom movie/show templates. Templates belong on Render in this mode. Provider URLs are server configuration, never frontend input.

The free service can sleep while idle. Open `/health` to let it start before the first playback test, then retry Play. This avoids mistaking a cold-start timeout for a provider failure. Vercel still carries browser-facing media, using bandwidth on both platforms. The relay isolates browser scripts and external requests; it cannot remove advertising embedded in video content.

## Optional local checks

No local process is needed once Render is deployed. For development:

```sh
npm ci --prefix backend
npm run build --prefix backend
npm run check --prefix backend
npm test --prefix backend
```

To run locally, copy `backend/.env.example` to `backend/.env`, replace the token with a random URL-safe secret of at least 32 characters, and run `npm start --prefix backend`. Local HTTP is for backend checks only; the Vercel gateway requires a public HTTPS origin.

References: [Render Blueprint fields](https://render.com/docs/blueprint-spec), [automatic URL/port environment](https://render.com/docs/environment-variables), [Node version selection](https://render.com/docs/node-version), [Express CORS](https://expressjs.com/en/resources/middleware/cors.html).
