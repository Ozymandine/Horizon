import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
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

async function playerFixture(source, type = 'movie') {
  const elements = new Map();
  const sources = [], calls = [], instances = [];
  const document = {
    createElement() { return {}; },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: id === 'server' ? 'auto' : '1', hidden: false, textContent: '', currentTime: 0, duration: 7200, options: [], listeners: {}, appendChild(option) { this.options.push(option); }, addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener(name, fn) { if (this.listeners[name] === fn) delete this.listeners[name]; }, pause() {}, play() { return Promise.resolve(); }, removeAttribute() {}, load() {} });
      return elements.get(id);
    },
  };
  class Plyr { destroy() {} }
  class Hls {
    constructor(options) { this.options = options; this.events = {}; instances.push(this); }
    static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifest' };
    static isSupported() { return true; }
    on(event, callback) { this.events[event] = callback; }
    loadSource(url) { sources.push(url); }
    attachMedia() {}
    destroy() {}
  }
  runInNewContext(PLAYER_SCRIPT, {
    document, Plyr, Hls, AbortController, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { origin: 'https://horizon.example', search: `?type=${type}&tmdbId=603` },
    window: { addEventListener() {} },
    fetch: async (...args) => {
      if (args[0] === '/api/stream/servers') return Response.json({ servers: [{ id: 'miami', name: 'Miami' }, { id: 'boise', name: 'Boise' }] });
      calls.push(args); return Response.json({ source });
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { elements, sources, calls, instances };
}

test('player asynchronously fetches the private gateway and passes selected episode numbers', async () => {
  const source = 'https://horizon.example/api/proxy-stream?token=Ticket_123';
  const { elements, sources, calls } = await playerFixture(source, 'show');
  assert.deepEqual(sources, [source]);
  assert.equal(calls[0][0], '/api/stream');
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.equal(calls[0][1].cache, 'no-store');
  assert.deepEqual(JSON.parse(calls[0][1].body), { type: 'show', tmdbId: 603, season: 1, episode: 1 });
  elements.get('season').value = '2';
  elements.get('episode-number').value = '5';
  await elements.get('change-episode').listeners.click();
  assert.deepEqual(JSON.parse(calls[1][1].body), { type: 'show', tmdbId: 603, season: 2, episode: 5 });
  assert.deepEqual(sources, [source, source]);
  assert(!PLAYER_SCRIPT.includes('NEXT_PUBLIC_'));
});

test('server switches preserve playback position and episode changes start at the beginning', async () => {
  const { elements, calls, instances } = await playerFixture('https://horizon.example/api/proxy-stream?token=Ticket_123', 'show');
  const server = elements.get('server'), video = elements.get('player');
  assert.deepEqual(server.options.map((option) => option.value), ['miami', 'boise']);
  video.currentTime = 1234;
  video.readyState = 4;
  server.value = 'boise';
  await server.listeners.change();
  assert.equal(JSON.parse(calls[1][1].body).server, 'boise');
  assert.equal(instances[1].options.startPosition, 1234);
  video.currentTime = 0;
  await video.listeners.loadedmetadata();
  assert.equal(video.currentTime, 1234);
  video.readyState = 0;
  video.currentTime = 0;
  await elements.get('retry').listeners.click();
  assert.equal(instances[2].options.startPosition, 1234);
  await elements.get('change-episode').listeners.click();
  assert.equal(instances[3].options.startPosition, -1);
  instances[0].events.error(null, { fatal: true });
  assert.notEqual(elements.get('retry').hidden, false);
});

test('player rejects remote CDN, embed, malformed ticket and extra query URLs before media loads', async () => {
  for (const source of ['https://cdn.example/master.m3u8', 'https://horizon.example/embed/movie/603', 'https://horizon.example/api/proxy-stream?token=bad.token', 'https://horizon.example/api/proxy-stream?token=a&other=b']) {
    const { sources, elements } = await playerFixture(source);
    assert.deepEqual(sources, []);
    assert.match(elements.get('status').textContent, /invalid playback link/);
    assert.equal(elements.get('retry').hidden, false);
  }
});
