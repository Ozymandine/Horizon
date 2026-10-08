import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac, createCipheriv, createDecipheriv } from 'node:crypto';
import { Readable } from 'node:stream';
import { createApp, configuration } from '../server.js';
import { handleStreamRequest, handleProxyRequest } from '../.build/stream-serverless.mjs';
import { rc4 } from '../.build/stream-providers.mjs';

const secret = 'fixture-only-secret-with-32-characters';
const environment = { STREAM_RELAY_TOKEN: secret, NODE_ENV: 'production', RENDER_EXTERNAL_URL: 'https://relay.example', STREAM_PROVIDER_ORDER: 'custom', STREAM_MOVIE_EXTRACTOR_URL: 'https://extractor.example/movie/{tmdbId}', STREAM_SHOW_EXTRACTOR_URL: 'https://extractor.example/tv/{tmdbId}/{season}/{episode}', STREAM_ALLOWED_HOSTS: 'cdn.example' };
const headers = { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };
const calls = [], logs = [];
const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080\n1080/index.m3u8\n';
const rendition = '#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXT-X-KEY:METHOD=AES-128,URI="../key"\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6,\nsegment.ts\n#EXT-X-ENDLIST\n';
function incoming(value, statusCode = 200, contentType = 'application/json') {
  const response = Readable.from([Buffer.from(value)]);
  response.statusCode = statusCode; response.headers = { 'content-type': contentType };
  return { response };
}
async function upstream(url, config, options) {
  calls.push({ url, config, options });
  if (url.startsWith('https://extractor.example')) return { url, ...incoming(JSON.stringify({ source: 'https://cdn.example/master.m3u8' })) };
  if (url.endsWith('/master.m3u8')) return { url, ...incoming(master, 200, 'application/vnd.apple.mpegurl') };
  if (url.endsWith('/index.m3u8')) return { url, ...incoming(rendition, 200, 'application/vnd.apple.mpegurl') };
  const buffer = url.endsWith('/key') ? Buffer.alloc(16) : Buffer.alloc(5000, 0x47);
  if (url.endsWith('/init.mp4')) buffer.write('ftyp', 4);
  return { url, ...incoming(buffer, 200, url.endsWith('/segment.ts') ? 'video/mp2t' : 'application/octet-stream') };
}
async function service(t, dependencies = { upstream, log: (value) => logs.push(JSON.parse(value)) }) {
  const server = createApp(configuration(environment), dependencies).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('production configuration requires stable bearer authentication and a safe public origin', () => {
  assert.throws(() => configuration({}), /STREAM_RELAY_TOKEN/);
  assert.throws(() => configuration({ STREAM_RELAY_TOKEN: secret, NODE_ENV: 'production' }), /RENDER_EXTERNAL_URL/);
  for (const url of ['http://relay.example', 'https://user:pass@relay.example', 'https://relay.example/api/stream', 'https://relay.example/?token=secret']) {
    assert.throws(() => configuration({ ...environment, RENDER_EXTERNAL_URL: url }), /HTTPS origin/);
  }
  const config = configuration({ ...environment, RENDER_URL: 'https://avoid-recursive-loop.example' });
  assert.equal(config.origin, 'https://relay.example');
  assert.equal(config.coreEnv.RENDER_URL, '');
  assert.equal(config.coreEnv.AUTH_SECRET, secret);
  assert.equal(config.coreEnv.STREAM_TICKET_SECRET, secret);
  assert.match(config.coreEnv.STREAM_VIDLINK_KEY, /^[a-f0-9]{64}$/);
});

test('health and open CORS preflights work without exposing protected routes', async (t) => {
  const base = await service(t);
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: 'horizon-streams', browserEngine: false });
  assert.equal(health.headers.get('access-control-allow-origin'), '*');
  assert.equal(health.headers.get('x-powered-by'), null);
  const preflight = await fetch(`${base}/api/stream`, { method: 'OPTIONS', headers: { origin: 'https://horizon.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  for (const path of ['/api/stream?tmdbId=603', '/api/proxy-stream?token=x']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'UNAUTHORIZED');
  }
});

test('movie, episode and alias resolve to one-field source JSON with a trusted origin', async (t) => {
  const base = await service(t);
  for (const [path, payload, expected] of [
    ['/api/stream', { type: 'movie', tmdbId: 603 }, '/movie/603'],
    ['/api/resolve-stream', { type: 'show', tmdbId: 1399, season: 1, episode: 2 }, '/tv/1399/1/2'],
  ]) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { ...headers, host: 'untrusted.example', 'x-forwarded-host': 'untrusted.example', cookie: 'client-secret', origin: 'https://untrusted.example' }, body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(Object.keys(data), ['source']);
    assert.equal(new URL(data.source).origin, environment.RENDER_EXTERNAL_URL);
    assert(calls.some((call) => call.url === `https://extractor.example${expected}`));
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert(calls.every((call) => !call.options.headers?.authorization && !call.options.headers?.cookie));
  const response = await fetch(`${base}/api/stream?type=show&tmdbId=1399&season=1&episode=1`, { headers });
  assert.equal(response.status, 200);
});

test('invalid and oversized inputs fail before provider access; resolver starts are limited', async (t) => {
  const base = await service(t);
  for (const [value, expected] of [['{', 400], [JSON.stringify({ type: 'movie', tmdbId: 603, padding: 'x'.repeat(5000) }), 413], [JSON.stringify({ type: 'show', tmdbId: 1399, season: -1, episode: 1 }), 400]]) {
    const response = await fetch(`${base}/api/stream`, { method: 'POST', headers, body: value });
    assert.equal(response.status, expected);
    assert(!JSON.stringify(await response.json()).includes('padding'));
  }
  // A validated request is required to reach the resolver, even when credentials are valid.
  assert.equal((await fetch(`${base}/api/stream`, { method: 'POST', headers: { authorization: headers.authorization, 'content-type': 'text/plain' }, body: '{}' })).status, 415);
  for (let index = 0; index < 11; index++) await fetch(`${base}/api/stream?type=movie&tmdbId=603`, { headers });
  const limited = await fetch(`${base}/api/stream?type=movie&tmdbId=603`, { headers });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, 'SERVICE_BUSY');
});

test('website gateway to real Express HTTP resolves and relays a complete fixture chain', async (t) => {
  const base = await service(t);
  const frontendEnv = { AUTH_SECRET: 'fixture-horizon-session', RENDER_URL: environment.RENDER_EXTERNAL_URL, STREAM_RELAY_TOKEN: secret };
  const expiry = String(Math.floor(Date.now() / 1000) + 3600);
  const cookie = `horizon_session=${expiry}.${createHmac('sha256', frontendEnv.AUTH_SECRET).update(expiry).digest('base64url')}`;
  // Replace only transport for this local fixture; production enforces HTTPS + public pinned DNS.
  const renderUpstream = async (url, config, options) => {
    assert.equal(config.token, secret);
    const path = new URL(url).pathname + new URL(url).search;
    const response = await fetch(`${base}${path}`, { method: options.method || 'GET', headers: { ...headers, ...(options.range ? { range: options.range } : {}) }, body: options.body, signal: options.signal });
    const stream = Readable.fromWeb(response.body);
    stream.statusCode = response.status; stream.headers = Object.fromEntries(response.headers);
    return { response: stream };
  };
  const dependencies = { renderUpstream, log: (value) => logs.push(JSON.parse(value)) };
  const result = await handleStreamRequest(new Request('https://horizon.example/api/stream', { method: 'POST', headers: { cookie, origin: 'https://horizon.example', 'content-type': 'application/json' }, body: JSON.stringify({ type: 'show', tmdbId: 1399, season: 1, episode: 1 }) }), frontendEnv, dependencies);
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(new URL(data.source).origin, 'https://horizon.example');
  const relay = (url) => handleProxyRequest(new Request(new URL(url, 'https://horizon.example'), { headers: { cookie } }), frontendEnv, dependencies);
  const masterResult = await relay(data.source);
  assert.equal(masterResult.status, 200);
  const masterText = await masterResult.text();
  const renditionUrl = masterText.split('\n').find((line) => line.startsWith('/api/proxy-stream'));
  const mediaResult = await relay(renditionUrl);
  assert.equal(mediaResult.status, 200);
  const mediaText = await mediaResult.text();
  const keyUrl = mediaText.match(/#EXT-X-KEY:.*URI="([^"]+)"/)[1];
  const initUrl = mediaText.match(/#EXT-X-MAP:.*URI="([^"]+)"/)[1];
  const segmentUrl = mediaText.split('\n').find((line) => line.startsWith('/api/proxy-stream'));
  assert.equal((await (await relay(keyUrl)).arrayBuffer()).byteLength, 16);
  for (const url of [initUrl, segmentUrl]) {
    const response = await relay(url);
    assert.equal(response.status, 200);
    assert.equal((await response.arrayBuffer()).byteLength, 5000);
  }
  assert(!`${masterText}${mediaText}`.includes('cdn.example'));
  assert(!`${masterText}${mediaText}`.includes('relay.example'));
  assert(!JSON.stringify(logs).includes(secret));
});

test('packaged native VidSrc, VidLink and Embed.su loops resolve fixtures without helper requests', async (t) => {
  for (const provider of ['vidsrc', 'vidlink', 'embedsu']) {
    const config = configuration({ ...environment, STREAM_PROVIDER_ORDER: provider });
    const visited = [];
    const fixture = async (url) => {
      visited.push(url);
      const parsed = new URL(url);
      if (parsed.hostname === 'cdn.example') return upstream(url, config, {});
      let value;
      if (provider === 'vidsrc') {
        if (parsed.pathname === '/embed/movie/603') value = '<a data-id="episode-token">watch</a>';
        else if (parsed.pathname === '/ajax/embed/episode/episode-token/sources') value = JSON.stringify({ result: [{ id: 'source-one', title: 'Vidplay' }] });
        else if (parsed.pathname === '/ajax/embed/source/source-one') value = JSON.stringify({ result: { url: rc4(Buffer.from(encodeURIComponent('https://vidplay.online/e/video123')), 'WXrUARXb1aDLaZjI').toString('base64url') } });
        else if (parsed.pathname === '/futoken') value = "var k='fixture-futoken';";
        else if (parsed.pathname.startsWith('/mediainfo/')) value = JSON.stringify({ result: { sources: [{ file: 'https://cdn.example/master.m3u8' }] } });
      } else if (provider === 'vidlink') {
        const match = parsed.pathname.match(/^\/api\/b\/movie\/([^/]+)$/);
        assert(match);
        const [iv, encrypted] = Buffer.from(decodeURIComponent(match[1]), 'base64').toString().split(':');
        const key = Buffer.from(config.coreEnv.STREAM_VIDLINK_KEY, 'hex');
        const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
        assert.equal(Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString(), '603');
        const responseIv = Buffer.alloc(16, 1);
        const cipher = createCipheriv('aes-256-cbc', key, responseIv);
        const sealed = Buffer.concat([cipher.update(JSON.stringify({ sources: [{ file: 'https://cdn.example/master.m3u8' }] })), cipher.final()]);
        value = `${responseIv.toString('hex')}:${sealed.toString('hex')}`;
      } else if (provider === 'embedsu') {
        if (parsed.pathname === '/embed/movie/603') {
          const servers = [{ hash: 'fixture-stream-token' }];
          const hash = Buffer.from(Buffer.from(JSON.stringify(servers)).toString('base64')).toString('base64');
          const token = Buffer.from(JSON.stringify({ hash, advertising: 'https://tracker.example/pixel' })).toString('base64');
          value = `window.vConfig=JSON.parse(atob('${token}'));`;
        } else if (parsed.pathname === '/api/e/fixture-stream-token') value = JSON.stringify({ source: 'https://cdn.example/master.m3u8' });
      }
      assert.notEqual(value, undefined, parsed.pathname);
      return { url, ...incoming(value) };
    };
    const server = createApp(config, { upstream: fixture, log: (value) => logs.push(JSON.parse(value)) }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
    const result = await fetch(`http://127.0.0.1:${server.address().port}/api/stream`, { method: 'POST', headers, body: JSON.stringify({ type: 'movie', tmdbId: 603 }) });
    assert.equal(result.status, 200, `${provider}: ${JSON.stringify(logs)}`);
    assert.deepEqual(Object.keys(await result.json()), ['source']);
    assert(!visited.some((url) => /enc-dec|tracker\.example/.test(url)));
    assert(visited.some((url) => url.includes('/1080/index.m3u8')));
  }
});
