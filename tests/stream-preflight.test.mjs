import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { handleStreamRequest, streamConfiguration } from '../lib/stream-serverless.mjs';

const env = { AUTH_SECRET: 'preflight-fixture-secret', STREAM_MOVIE_EXTRACTOR_URL: 'https://extractor.example/movie/{tmdbId}', STREAM_ALLOWED_HOSTS: 'cdn.example' };
const expiry = String(Math.floor(Date.now() / 1000) + 3600);
const cookie = `horizon_session=${expiry}.${createHmac('sha256', env.AUTH_SECRET).update(expiry).digest('base64url')}`;
const request = () => new Request('https://horizon.example/api/stream', { method: 'POST', headers: { cookie, origin: 'https://horizon.example', 'content-type': 'application/json' }, body: JSON.stringify({ type: 'movie', tmdbId: 603 }) });
const ts = Buffer.alloc(564, 0x47);
const mp4 = Buffer.from('00000010667479700000000000000000', 'hex');
function response(value, statusCode = 200, headers = {}) {
  const response = Readable.from([Buffer.from(value)]);
  response.statusCode = statusCode;
  response.headers = { 'content-type': 'application/vnd.apple.mpegurl', ...headers };
  return response;
}
function sourceTicket(result) { return result.json().then((data) => streamConfiguration(env).tickets.decode(new URL(data.source).searchParams.get('token'))); }

test('metadata-only sources with missing, empty, HTML or mislabeled media fail before issuing tickets', async () => {
  for (const [body, status, mime] of [[ts, 404, 'video/mp2t'], [Buffer.alloc(0), 200, 'video/mp2t'], ['<html>blocked</html>', 200, 'video/mp2t'], ['not media', 200, 'application/octet-stream'], [ts, 200, 'image/png']]) {
    const result = await handleStreamRequest(request(), env, { log: () => {}, upstream: async (url) => ({ url, response: url.includes('extractor.example') ? response('{"source":"https://cdn.example/movie.m3u8"}') : url.endsWith('.m3u8') ? response('#EXTM3U\n#EXTINF:8,\nsegment.ts\n#EXT-X-ENDLIST\n') : response(body, status, { 'content-type': mime }) }) });
    assert.notEqual(result.status, 200);
    assert.equal((await result.json()).source, undefined);
  }
});

test('a blocked preferred quality falls back to a checked playable rendition', async () => {
  const calls = [];
  const upstream = async (url, _config, options) => {
    calls.push({ path: new URL(url).pathname, range: options.range });
    const path = new URL(url).pathname;
    const body = path.includes('/movie/') ? '{"source":"https://cdn.example/master.m3u8"}' : path === '/master.m3u8' ? '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080\n1080.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\n720.m3u8\n' : path.endsWith('.m3u8') ? '#EXTM3U\n#EXTINF:8,\nsegment.ts\n#EXT-X-ENDLIST\n' : ts;
    return { url, response: response(body, path === '/1080.m3u8' ? 403 : 200, { 'content-type': path.endsWith('.ts') ? 'video/mp2t' : 'application/vnd.apple.mpegurl' }) };
  };
  const result = await handleStreamRequest(request(), env, { upstream, log: () => {} });
  assert.equal(result.status, 200);
  assert.equal((await sourceTicket(result)).url, 'https://cdn.example/720.m3u8');
  assert(calls.some((call) => call.path === '/segment.ts' && call.range === 'bytes=0-65535'));
});

test('initialization data and an exact AES key are checked along with the first video segment', async () => {
  for (const keySize of [16, 15, 17]) {
    const calls = [];
    const upstream = async (url) => {
      const path = new URL(url).pathname;
      calls.push(path);
      const body = path.startsWith('/movie/') ? '{"source":"https://cdn.example/movie.m3u8"}' : path.endsWith('.m3u8') ? '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:8,\nsegment.ts\n#EXT-X-ENDLIST\n' : path.endsWith('/key') ? Buffer.alloc(keySize) : path.endsWith('.mp4') ? mp4 : Buffer.alloc(512, 0xab);
      return { url, response: response(body, 200, { 'content-type': path.endsWith('/key') || path.endsWith('.mp4') || path.endsWith('.ts') ? 'application/octet-stream' : 'application/vnd.apple.mpegurl' }) };
    };
    const result = await handleStreamRequest(request(), env, { upstream, log: () => {} });
    assert.equal(result.status, keySize === 16 ? 200 : 502);
    assert(calls.includes('/key'));
    if (keySize === 16) { assert(calls.includes('/init.mp4')); assert(calls.includes('/segment.ts')); }
  }
});

test('media range probes stop at 64 KiB even when a host ignores Range', async () => {
  let chunks = 0, closed = false;
  const upstream = async (url, _config, options) => {
    if (url.includes('extractor.example')) return { url, response: response('{"source":"https://cdn.example/movie.m3u8"}') };
    if (url.endsWith('.m3u8')) return { url, response: response('#EXTM3U\n#EXTINF:8,\nsegment.ts\n#EXT-X-ENDLIST\n') };
    assert.equal(options.range, 'bytes=0-65535');
    const stream = Readable.from((async function* () {
      try { while (true) { chunks++; yield Buffer.alloc(65536, 0x47); } }
      finally { closed = true; }
    })());
    stream.statusCode = 200; stream.headers = { 'content-type': 'video/mp2t' };
    return { url, response: stream };
  };
  const result = await handleStreamRequest(request(), env, { upstream, log: () => {} });
  assert.equal(result.status, 200);
  await new Promise((resolve) => setImmediate(resolve));
  assert(chunks <= 2);
  assert.equal(closed, true);
});

test('byte-range playlists require the requested offset and reject ignored or mismatched ranges', async () => {
  for (const [status, contentRange, expected] of [[200, '', 502], [206, 'bytes 0-511/10000', 502], [206, 'bytes 1024-1535/10000', 200]]) {
    const upstream = async (url, _config, options) => {
      if (url.includes('extractor.example')) return { url, response: response('{"source":"https://cdn.example/movie.m3u8"}') };
      if (url.endsWith('.m3u8')) return { url, response: response('#EXTM3U\n#EXTINF:8,\n#EXT-X-BYTERANGE:512@1024\nsegment.ts\n#EXT-X-ENDLIST\n') };
      assert.equal(options.range, 'bytes=1024-1535');
      return { url, response: response(ts, status, { 'content-type': 'video/mp2t', 'content-range': contentRange }) };
    };
    assert.equal((await handleStreamRequest(request(), env, { upstream, log: () => {} })).status, expected);
  }
});
