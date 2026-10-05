import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';
import { decodeMovySources, movyCandidates } from '../lib/stream-movy.mjs';
import { resolveProvider, publicServers } from '../lib/stream-providers.mjs';
import { handleStreamRequest, handleServersRequest, streamConfiguration } from '../lib/stream-serverless.mjs';
import { seed, encoded } from './fixtures/movy.mjs';

const env = { AUTH_SECRET: 'synthetic-test-secret', STREAM_PROVIDER_ORDER: 'miami,boise', STREAM_ALLOWED_HOSTS: 'cdn.example' };
const expires = String(Math.floor(Date.now() / 1000) + 3600);
const cookie = `horizon_session=${expires}.${createHmac('sha256', env.AUTH_SECRET).update(expires).digest('base64url')}`;
const config = streamConfiguration(env);
function request(payload = { type: 'movie', tmdbId: 603 }, headers = {}) {
  return new Request('https://horizon.example/api/stream', { method: 'POST', headers: { cookie, origin: 'https://horizon.example', 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });
}
function response(text, statusCode = 200) {
  const response = Readable.from([Buffer.from(text)]);
  response.statusCode = statusCode;
  response.headers = { 'content-type': 'text/plain' };
  return response;
}

test('native Movy decoder validates the synthetic mvm1 vector and orders actual HLS sources', () => {
  const result = decodeMovySources(encoded, seed, 603);
  assert.equal(result.sources.length, 2);
  assert.deepEqual(movyCandidates(result), ['https://cdn.example/master.m3u8', 'https://cdn.example/4k.m3u8']);
  assert(!movyCandidates(result).some((url) => url.includes('tracker')));
  assert.deepEqual(movyCandidates({ sources: [{ url: 'https://cdn.example/movie.mp4' }, { url: 'https://embed.example/movie/603' }] }), []);
});

test('source decoding rejects wrong seeds, mismatched media IDs, oversized tokens and invalid encodings', () => {
  for (const [token, secret, id] of [[encoded, 'wrong', 603], [encoded, seed, 604], ['not!base64', seed, 603], ['a'.repeat(1400001), seed, 603], [encoded, '', 603], [encoded, seed, -1]]) {
    assert.throws(() => decodeMovySources(token, secret, id), (error) => error.code === 'NO_HLS_SOURCE');
  }
});

test('Miami and Boise map movie and TV identifiers and share only short-lived seed data', async () => {
  const calls = [], cache = new Map();
  const read = async (url, settings) => {
    calls.push({ url: new URL(url), referer: settings.referer });
    return { text: new URL(url).pathname === '/seed' ? JSON.stringify({ seed, ttlMs: 30000 }) : encoded };
  };
  for (const id of ['miami', 'boise']) {
    const candidates = await resolveProvider(id, { type: 'show', tmdbId: 603, season: 2, episode: 5 }, env, { read, config, seedCache: cache });
    assert.equal(candidates[0], 'https://cdn.example/master.m3u8');
  }
  assert.equal(calls.filter((call) => call.url.pathname === '/seed').length, 1);
  for (const call of calls.filter((call) => call.url.pathname !== '/seed')) {
    assert.equal(call.url.searchParams.get('mediaType'), 'tv');
    assert.equal(call.url.searchParams.get('seasonId'), '2');
    assert.equal(call.url.searchParams.get('episodeId'), '5');
    assert.equal(call.url.searchParams.get('enc'), '2');
    assert.equal(call.referer, 'https://www.movy.sx/');
  }
});

test('an expired upstream seed is refreshed once after a 401 without executing remote code', async () => {
  let seeds = 0, sources = 0;
  const read = async (url) => {
    if (new URL(url).pathname === '/seed') { seeds++; return { text: JSON.stringify({ seed, ttlMs: 30000 }) }; }
    if (++sources === 1) { const error = new Error('expired'); error.upstreamStatus = 401; throw error; }
    return { text: encoded };
  };
  await resolveProvider('miami', { type: 'movie', tmdbId: 603 }, env, { config, read, seedCache: new Map() });
  assert.equal(seeds, 2);
  assert.equal(sources, 2);
});

test('Automatic falls back from Miami to Boise and produces the unchanged private source contract', async () => {
  const calls = [];
  const upstream = async (url, settings) => {
    const path = new URL(url).pathname;
    calls.push({ path, referer: settings.referer });
    const body = path === '/seed' ? JSON.stringify({ seed, ttlMs: 30000 }) : path === '/miami/sources' ? 'unavailable' : path === '/boise/sources' ? encoded : '#EXTM3U\n#EXTINF:8,\nsegment.m4s\n#EXT-X-ENDLIST\n';
    return { url, response: response(body, path === '/miami/sources' ? 404 : 200) };
  };
  const result = await handleStreamRequest(request(), env, { upstream, log: () => {} });
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.deepEqual(Object.keys(data), ['source']);
  const ticket = config.tickets.decode(new URL(data.source).searchParams.get('token'));
  assert.equal(ticket.provider, 'boise');
  assert.equal(ticket.url, 'https://cdn.example/master.m3u8');
  assert(calls.every((call) => call.referer === 'https://www.movy.sx/'));
});

test('manual selection uses only that server; invalid/disabled selections never make upstream calls', async () => {
  let calls = 0;
  const upstream = async (url) => { calls++; return { url, response: response('denied', 404) }; };
  for (const server of ['unknown', 'vidsrc', 'https://127.0.0.1', '__proto__', 1]) {
    const result = await handleStreamRequest(request({ type: 'movie', tmdbId: 603, server }), env, { upstream, log: () => {} });
    assert.equal(result.status, 400);
  }
  assert.equal(calls, 0);
  const result = await handleStreamRequest(request({ type: 'movie', tmdbId: 603, server: 'boise' }), env, { upstream, log: () => {} });
  assert.equal(result.status, 404);
});

test('server discovery requires authentication and exposes only configured server labels', async () => {
  const path = 'https://horizon.example/api/stream/servers';
  assert.equal((await handleServersRequest(new Request(path), env)).status, 401);
  const result = await handleServersRequest(new Request(path, { headers: { cookie } }), env);
  assert.deepEqual(await result.json(), { servers: [{ id: 'miami', name: 'Miami' }, { id: 'boise', name: 'Boise' }] });
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert(publicServers({})[0].id === 'miami');
});
