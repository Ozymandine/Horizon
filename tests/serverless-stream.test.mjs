import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { handleStreamRequest, handleProxyRequest, nodeHandler, streamConfiguration, axiosUpstream } from '../lib/stream-serverless.mjs';

const env = { AUTH_SECRET: 'test-only-session-secret', STREAM_MOVIE_EXTRACTOR_URL: 'https://extractor.example/movie/{tmdbId}', STREAM_SHOW_EXTRACTOR_URL: 'https://extractor.example/tv/{tmdbId}/{season}/{episode}', STREAM_ALLOWED_HOSTS: 'cdn.example' };
const expires = String(Math.floor(Date.now() / 1000) + 3600);
const cookie = `horizon_session=${expires}.${createHmac('sha256', env.AUTH_SECRET).update(expires).digest('base64url')}`;
const logs = [];
const log = (value) => logs.push(JSON.parse(value));
const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080\n1080/index.m3u8\n';
const rendition = '#EXTM3U\n#EXTINF:10,\nsegment.ts\n#EXT-X-ENDLIST\n';
function incoming(body, statusCode = 200, headers = {}) {
  const response = Readable.from([Buffer.from(body)]);
  response.statusCode = statusCode;
  response.headers = { 'content-type': 'application/json', ...headers };
  return response;
}
function request(payload = { type: 'movie', tmdbId: 603 }, overrides = {}) {
  return new Request('https://horizon.example/api/stream', { method: 'POST', headers: { cookie, origin: 'https://horizon.example', 'content-type': 'application/json', ...overrides.headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload), ...overrides, ...(overrides.headers ? { headers: { cookie, origin: 'https://horizon.example', 'content-type': 'application/json', ...overrides.headers } } : {}) });
}
function upstreamFixture(source = JSON.stringify({ sources: [{ file: 'https://cdn.example/master.m3u8?private=secret' }] })) {
  return async (url) => {
    const path = new URL(url).pathname;
    return { url, response: path.endsWith('/index.m3u8') ? incoming(rendition) : path.endsWith('.ts') ? incoming(Buffer.alloc(564, 0x47), 200, { 'content-type': 'video/mp2t' }) : /^\/(?:movie|tv)\//.test(path) ? incoming(source) : incoming(master) };
  };
}
async function resolve(source) {
  const response = await handleStreamRequest(request(), env, { upstream: upstreamFixture(source), log });
  return { response, data: await response.json() };
}
function mediaRequest(resource, headers = {}) {
  const token = streamConfiguration(env).tickets.encode(resource);
  return new Request(`https://horizon.example/api/proxy-stream?token=${token}`, { headers: { cookie, ...headers } });
}

test('exact source contract is an absolute same-origin encrypted HLS URL', async () => {
  const { response, data } = await resolve();
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(data), ['source']);
  const url = new URL(data.source);
  assert.equal(url.origin, 'https://horizon.example');
  assert.equal(url.pathname, '/api/proxy-stream');
  assert(!data.source.includes('cdn.example'));
  assert.equal(streamConfiguration(env).tickets.decode(url.searchParams.get('token')).url, 'https://cdn.example/master.m3u8?private=secret');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-horizon-stream-server'), 'custom');
});

test('clear HTML, nested JSON, escaped and base64 source wrappers resolve without script execution', async () => {
  for (const source of [
    '<script>const video = "https://cdn.example/master.m3u8"; throw new Error("never execute");</script>',
    JSON.stringify({ source: Buffer.from('https://cdn.example/master.m3u8').toString('base64') }),
    '{"sources":[{"url":"https:\\/\\/cdn.example\\/master.m3u8?x=1\\u0026y=2"}]}',
  ]) assert.equal((await resolve(source)).response.status, 200);
});

test('direct HLS extractor endpoints work without a JSON wrapper', async () => {
  assert.equal((await resolve(master)).response.status, 200);
});

test('show season/episode and GET payload are validated and inserted into server-owned templates', async () => {
  const calls = [];
  const fixture = upstreamFixture();
  const upstream = async (url, config, options) => { calls.push(url); return fixture(url, config, options); };
  const response = await handleStreamRequest(new Request('https://horizon.example/api/stream?type=show&tmdbId=1399&season=1&episode=2', { headers: { cookie } }), env, { upstream, log });
  assert.equal(response.status, 200);
  assert.equal(calls[0], 'https://extractor.example/tv/1399/1/2');
  for (const payload of [{ tmdbId: 603, type: 'bad' }, { type: 'movie', tmdbId: 'https://127.0.0.1/' }, { type: 'show', tmdbId: 603, season: -1, episode: 1 }, null]) {
    assert.equal((await handleStreamRequest(request(payload), env, { upstream, log })).status, 400);
  }
});

test('unauthenticated, forged, expired and cross-origin requests never query a provider', async () => {
  let calls = 0;
  const dependencies = { upstream: async () => { calls++; throw new Error(); }, log };
  for (const value of ['', 'horizon_session=invalid', 'horizon_session=0000000000.fake', `${cookie}.extra`]) {
    assert.equal((await handleStreamRequest(request(undefined, { headers: { cookie: value } }), env, dependencies)).status, 401);
  }
  assert.equal((await handleStreamRequest(request(undefined, { headers: { origin: 'https://evil.example' } }), env, dependencies)).status, 403);
  assert.equal(calls, 0);
});

test('malformed JSON and declared or chunked bodies over 4KB fail before upstream access', async () => {
  for (const body of ['{', JSON.stringify({ type: 'movie', tmdbId: 603, padding: 'x'.repeat(5000) })]) {
    const result = await handleStreamRequest(request(body), env, { log });
    assert.equal(result.status, body === '{' ? 400 : 413);
  }
  assert.equal((await handleStreamRequest(request(undefined, { headers: { 'content-length': '5000' } }), env, { log })).status, 413);
  assert.equal((await handleStreamRequest(request(undefined, { headers: { 'content-type': 'text/plain' } }), env, { log })).status, 415);
});

test('HTTP 200 player HTML with no HLS returns a truthful error, never an embed/sample source', async () => {
  const { response, data } = await resolve('<iframe src="https://player.example/603"></iframe>');
  assert.equal(response.status, 422);
  assert.equal(data.code, 'NO_HLS_SOURCE');
  assert(!data.source);
});

test('a header-only or invalid HLS document is not advertised as playable', async () => {
  for (const source of ['#EXTM3U\n', '#EXTM3Uinvalid\n']) assert.equal((await resolve(source)).response.status, 502);
});

test('stream errors after response headers terminate the media stream and are logged', async () => {
  const previous = logs.length;
  const response = await handleProxyRequest(mediaRequest({ kind: 'media', url: 'https://cdn.example/a.ts' }), env, { upstream: async (url) => {
    const body = Readable.from((async function* () { yield Buffer.alloc(100); throw new Error('secret CDN URL'); })());
    body.statusCode = 200;
    body.headers = { 'content-type': 'video/mp2t' };
    return { url, response: body };
  }, log });
  await assert.rejects(response.arrayBuffer());
  assert(logs.length > previous);
  assert(!JSON.stringify(logs).includes('secret CDN URL'));
});

test('provider 404/403/500 and timeouts yield bounded JSON errors and sanitized structured logs', async () => {
  for (const [upstreamStatus, expected] of [[404, 404], [403, 502], [500, 502]]) {
    const response = await handleStreamRequest(request(), env, { upstream: async () => ({ response: incoming('signed URL secret', upstreamStatus), url: 'https://extractor.example' }), log });
    assert.equal(response.status, expected);
  }
  const response = await handleStreamRequest(request(), env, { upstream: async () => { const error = new Error('https://secret.example/?token=credential'); error.code = 'ETIMEDOUT'; throw error; }, log });
  assert.equal(response.status, 504);
  const data = await response.json();
  assert.equal(data.code, 'PROVIDER_TIMEOUT');
  assert(data.requestId);
  assert(!JSON.stringify(logs).includes('credential'));
});

test('unlisted CDN URLs, private addresses, arbitrary schemes and oversized responses fail closed', async () => {
  assert.equal((await resolve('{"source":"https://evil.example/master.m3u8"}')).response.status, 502);
  await assert.rejects(axiosUpstream('https://127.0.0.1/test', { hosts: new Set(['127.0.0.1']) }), /non-public/);
  await assert.rejects(axiosUpstream('http://cdn.example/test', { hosts: new Set(['cdn.example']) }), /not allowed/);
  assert.equal((await resolve('x'.repeat(2 * 1024 * 1024 + 1))).response.status, 502);
  const response = await handleStreamRequest(request(), env, { upstream: async (url) => ({ url, response: incoming(url.startsWith('https://extractor.example') ? '{"source":"https://cdn.example/x.m3u8"}' : '<html>not HLS</html>') }), log });
  assert.equal(response.status, 502);
});

test('relay rewrites playlists, strips tracking metadata and rejects tampered tickets', async () => {
  const response = await handleProxyRequest(mediaRequest({ kind: 'manifest', url: 'https://cdn.example/master.m3u8' }), env, { upstream: async (url) => ({ url, response: incoming(`${master}#EXT-X-SESSION-DATA:DATA-ID="tracking",URI="https://tracker.example/pixel"\n`) }), log });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert(text.includes('/api/proxy-stream?token='));
  assert(!text.includes('cdn.example'));
  assert(!text.includes('tracker.example'));
  const tampered = await handleProxyRequest(new Request('https://horizon.example/api/proxy-stream?token=AAAA', { headers: { cookie } }), env, { log });
  assert.equal(tampered.status, 403);
});

test('segment relay streams beyond 4.5MB without buffering and preserves byte ranges', async () => {
  const body = Buffer.alloc(5 * 1024 * 1024, 0x47);
  let range;
  const result = await handleProxyRequest(mediaRequest({ kind: 'media', url: 'https://cdn.example/segment.ts' }, { range: 'bytes=0-5242879' }), env, { upstream: async (url, _config, options) => {
    range = options.range;
    return { url, response: incoming(body, 206, { 'content-type': 'video/mp2t', 'content-length': String(body.length), 'content-range': 'bytes 0-5242879/7000000' }) };
  }, log });
  assert.equal(result.status, 206);
  assert.equal(range, 'bytes=0-5242879');
  assert.equal(result.headers.get('content-length'), null);
  assert.equal((await result.arrayBuffer()).byteLength, body.length);
  assert.equal(result.headers.get('content-range'), 'bytes 0-5242879/7000000');
});

test('non-media, invalid ranges and malformed AES keys return JSON instead of upstream content', async () => {
  for (const [resource, mime, body, expected] of [
    [{ kind: 'media', url: 'https://cdn.example/a.ts' }, 'text/html', '<script>bad</script>', 502],
    [{ kind: 'key', url: 'https://cdn.example/key' }, 'application/octet-stream', 'short', 502],
  ]) {
    const result = await handleProxyRequest(mediaRequest(resource), env, { upstream: async (url) => ({ url, response: incoming(body, 200, { 'content-type': mime }) }), log });
    assert.equal(result.status, expected);
  }
  assert.equal((await handleProxyRequest(mediaRequest({ kind: 'media', url: 'https://cdn.example/a.ts' }, { range: 'bytes=1-2,4-6' }), env, { log })).status, 416);
  const result = await handleProxyRequest(mediaRequest({ kind: 'key', url: 'https://cdn.example/key' }), env, { upstream: async (url) => ({ url, response: incoming(Buffer.alloc(16), 200, { 'content-type': 'application/octet-stream' }) }), log });
  assert.equal((await result.arrayBuffer()).byteLength, 16);
});

test('standalone Vercel Node req/res adapter handles a real HTTP request and source JSON', async (t) => {
  const handler = nodeHandler((req) => handleStreamRequest(req, env, { upstream: upstreamFixture(), log }));
  const server = createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/stream`, { method: 'POST', headers: { cookie, origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'movie', tmdbId: 603 }) });
  assert.equal(response.status, 200);
  assert.equal(new URL((await response.json()).source).origin, base);
});
