import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { PLAYER_CORE_SCRIPT } from '../src/lib/player-display.ts';
import { DEFAULT_PLAYBACK_SETTINGS, playbackPreferences } from '../src/lib/playback-preferences.ts';

const window = {};
runInNewContext(PLAYER_CORE_SCRIPT, { window });
const core = window.HorizonPlayerCore, plain = (value) => JSON.parse(JSON.stringify(value));
function pixels(width, height, lit) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const index = (y * width + x) * 4, value = lit(x, y) ? 130 : 0; data[index] = data[index + 1] = data[index + 2] = value; data[index + 3] = 255; }
  return data;
}
test('time labels accurately format zero, minutes, hours and invalid values', () => {
  for (const [seconds, expected] of [[0, '00:00'], [1560.9, '26:00'], [9922, '2:45:22'], [-1, '00:00'], [NaN, '00:00'], [Infinity, '00:00']]) assert.equal(core.formatTime(seconds), expected);
});
test('fit-to-fill derives crop zoom from video dimensions and viewport without stretching', () => {
  assert.equal(core.fillScale(1920, 1080, 1920, 1080), 1); assert.ok(Math.abs(core.fillScale(1920, 800, 1920, 1080) - 1.35) < .000001); assert.ok(Math.abs(core.fillScale(1920, 1080, 1440, 1080) - 4 / 3) < .000001);
  assert.equal(core.fillScale(0, 1080, 1920, 1080), 1); assert.equal(core.fillScale(1920, 1080, 0, 1080), 1); assert.equal(core.fillScale(1920, 1080, 1, 9000), 3);
});
test('auto crop recognizes balanced encoded letterbox and pillarbox bands', () => {
  const letterbox = core.blackBarBounds(pixels(96, 54, (_x, y) => y >= 6 && y < 48), 96, 54); assert.deepEqual(plain(letterbox), { width: 1, height: 42 / 54 });
  const pillarbox = core.blackBarBounds(pixels(96, 54, (x) => x >= 10 && x < 86), 96, 54); assert.deepEqual(plain(pillarbox), { width: 76 / 96, height: 1 });
});
test('dark scenes, fades and unbalanced composition cannot establish a crop', () => {
  assert.equal(core.blackBarBounds(pixels(96, 54, () => false), 96, 54), null); assert.equal(core.blackBarBounds(pixels(96, 54, (x, y) => x > 45 && x < 50 && y > 25 && y < 29), 96, 54), null);
  assert.deepEqual(plain(core.blackBarBounds(pixels(96, 54, (_x, y) => y >= 8), 96, 54)), { width: 1, height: 1 }); assert.deepEqual(plain(core.blackBarBounds(pixels(96, 54, () => true), 96, 54)), { width: 1, height: 1 }); assert.equal(core.blackBarBounds(new Uint8Array(2), 96, 54), null);
});
test('global settings and player runtime share identical bounded preference defaults', () => {
  assert.deepEqual(playbackPreferences(null), DEFAULT_PLAYBACK_SETTINGS);
  for (const value of [null, {}, { fit: 'auto', zoom: 99, speed: -1, volume: 4, muted: true, subtitleSize: 500 }, { fit: 'unsupported', zoom: NaN, speed: Infinity, volume: '1', muted: 'true', subtitleSize: 1 }]) assert.deepEqual(plain(core.settings(value)), playbackPreferences(value));
});
test('browser core rejects corrupt saved progress and keys show episodes separately', () => {
  assert.equal(core.progressKey('movie', 603, 1, 1), 'movie:603'); assert.equal(core.progressKey('show', 1399, 2, 7), 'show:1399:2:7');
  for (const value of [null, { type: 'game' }, { type: 'movie', tmdbId: 603, position: Infinity, duration: 60 }, { type: 'movie', tmdbId: 603, position: 70, duration: 60 }, { type: 'show', tmdbId: 1399, position: 10, duration: 60, season: 1 }]) assert.equal(core.progress(value), null);
  const valid = { type: 'show', tmdbId: 1399, position: 1560.375, duration: 3600, season: 0, episode: 2 }; assert.equal(core.progress(valid), valid);
});
