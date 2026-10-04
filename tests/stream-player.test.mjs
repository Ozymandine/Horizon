import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_CSP, PLAYER_HTML, PLAYER_SCRIPT } from '../src/lib/stream-player.ts';

test('standalone player blocks external scripts, connections and frames without unsafe eval or inline JS', () => {
  for (const directive of ["default-src 'none'", "script-src 'self'", "connect-src 'self'", "frame-src 'none'", "frame-ancestors 'none'", "worker-src 'none'"]) assert.ok(PLAYER_CSP.includes(directive));
  assert.ok(!PLAYER_CSP.includes('unsafe-'));
  assert.ok(!PLAYER_HTML.includes('<iframe'));
  assert.ok(!PLAYER_HTML.includes('https://'));
  assert.equal([...PLAYER_HTML.matchAll(/<script/g)].length, 3);
});
test('player code parses and enables only local sprites, no ads, no workers or persistent storage', () => {
  assert.doesNotThrow(() => new Function(PLAYER_SCRIPT));
  for (const option of ["iconUrl: '/api/stream-player/assets/plyr.svg'", 'loadSprite: false', 'ads: { enabled: false }', 'enableWorker: false', 'storage: { enabled: false }']) assert.ok(PLAYER_SCRIPT.includes(option));
  assert.ok(PLAYER_SCRIPT.includes("source.origin !== location.origin"));
});
