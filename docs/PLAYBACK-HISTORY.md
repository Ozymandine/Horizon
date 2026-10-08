# Playback history

Horizon keeps playback progress in the existing private PostgreSQL database, independently of saved lists and the timeline. A bounded browser copy in `horizon:playback:v1` retains progress when the history API is temporarily unavailable.

Apply the additive database migration before deploying this version:

```powershell
npx prisma migrate deploy
npx prisma generate
```

`prisma migrate deploy` creates the `playback_progress` table and indexes. It does not reset existing data.

## API contract

All routes require the Horizon session cookie and return `Cache-Control: private, no-store`.

- `GET /api/playback/progress?type=movie&tmdbId=603` returns `{ "progress": recordOrNull }`.
- `GET /api/playback/progress?type=show&tmdbId=1399` returns the most recently watched episode, including its season and episode numbers.
- `GET /api/playback/progress?type=show&tmdbId=1399&season=1&episode=2` returns only that episode.
- `GET /api/playback/history?type=movie` or `type=show` returns `{ "items": [...] }`, most recent first. Completed records are included so clients group by title before removing completed entries; finishing a later episode therefore does not resurrect an earlier unfinished episode.
- `GET /api/playback/history?type=show&tmdbId=1399&season=1` returns recorded progress for the season, including completed episodes, for details-page badges.

`POST /api/playback/progress` accepts JSON or a JSON `text/plain` beacon body:

```json
{
  "type": "show",
  "tmdbId": 1399,
  "season": 1,
  "episode": 2,
  "position": 1560.375,
  "duration": 3600,
  "title": "Game of Thrones",
  "posterUrl": "https://image.tmdb.org/t/p/w500/example.jpg",
  "backdropUrl": null,
  "playbackId": "unique-playback-instance",
  "sessionStartedAt": 1791360000000,
  "recordedAt": 1791361560000,
  "sequence": 12,
  "restart": false
}
```

The response is `{ "saved": true, "progress": record }`. Ignored stale saves return `saved: false`. Timestamps are Unix milliseconds and sequence numbers increase within each player instance. Database transaction locks serialize updates per title across serverless instances. A newer playback session takes ownership; late requests from older tabs or episodes cannot overwrite it. Explicit `restart: true` saves position zero and clears completion.

Records use keys `movie:603` and `show:1399:1:2`, and expose `updatedAt` as an ISO date. Floating-point seconds preserve the actual position. Continue Watching groups shows by their latest recorded episode, excludes progress under five seconds and excludes completed playback. Completion means at least one minute of duration and no more than the smaller of 90 seconds or 4% of runtime remains.

Progress payloads are limited to 16 KiB, only movie/show IDs are accepted, timestamps cannot exceed server time by more than 30 seconds, and saved artwork must use clean HTTPS TMDB image URLs. Database errors return a recoverable 503 and never expose credentials or progress payloads in logs.
