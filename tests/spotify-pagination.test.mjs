import test from 'node:test';
import assert from 'node:assert/strict';
import { completeSpotifyPage } from '../src/lib/spotify-pagination.ts';

test('collects every catalog page and deduplicates IDs before returning', async () => {
  const first = { items: [{ id: 'a' }], next: 'https://api.spotify.com/v1/artists/a/albums?offset=10', total: 3 };
  let requests = 0;
  const result = await completeSpotifyPage(first, async () => {
    requests++;
    return requests === 1 ? { items: [{ id: 'a' }, { id: 'b' }], next: 'https://api.spotify.com/v1/artists/a/albums?offset=20', total: 3 } : { items: [{ id: 'c' }], next: null, total: 3 };
  });
  assert.deepEqual(result.map((item) => item.id), ['a', 'b', 'c']);
  assert.equal(requests, 2);
});
test('rejects repeated pages, foreign hosts and cancelled requests', async () => {
  const page = { items: [], next: 'https://api.spotify.com/v1/albums?offset=10', total: 10 };
  await assert.rejects(completeSpotifyPage(page, async () => page), /repeated/);
  await assert.rejects(completeSpotifyPage({ ...page, next: 'https://evil.example/v1/albums' }, async () => page), /Invalid/);
  await assert.rejects(completeSpotifyPage(page, async () => page, () => true), /cancelled/);
});
test('never publishes a partial catalog when a later page fails', async () => {
  await assert.rejects(completeSpotifyPage({ items: [{ id: 'a' }], next: 'https://api.spotify.com/v1/albums', total: 2 }, async () => { throw new Error('rate limited'); }), /rate limited/);
});
