import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { PLAYER_CSP, PLAYER_CSS, PLAYER_HTML, PLAYER_SCRIPT } from '../src/lib/stream-player.ts';
import { PLAYER_CORE_SCRIPT } from '../src/lib/player-display.ts';
import { parsePlaybackSave } from '../src/lib/playback-history.ts';

const ORIGIN = 'https://horizon.example', SOURCE = `${ORIGIN}/api/proxy-stream?token=Ticket_123`, HISTORY = 'horizon:playback:v1', now = Date.now();
const progress = (overrides = {}) => ({ key: 'movie:603', type: 'movie', tmdbId: 603, position: 1560.375, duration: 8100, title: 'The Matrix', completed: false, updatedAt: new Date(now - 1000).toISOString(), ...overrides });
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve)); };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

// Preserve real listener multiplicity/once behavior. Metadata is fired explicitly
// by each test, making source-switch races reproducible without network/video IO.
class Element {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase(); this.id = id; this.children = []; this.listeners = new Map(); this.attributes = new Map();
    this.value = id === 'server' ? 'auto' : id === 'season' ? '1' : ''; this.hidden = id.endsWith('-panel') || id === 'retry';
    this.textContent = ''; this.innerHTML = ''; this.dataset = {}; this.style = { setProperty(key, value) { this[key] = value; } };
    this.classList = { values: new Set(), add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); }, contains(value) { return this.values.has(value); } };
    this.clientWidth = 1920; this.clientHeight = 1080; this.currentTime = 0; this.duration = 8100; this.readyState = 0;
    this.videoWidth = 1920; this.videoHeight = 1080; this.paused = true; this.ended = false; this.volume = 1; this.muted = false; this.textTracks = []; this.controls = true;
  }
  get options() { return this.children.filter((node) => node.tagName === 'OPTION'); }
  addEventListener(name, callback, options = {}) { const list = this.listeners.get(name) ?? []; list.push({ callback, once: options.once === true }); this.listeners.set(name, list); }
  removeEventListener(name, callback) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter((entry) => entry.callback !== callback)); }
  async emit(name, event = {}) { for (const entry of [...(this.listeners.get(name) ?? [])]) { if (entry.once) this.removeEventListener(name, entry.callback); await entry.callback({ target: this, currentTarget: this, ...event }); } }
  appendChild(node) { this.children.push(node); node.parent = this; return node; }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'src') this.src = ''; }
  querySelector() { return this.children[0] ?? null; }
  closest() { return this.parent ?? null; }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  matches() { return false; }
  focus() {}
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); }
  getContext() { return null; }
  load() { this.readyState = 0; this.currentTime = 0; }
  pause() { const changed = !this.paused; this.paused = true; if (changed) void this.emit('pause'); }
  play() { this.paused = false; void this.emit('playing'); return Promise.resolve(); }
  canPlayType() { return ''; }
}

async function playerFixture(options = {}) {
  const elements = new Map([...PLAYER_HTML.matchAll(/<([a-z-]+)[^>]*\bid="([a-z-]+)"[^>]*>/g)].map((match) => [match[2], new Element(match[1], match[2])]));
  const sources = [], calls = [], instances = [], beacons = [], timers = new Map();
  const storage = new Map(Object.entries(options.storage ?? {}).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  const windowEvents = new Element(), documentEvents = new Element(), video = elements.get('player');
  const document = {
    title: '', activeElement: null, visibilityState: 'visible', pictureInPictureEnabled: false,
    getElementById(id) { assert.ok(elements.has(id), `Missing fixture element ${id}`); return elements.get(id); }, createElement(tag) { return new Element(tag); },
    querySelectorAll(selector) { if (selector === '.panel') return [...elements.values()].filter((node) => node.id.endsWith('-panel')); if (selector === '[aria-controls]') return [...elements.values()].filter((node) => node.id.endsWith('-button')); return []; },
    querySelector(selector) { if (selector === '.panel:not([hidden])') return this.querySelectorAll('.panel').find((node) => !node.hidden) ?? null; return null; },
    addEventListener: documentEvents.addEventListener.bind(documentEvents), removeEventListener: documentEvents.removeEventListener.bind(documentEvents),
  };
  class Hls {
    static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifest', SUBTITLE_TRACKS_UPDATED: 'subtitles', AUDIO_TRACKS_UPDATED: 'audio' };
    static isSupported() { return options.hlsSupported !== false; }
    constructor(config) { this.options = config; this.events = {}; this.subtitleTracks = []; this.audioTracks = []; this.levels = []; instances.push(this); }
    on(name, callback) { this.events[name] = callback; }
    loadSource(source) { sources.push(source); }
    attachMedia(media) { this.media = media; }
    destroy() { this.destroyed = true; }
  }
  let clock = now, uuids = 0, timerId = 0;
  class Clock extends Date { static now() { clock += 10; return clock; } }
  const window = { addEventListener: windowEvents.addEventListener.bind(windowEvents), removeEventListener: windowEvents.removeEventListener.bind(windowEvents) };
  const location = { origin: ORIGIN, pathname: '/api/stream-player', search: options.search ?? '?type=movie&tmdbId=603&title=The%20Matrix' };
  const context = createContext({
    document, window, location, Hls, URL, URLSearchParams, AbortController, AbortSignal, Blob, Date: Clock,
    history: { replaceState(_state, _title, url) { location.search = new URL(url, ORIGIN).search; } },
    navigator: { sendBeacon(path, body) { beacons.push({ path, body }); return options.beaconAccepted !== false; } },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, crypto: { randomUUID: () => `playback-instance-${++uuids}` },
    screen: { width: 1920, height: 1080 }, innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay, interval: false }); return id; }, clearTimeout: (id) => timers.delete(id),
    setInterval: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay, interval: true }); return id; }, clearInterval: (id) => timers.delete(id),
    fetch: async (path, init = {}) => {
      const url = new URL(path, ORIGIN), payload = init.body ? JSON.parse(init.body) : null; calls.push({ path: url.pathname, params: url.searchParams, init, payload });
      if (url.pathname === '/api/stream/servers') return Response.json({ servers: options.servers ?? [{ id: 'miami', name: 'Miami' }, { id: 'boise', name: 'Boise' }, { id: 'orlando', name: 'Orlando' }] });
      if (url.pathname === '/api/playback/catalog') return Response.json({ title: 'The Matrix', overview: 'A real catalog overview.', year: '1999', runtime: 135, rating: 8.2, certification: 'R', seasons: [{ season: 1, name: 'Season 1' }, { season: 2, name: 'Season 2' }], ...(options.catalog ?? {}) });
      if (url.pathname === '/api/playback/progress' && init.method !== 'POST') return Response.json({ progress: typeof options.remoteProgress === 'function' ? await options.remoteProgress(url.searchParams) : options.remoteProgress ?? null });
      if (url.pathname === '/api/playback/progress') return Response.json({ saved: true, progress: payload });
      if (url.pathname === '/api/playback/episodes') return Response.json({ episodes: options.episodes ?? [{ episode: 1, title: 'Episode one', overview: 'First episode.', runtime: 60 }, { episode: 2, title: 'Episode two', overview: 'Second episode.', runtime: 60 }] });
      if (url.pathname === '/api/stream') { const result = options.resolve ? await options.resolve(payload, calls.filter((entry) => entry.path === '/api/stream').length, init) : undefined; return result ?? Response.json({ source: options.source ?? SOURCE }, { headers: { 'X-Horizon-Stream-Server': payload.server ?? 'miami' } }); }
      throw new Error(`Unexpected player request ${url.pathname}`);
    },
  });
  runInContext(PLAYER_CORE_SCRIPT, context); runInContext(PLAYER_SCRIPT, context); await flush();
  return {
    elements, document, video, sources, calls, instances, storage, beacons, timers, location,
    async metadata(duration = 8100) { video.readyState = 4; video.duration = duration; await video.emit('loadedmetadata'); await flush(); },
    async click(id) { await elements.get(id).emit('click'); await flush(); }, async change(id, value) { elements.get(id).value = String(value); await elements.get(id).emit('change'); await flush(); },
    async pagehide() { await windowEvents.emit('pagehide'); await flush(); }, streamCalls() { return calls.filter((entry) => entry.path === '/api/stream'); },
    saves() { return calls.filter((entry) => entry.path === '/api/playback/progress' && entry.init.method === 'POST').map((entry) => entry.payload); },
  };
}

test('native full-page player uses local scripts and blocks external frames, scripts and media connections', () => {
  for (const directive of ["default-src 'none'", "script-src 'self'", "connect-src 'self' blob:", "frame-src 'none'", "frame-ancestors 'none'", "worker-src 'none'"]) assert.ok(PLAYER_CSP.includes(directive));
  assert.ok(!PLAYER_CSP.includes('unsafe-')); assert.ok(!PLAYER_HTML.includes('<iframe'));
  const scripts = [...PLAYER_HTML.matchAll(/<script[^>]*src="([^"]+)"/g)].map((match) => match[1]); assert.equal(scripts.length, 3); assert.ok(scripts.every((source) => source.startsWith('/api/stream-player/assets/')));
  assert.ok(!PLAYER_HTML.includes('plyr')); assert.ok(PLAYER_CSS.includes('position:fixed;inset:0')); assert.doesNotThrow(() => new Function(PLAYER_SCRIPT)); assert.ok(PLAYER_SCRIPT.includes('enableWorker: false'));
});
test('player exposes pause details and requested native controls without fullscreen being mandatory', () => {
  for (const id of ['pause-info', 'title-logo', 'overview', 'play', 'rewind', 'forward', 'volume', 'time', 'pip', 'server', 'subtitles-button', 'settings-button', 'fullscreen', 'cast', 'episodes-button', 'season', 'episode-list', 'fit', 'zoom']) assert.ok(PLAYER_HTML.includes(`id="${id}"`));
  assert.ok(PLAYER_CSS.includes('.player-page[data-state=playing] .pause-info')); assert.ok(PLAYER_CSS.includes('color:white')); assert.ok(!PLAYER_SCRIPT.includes('NEXT_PUBLIC_'));
});
test('private gateway resolves selected episodes with credentials and no browser CDN URLs', async () => {
  const fixture = await playerFixture({ search: '?type=show&tmdbId=1399&season=2&episode=3' }), call = fixture.streamCalls()[0];
  assert.equal(call.init.credentials, 'same-origin'); assert.equal(call.init.cache, 'no-store'); assert.ok(call.init.signal instanceof AbortSignal); assert.deepEqual(call.payload, { type: 'show', tmdbId: 1399, season: 2, episode: 3 });
  assert.deepEqual(fixture.sources, [SOURCE]); assert.equal(fixture.elements.get('episodes-button').hidden, false);
  const lookup = fixture.calls.find((entry) => entry.path === '/api/playback/progress'); assert.equal(lookup.params.get('season'), '2'); assert.equal(lookup.params.get('episode'), '3');
});
test('movie resume restores exact fractional local position when account history is unavailable', async () => {
  const fixture = await playerFixture({ storage: { [HISTORY]: { 'movie:603': progress() } }, remoteProgress: null }); assert.equal(fixture.instances[0].options.startPosition, 1560.375);
  await fixture.metadata(); assert.equal(fixture.video.currentTime, 1560.375); assert.equal(fixture.elements.get('time').textContent, '26:00 / 2:15:00');
});
test('newer account history wins over browser copy, while a newer browser copy remains usable', async () => {
  const local = progress(), newer = await playerFixture({ storage: { [HISTORY]: { 'movie:603': local } }, remoteProgress: progress({ position: 1777.25, updatedAt: new Date(now).toISOString() }) });
  assert.equal(newer.instances[0].options.startPosition, 1777.25); await newer.metadata(); assert.equal(newer.video.currentTime, 1777.25);
  const older = await playerFixture({ storage: { [HISTORY]: { 'movie:603': local } }, remoteProgress: progress({ position: 55, updatedAt: new Date(now - 2000).toISOString() }) }); assert.equal(older.instances[0].options.startPosition, 1560.375);
});
test('opening a show without an explicit episode resumes its actual latest season and episode', async () => {
  const fixture = await playerFixture({ search: '?type=show&tmdbId=1399', remoteProgress: progress({ key: 'show:1399:2:7', type: 'show', tmdbId: 1399, season: 2, episode: 7, position: 1600.5 }) });
  assert.deepEqual(fixture.streamCalls()[0].payload, { type: 'show', tmdbId: 1399, season: 2, episode: 7 }); assert.equal(fixture.instances[0].options.startPosition, 1600.5); assert.equal(fixture.calls.find((entry) => entry.path === '/api/playback/progress').params.has('season'), false);
});
test('server switches and retry preserve position after media source resets to zero', async () => {
  const fixture = await playerFixture(); await fixture.metadata(); fixture.video.currentTime = 1234.75; await fixture.change('server', 'boise');
  assert.equal(fixture.streamCalls()[1].payload.server, 'boise'); assert.equal(fixture.instances[1].options.startPosition, 1234.75); await fixture.metadata(); assert.equal(fixture.video.currentTime, 1234.75);
  fixture.video.readyState = 0; fixture.video.currentTime = 0; await fixture.click('retry'); assert.equal(fixture.instances[2].options.startPosition, 1234.75); await fixture.metadata(); assert.equal(fixture.video.currentTime, 1234.75);
  fixture.instances[0].events.error(null, { fatal: true }); await flush(); assert.equal(fixture.streamCalls().length, 3); assert.equal(fixture.elements.get('retry').hidden, true);
});
test('automatic playback advances through failed second server to a working third server', async () => {
  const fixture = await playerFixture({ resolve: async (payload) => payload.server === 'boise' ? Response.json({ error: 'No source here.' }, { status: 404 }) : undefined }); await fixture.metadata(); fixture.video.currentTime = 1560.375;
  fixture.instances[0].events.error(null, { fatal: true }); await flush(); assert.deepEqual(fixture.streamCalls().map((entry) => entry.payload.server ?? 'auto'), ['auto', 'boise', 'orlando']); assert.equal(fixture.instances.at(-1).options.startPosition, 1560.375);
  await fixture.metadata(); assert.equal(fixture.video.currentTime, 1560.375); assert.equal(fixture.elements.get('retry').hidden, true); assert.match(fixture.elements.get('active-server').textContent, /Orlando/);
});
test('stale resolver responses cannot attach video after a newer server choice', async () => {
  const first = deferred(), fixture = await playerFixture({ resolve: (_payload, index) => index === 1 ? first.promise : undefined }); assert.equal(fixture.sources.length, 0);
  await fixture.change('server', 'orlando'); assert.equal(fixture.sources.length, 1); first.resolve(Response.json({ source: `${ORIGIN}/api/proxy-stream?token=Old_Ticket` })); await flush(); assert.deepEqual(fixture.sources, [SOURCE]); assert.equal(fixture.streamCalls()[0].init.signal.aborted, true);
});
test('only a validated single-field same-origin relay source can reach the media engine', async () => {
  for (const source of ['https://cdn.example/master.m3u8', `${ORIGIN}/embed/movie/603`, `${ORIGIN}/api/proxy-stream?token=bad.token`, `${ORIGIN}/api/proxy-stream?token=a&other=b`, `${ORIGIN}/api/proxy-stream?token=a#tracker`]) { const fixture = await playerFixture({ source }); assert.deepEqual(fixture.sources, []); assert.match(fixture.elements.get('status').textContent, /invalid playback link/); assert.equal(fixture.elements.get('retry').hidden, false); }
  const fixture = await playerFixture({ resolve: () => Response.json({ source: SOURCE, iframe: 'https://provider.example/' }) }); assert.equal(fixture.sources.length, 0); assert.match(fixture.elements.get('status').textContent, /invalid playback link/);
});
test('pause, periodic saves and explicit restart use valid monotonic ownership fields', async () => {
  const fixture = await playerFixture(); await fixture.metadata(); fixture.video.currentTime = 1560.375; fixture.video.pause(); await flush();
  const first = fixture.saves().at(-1); assert.equal(first.position, 1560.375); assert.equal(first.season, undefined); assert.equal(first.episode, undefined); assert.ok(parsePlaybackSave(first, now + 100_000)); assert.ok(first.playbackId); assert.ok(first.sequence > 0);
  await fixture.video.play(); fixture.video.currentTime = 1570.5; for (const timer of [...fixture.timers.values()]) if (timer.interval && timer.delay === 10000) timer.callback(); await flush();
  const second = fixture.saves().at(-1); assert.equal(second.playbackId, first.playbackId); assert.ok(second.sequence > first.sequence); assert.ok(second.recordedAt >= first.recordedAt);
  await fixture.click('restart'); const restart = fixture.saves().at(-1); assert.equal(restart.position, 0); assert.equal(restart.restart, true); assert.notEqual(restart.playbackId, first.playbackId); assert.ok(restart.sessionStartedAt > first.sessionStartedAt);
});
test('closing saves exact progress with sendBeacon and disposes stale player callbacks', async () => {
  const fixture = await playerFixture(); await fixture.metadata(); fixture.video.currentTime = 1560.125; await fixture.pagehide(); assert.equal(fixture.beacons.length, 1);
  const saved = JSON.parse(await fixture.beacons[0].body.text()); assert.equal(saved.position, 1560.125); assert.equal(fixture.beacons[0].path, '/api/playback/progress'); assert.equal(JSON.parse(fixture.storage.get(HISTORY))['movie:603'].position, 1560.125);
  const previous = fixture.streamCalls().length; fixture.instances[0].events.error(null, { fatal: true }); await flush(); assert.equal(fixture.streamCalls().length, previous); assert.equal(fixture.timers.size, 0); assert.equal(fixture.instances[0].destroyed, true);
});
test('episode selection resumes the selected episode without copying the previous episode position', async () => {
  const target = progress({ key: 'show:1399:1:2', type: 'show', tmdbId: 1399, season: 1, episode: 2, position: 300.25 });
  const fixture = await playerFixture({ search: '?type=show&tmdbId=1399&season=1&episode=1', storage: { [HISTORY]: { [target.key]: target } }, remoteProgress: (params) => params.get('episode') === '2' ? { ...target, position: 360.5, updatedAt: new Date(now).toISOString() } : null });
  await fixture.metadata(); fixture.video.currentTime = 1600; await fixture.click('episodes-button'); assert.equal(fixture.elements.get('episode-list').children.length, 2); await fixture.elements.get('episode-list').children[1].emit('click'); await flush();
  assert.deepEqual(fixture.streamCalls().at(-1).payload, { type: 'show', tmdbId: 1399, season: 1, episode: 2 }); assert.equal(fixture.instances.at(-1).options.startPosition, 360.5); assert.equal(fixture.saves().at(-1).episode, 1); assert.equal(fixture.saves().at(-1).position, 1600);
  await fixture.metadata(); assert.equal(fixture.video.currentTime, 360.5); assert.equal(fixture.location.search.includes('episode=2'), true);
});
test('a stale tab cannot overwrite newer local ownership or send an obsolete account save', async () => {
  const fixture = await playerFixture(); await fixture.metadata();
  const newer = progress({ position: 2400, playbackId: 'newer-playback-instance', sessionStartedAt: now + 10000, recordedAt: now + 12000, sequence: 8, updatedAt: new Date(now + 12000).toISOString() });
  fixture.storage.set(HISTORY, JSON.stringify({ 'movie:603': newer })); fixture.video.currentTime = 1560; fixture.video.pause(); await flush();
  assert.equal(fixture.saves().length, 0); assert.equal(JSON.parse(fixture.storage.get(HISTORY))['movie:603'].position, 2400);
});
test('seeking to zero displays zero and restart query ignores prior resume data', async () => {
  const fixture = await playerFixture({ storage: { [HISTORY]: { 'movie:603': progress() } } }); await fixture.metadata();
  fixture.elements.get('seek').value = '0'; await fixture.elements.get('seek').emit('input'); assert.equal(fixture.video.currentTime, 0); assert.equal(fixture.elements.get('time').textContent, '00:00 / 2:15:00');
  const restart = await playerFixture({ search: '?type=movie&tmdbId=603&restart=1', storage: { [HISTORY]: { 'movie:603': progress() } }, remoteProgress: progress({ position: 3000 }) }); assert.equal(restart.instances[0].options.startPosition, -1); await restart.metadata(); assert.equal(restart.video.currentTime, 0);
});
test('a playlist that never produces metadata is abandoned for another automatic server', async () => {
  const fixture = await playerFixture();
  const metadataTimer = [...fixture.timers].find(([, timer]) => !timer.interval && timer.delay === 22000); assert.ok(metadataTimer);
  fixture.timers.delete(metadataTimer[0]); metadataTimer[1].callback(); await flush();
  assert.equal(fixture.streamCalls().at(-1).payload.server, 'boise'); assert.equal(fixture.instances[0].destroyed, true); await fixture.metadata();
  assert.equal([...fixture.timers.values()].some((timer) => timer.delay === 22000), false); assert.equal(fixture.elements.get('retry').hidden, true);
});
test('account progress for a different movie cannot resume the current title', async () => {
  const fixture = await playerFixture({ remoteProgress: progress({ tmdbId: 999, position: 2400 }) }); assert.equal(fixture.instances[0].options.startPosition, -1); await fixture.metadata(); assert.equal(fixture.video.currentTime, 0);
});
