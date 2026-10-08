# Public streaming provider research

Checked on October 5 and October 7, 2026. The initial investigation was local; subsequent Miami/Boise/Orlando integration checks also passed from Vercel. October 7 added local Paris/Munich movie and Munich episode preflight checks. Render has not been deployed or tested.

## Confirmed Movy connection

Movy's public player bundle exposes a streaming API at `https://api.wecollege.net` and source labels including Miami, Boise, Seattle, Vegas, Phoenix, Atlanta, Portland, Austin, Dallas, Tampa, Orlando, Munich, Berlin, Paris, Delhi, and Cancun. These are provider labels; their names do not establish the physical locations of servers or an equivalence with VidSrc.

The observed protocol is:

1. Fetch `/seed?mediaId={tmdbId}`. The response contains a seed and its lifetime.
2. Fetch `/{provider}/sources` with `tmdbId`, `mediaType`, `enc=2`, and the seed. TV requests additionally use `seasonId` and `episodeId`, with `mediaType=tv`.
3. Decode the base64url response using the seed, TMDB ID, and the public player's 32-bit arithmetic byte stream. Validate its `mvm1` signature before parsing JSON. No browser, remote script evaluation, or remote cryptographic helper was needed for these checks.
4. Inspect the returned `sources` array, validate the selected HLS URL, and relay manifests and segments through Horizon's authenticated backend.

The minimum TMDB movie/episode parameters worked for Miami and Boise. Title, year, and IMDb ID were unnecessary for those tested routes. Other routes can have different requirements and availability.

### Local results

| Request | Result |
| --- | --- |
| Miami, movie TMDB 603 | Decoded 480p, 720p, 1080p, and 2160p sources |
| Boise, movie TMDB 603 | Decoded the same quality labels and CDN host; not established as an independent mirror |
| Miami, TV TMDB 1399, season 1, episode 1 | Decoded 480p, 720p, 1080p, and 2160p sources |
| Seattle, movie TMDB 603 with title metadata | HTTP 404 |
| Movie 1080p playlist | Valid complete HLS playlist, approximately 136 minutes; initialization data and two video segments fetched |
| TV episode 1080p playlist | Valid complete HLS playlist, approximately 62 minutes; initialization data and two video segments fetched |
| Orlando, movie TMDB 603 | Decoded HLS on a separate exact worker hostname; complete playlist and three valid MPEG-TS video segments fetched locally |
| Paris, movie TMDB 603, October 7 | Complete HLS and three valid MPEG-TS segments from Orlando's existing exact worker hostname |
| Munich, movie TMDB 603, October 7 | Complete HLS and three valid MPEG-TS segments from independently checked `sun.paleoak.top` |
| Munich, TMDB 1399 S1E1, October 7 | Updated resolver preflight checked HLS and initial media successfully |
| Berlin, movie TMDB 603, October 7 | Source request timed out; excluded |
| Phoenix / Portland / Tampa / Dallas / Vegas | Source, playlist, rendition or timeout checks failed; these routes are excluded from the default selector |

Miami/Boise media came from `moon.zenoak.top`. Orlando/Paris's exact `dawn-dew-dd4f.barbaraadamse463.workers.dev` hostname and Munich's `sun.paleoak.top` were independently checked with pinned public DNS, verified TLS, complete playlists, and real segments, then added to the media host list. The same CDN can behave differently for different source routes; Munich's October 7 result does not establish that rejected Phoenix/Portland routes work. Signed URLs were kept in ignored research files and are not documented here. One initial movie playlist fetch reset its connection; a subsequent fetch succeeded. Long playback and subtitle behavior remain unverified.

## Horizon integration path

Use a provider-specific Node adapter in the existing resolver, followed by the existing HLS validation, signed playback ticket, and same-origin relay. The frontend should continue receiving `{ "source": "https://<horizon>/api/proxy-stream?token=..." }` and use its native player.

Horizon now implements this adapter in `lib/stream-movy.mjs` and `lib/stream-providers.mjs`. The default selector offers Automatic, Miami, Boise, Orlando, Paris and Munich. Manual selection uses the chosen server. Automatic uses a pool of at most three checks, validates initial media, and tries every enabled server before returning unavailable. Browser code preserves position when switching and retrying. `/api/stream/servers` reflects the direct resolver's or optional Render service's configuration; `X-Horizon-Stream-Server` reports a successful selection without changing `{source}` JSON.

Vercel checks successfully resolved Miami and Orlando movies and a Boise episode, then fetched two video segments and initialization data where present through Horizon's authenticated relay. Local browser checks decoded the movie at 1920×1080 and advanced real playback with zero iframes and external resource origins. These checks do not guarantee every title, geographic region, or future provider availability.

## Other findings

- Cinejoy exposes public movie and episode watch routes, but its source mapping was not confirmed. Its obfuscated frontend was inspected as data, without executing it.
- Vidy's public integration page documents iframe movie/TV routes. That integration does not satisfy Horizon's existing native-player and no-iframe requirements.
- FMHY lists Movy and Cinejoy as stream aggregators. FMHY itself is a directory, not a stream resolver API.

## Primary references

- [FMHY stream aggregators](https://fmhy.net/video#stream-aggregators)
- [Movy](https://www.movy.sx/)
- [Observed Movy public player bundle](https://www.movy.sx/_next/static/chunks/2u-uvutpg8360.js) — hashed asset URLs may change
- [Cinejoy](https://cinejoy.pk/)
- [Vidy integration documentation](https://www.vidy.st/#docs)
