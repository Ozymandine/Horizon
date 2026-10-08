import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackCatalog, playbackEpisodes, playbackInteger } from '../src/lib/playback-metadata.ts';

test('playback query values are bounded integers, never upstream URLs or path fragments', () => {
  assert.equal(playbackInteger('603', 1, 2_147_483_647), 603);
  assert.equal(playbackInteger('0', 0, 1000), 0);
  for (const raw of [null, '', '00', '01', '-1', '1.2', '1e3', '1/season/2', 'https://localhost', '2147483648', '999999999999999']) {
    assert.equal(playbackInteger(raw, 1, 2_147_483_647), null);
  }
  assert.equal(playbackInteger('1001', 0, 1000), null);
});

test('movie metadata exposes only trusted artwork, official catalog fields, and US theatrical certification', () => {
  const result = playbackCatalog({ id: 603, title: 'The Matrix', overview: 'A real synopsis.', release_date: '1999-03-30', runtime: 136, vote_average: 8.2, poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg', images: { logos: [{ file_path: '/logo-de.png', iso_639_1: 'de' }, { file_path: '/logo.png', iso_639_1: 'en' }] }, release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG-13', type: 1 }, { certification: 'R', type: 3 }] }] } });
  assert.equal(result.title, 'The Matrix');
  assert.equal(result.year, '1999');
  assert.equal(result.runtime, 136);
  assert.equal(result.rating, 8.2);
  assert.equal(result.certification, 'R');
  assert.deepEqual(result.seasons, []);
  assert.equal(result.logoUrl, 'https://image.tmdb.org/t/p/w780/logo.png');
  assert.equal(result.posterUrl, 'https://image.tmdb.org/t/p/w500/poster.jpg');
  const rejected = playbackCatalog({ ...result, title: 'Movie', release_date: '', poster_path: 'https://evil.example/p.jpg', backdrop_path: '//evil.example/p.jpg', vote_average: 0, runtime: 0, images: { logos: [{ file_path: '/logo.png?redirect=evil', iso_639_1: 'en' }] } });
  assert.equal(rejected.logoUrl, null);
  assert.equal(rejected.posterUrl, null);
  assert.equal(rejected.backdropUrl, null);
  assert.equal(rejected.runtime, null);
  assert.equal(rejected.rating, null);
});

test('series metadata includes actual selectable seasons, specials, and TV content ratings', () => {
  const result = playbackCatalog({ id: 1399, name: 'Series', overview: 'Synopsis.', first_air_date: '2011-04-17', vote_average: 8.4, episode_run_time: [57], images: { logos: [{ file_path: '/neutral.png', iso_639_1: null }] }, content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] }, seasons: [{ season_number: 2, name: 'Season 2', episode_count: 10 }, { season_number: 0, name: 'Specials', episode_count: 5 }, { season_number: 1, name: 'Season 1', episode_count: 10 }, { season_number: 3, episode_count: 0 }, { season_number: -1, episode_count: 100 }, { season_number: 2, name: 'Season 2', episode_count: 10 }] });
  assert.equal(result.certification, 'TV-MA');
  assert.equal(result.runtime, 57);
  assert.equal(result.logoUrl, 'https://image.tmdb.org/t/p/w780/neutral.png');
  assert.deepEqual(result.seasons, [{ season: 0, name: 'Specials', episodeCount: 5 }, { season: 1, name: 'Season 1', episodeCount: 10 }, { season: 2, name: 'Season 2', episodeCount: 10 }]);
});

test('episode mapper sorts real season episodes, deduplicates numbers, and tolerates missing artwork or air dates', () => {
  const result = playbackEpisodes({ season_number: 2, episodes: [{ episode_number: 2, name: 'Second', overview: 'Two', still_path: '/still.jpg', runtime: 24, air_date: '2020-05-02' }, { episode_number: 1, name: 'First', overview: '', still_path: null, runtime: null, air_date: null }, { episode_number: 2, name: 'Second', overview: 'Two', still_path: '/still.jpg', runtime: 24, air_date: '2020-05-02' }, { episode_number: 0, name: 'Invalid' }, { episode_number: 10001, name: 'Invalid' }] });
  assert.deepEqual(result, { season: 2, episodes: [{ episode: 1, title: 'First', overview: '', stillUrl: null, runtime: null, airDate: null }, { episode: 2, title: 'Second', overview: 'Two', stillUrl: 'https://image.tmdb.org/t/p/w780/still.jpg', runtime: 24, airDate: '2020-05-02' }] });
});
