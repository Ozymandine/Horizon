import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsPlaybackSave, continueWatchingRecords, normalizePlaybackRecord, parsePlaybackIdentity, parsePlaybackSave, playbackComplete, playbackKey, playbackResumeLink, readLocalPlaybackHistory, safePlaybackImage } from '../src/lib/playback-history.ts';

const now = 1_800_000_000_000;
const input = (overrides = {}) => ({ type: 'movie', tmdbId: 603, position: 1560, duration: 8100, title: 'The Matrix', posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg', playbackId: 'test-playback-1', sessionStartedAt: now - 60_000, recordedAt: now, sequence: 4, ...overrides });
const record = (overrides = {}) => normalizePlaybackRecord({ ...parsePlaybackSave(input(), now), updatedAt: new Date(now).toISOString(), ...overrides });

test('playback identities are restricted to TMDB movies and complete episode pairs', () => {
  assert.deepEqual(parsePlaybackIdentity({ type: 'show', tmdbId: '1399' }), { type: 'show', tmdbId: 1399 });
  assert.deepEqual(parsePlaybackIdentity({ type: 'show', tmdbId: 1399, season: 0, episode: 1 }, true), { type: 'show', tmdbId: 1399, season: 0, episode: 1 });
  for (const candidate of [{ type: 'game', tmdbId: 1 }, { type: 'movie', tmdbId: 1, episode: 1 }, { type: 'show', tmdbId: 1, season: 1 }, { type: 'movie', tmdbId: '1e2' }, { type: 'movie', tmdbId: -1 }]) assert.equal(parsePlaybackIdentity(candidate), null);
  assert.equal(playbackKey({ type: 'show', tmdbId: 1399, season: 2, episode: 7 }), 'show:1399:2:7');
});
test('exact progress is retained while metadata and client values are bounded', () => {
  const saved = parsePlaybackSave(input({ position: 1560.375, title: 'The\u0000 Matrix' }), now);
  assert.equal(saved.position, 1560.375);
  assert.equal(saved.title, 'The Matrix');
  assert.equal(saved.completed, false);
  for (const overrides of [{ position: Infinity }, { position: -1 }, { duration: NaN }, { duration: 200_000 }, { position: 9000 }, { sequence: -1 }, { playbackId: '../evil' }, { sessionStartedAt: now + 31_000 }, { recordedAt: now - 70_000 }]) assert.equal(parsePlaybackSave(input(overrides), now), null);
});
test('only clean TMDB HTTPS artwork URLs may be stored', () => {
  assert.equal(safePlaybackImage('https://image.tmdb.org/t/p/original/a.jpg'), 'https://image.tmdb.org/t/p/original/a.jpg');
  for (const url of ['javascript:alert(1)', 'https://tracker.example/pixel', 'http://image.tmdb.org/t/p/original/a.jpg', 'https://image.tmdb.org/t/p/original/a.jpg?tracking=1', 'https://image.tmdb.org/other/a.jpg']) assert.equal(safePlaybackImage(url), null);
});
test('completed entries leave Continue Watching and explicit restart clears completion', () => {
  assert.equal(playbackComplete(8060, 8100), true);
  assert.equal(playbackComplete(7990, 8100), false);
  assert.equal(playbackComplete(34, 35), false);
  const restart = parsePlaybackSave(input({ position: 8100, restart: true }), now);
  assert.equal(restart.position, 0);
  assert.equal(restart.completed, false);
});
test('newer playback sessions own progress and duplicate or delayed saves are ignored', () => {
  const previous = parsePlaybackSave(input(), now);
  assert.equal(acceptsPlaybackSave(previous, { ...previous, sequence: 5, recordedAt: now + 1 }), true);
  assert.equal(acceptsPlaybackSave(previous, { ...previous, sequence: 3, recordedAt: now + 1 }), false);
  assert.equal(acceptsPlaybackSave(previous, previous), false);
  assert.equal(acceptsPlaybackSave(previous, { ...previous, sequence: 5, recordedAt: now - 1 }), false);
  assert.equal(acceptsPlaybackSave(previous, { ...previous, playbackId: 'other-playback', sessionStartedAt: previous.sessionStartedAt - 1, sequence: 100, recordedAt: now + 100 }), false);
  assert.equal(acceptsPlaybackSave(previous, { ...previous, playbackId: 'other-playback', sessionStartedAt: previous.sessionStartedAt + 1, sequence: 0 }), true);
});
test('shows group by latest watched episode before removing completed or unstarted titles', () => {
  const older = record({ type: 'show', tmdbId: 1399, season: 1, episode: 1, updatedAt: new Date(now - 1000).toISOString() });
  const latest = record({ type: 'show', tmdbId: 1399, season: 1, episode: 2, position: 8099 });
  assert.deepEqual(continueWatchingRecords([older, latest], 'show'), []);
  const unfinished = record({ type: 'show', tmdbId: 1399, season: 2, episode: 3, position: 1560.5 });
  assert.deepEqual(continueWatchingRecords([older, unfinished], 'show').map((row) => row.key), ['show:1399:2:3']);
  assert.deepEqual(continueWatchingRecords([record({ position: 0 })], 'movie'), []);
});
test('resume links point to the private native player and preserve exact episodes', () => {
  const link = playbackResumeLink(record({ type: 'show', tmdbId: 1399, season: 2, episode: 3 }), '/discover?type=SHOW&view=continue');
  const url = new URL(link, 'https://horizon.example');
  assert.equal(url.pathname, '/api/stream-player');
  assert.equal(url.searchParams.get('season'), '2');
  assert.equal(url.searchParams.get('episode'), '3');
  assert.equal(url.searchParams.get('returnTo'), '/discover?type=SHOW&view=continue');
});
test('local history reads current-player map with recordedAt fallback and ignores malformed entries', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => JSON.stringify({ 'movie:603': { ...input(), completed: false }, bad: { type: 'show' } }) };
  try { const entries = readLocalPlaybackHistory(); assert.equal(entries.length, 1); assert.equal(entries[0].position, 1560); assert.equal(entries[0].updatedAt, new Date(now).toISOString()); }
  finally { if (previous) globalThis.localStorage = previous; else delete globalThis.localStorage; }
});
