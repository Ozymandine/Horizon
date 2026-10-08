import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createDecipheriv } from 'node:crypto';
import { Readable } from 'node:stream';
import { rc4, decodeVidsrcUrl, encodeVidplayId, encodeVidlinkId, decodeEmbedSuConfig, providerOrder, resolveProvider } from '../lib/stream-providers.mjs';
import { handleStreamRequest, handleProxyRequest, streamConfiguration, axiosUpstream } from '../lib/stream-serverless.mjs';

const secret = 'provider-regression-only-secret';
const expiry = String(Math.floor(Date.now() / 1000) + 3600);
const cookie = `horizon_session=${expiry}.${createHmac('sha256', secret).update(expiry).digest('base64url')}`;
const env = { AUTH_SECRET: secret, STREAM_ALLOWED_HOSTS: 'cdn.example', STREAM_PROVIDER_ORDER: 'vidsrc,vidcore,vidlink,embedsu' };
const payload = { type: 'movie', tmdbId: 603 };
const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080\n1080/index.m3u8\n';
const media = '#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nsegment.m4s\n#EXT-X-ENDLIST\n';
function response(body, statusCode = 200, mime = 'application/json') {
  const stream = Readable.from([Buffer.from(body)]);
  stream.statusCode = statusCode;
  stream.headers = { 'content-type': mime };
  return stream;
}
function request(value = payload) {
  return new Request('https://horizon.example/api/stream', { method: 'POST', headers: { cookie, origin: 'https://horizon.example', 'content-type': 'application/json' }, body: JSON.stringify(value) });
}
function vidcoreFixture({ badMirror = false, wrongTitle = false, hostileHandshake = false } = {}) {
  const calls = [];
  const upstream = async (url, settings, options) => {
    calls.push({ url, referer: settings.referer, method: options.method || 'GET', headers: options.headers, body: options.body });
    const parsed = new URL(url);
    let body;
    if (parsed.hostname === 'vidsrc.to') return { url, response: response('blocked', 403) };
    if (parsed.hostname === 'vidcore.io' && parsed.pathname.startsWith('/movie/')) body = `<script>self.__next_f.push([1,${JSON.stringify(JSON.stringify({ en: 'fixture-en-token' }))}]);throw Error('never run')</script>`;
    else if (parsed.pathname === '/api/enc-vidcore' && parsed.searchParams.get('stage') === '1') body = JSON.stringify({ status: 200, result: { stage1: hostileHandshake ? 'https://cdn.example/steal-token' : 'https://vidcore.io/catalog/handshake', token: 'csrf-one-secret' } });
    else if (parsed.pathname === '/catalog/handshake') { assert.equal(options.headers['X-CSRF-Token'], 'csrf-one-secret'); body = 'sealed-handshake-secret'; }
    else if (parsed.pathname === '/api/enc-vidcore' && parsed.searchParams.get('stage') === '2') body = JSON.stringify({ status: 200, result: { servers: 'https://vidcore.io/catalog/servers', stream: 'https://vidcore.io/catalog/unlock', token: 'csrf-two-secret' } });
    else if (parsed.pathname === '/catalog/servers') { assert.equal(options.headers['X-CSRF-Token'], 'csrf-two-secret'); body = 'encrypted-catalog'; }
    else if (parsed.pathname.startsWith('/catalog/unlock/')) body = parsed.pathname.endsWith('/supreme-token') ? 'encrypted-supreme' : 'encrypted-prime';
    else if (parsed.pathname === '/api/dec-vidcore') {
      const text = JSON.parse(options.body).text;
      const result = text === 'encrypted-catalog' ? [{ name: 'Advert', data: 'pixel' }, { name: 'Prime', data: 'prime-token' }, { name: 'Supreme', data: 'supreme-token' }] : { tmdbId: wrongTitle ? 999 : 603, url: `https://cdn.example/${text === 'encrypted-supreme' ? 'supreme' : 'prime'}/master.m3u8?secret=private` };
      body = JSON.stringify({ status: 200, result });
    } else if (parsed.hostname === 'cdn.example') body = badMirror && parsed.pathname.includes('supreme') ? '<html>blocked</html>' : parsed.pathname.endsWith('master.m3u8') ? master : parsed.pathname.endsWith('.m4s') ? Buffer.from('000000106d6f6f660000000000000000', 'hex') : media;
    else body = '{}';
    return { url, response: response(body, 200, parsed.pathname.endsWith('.m4s') ? 'video/mp4' : 'application/json') };
  };
  return { calls, upstream };
}

test('RC4 uses the standard known vector and handles source URL bytes without evaluating scripts', () => {
  assert.equal(rc4(Buffer.from('Plaintext'), 'Key').toString('hex'), 'bbf316e8d940af0ad3');
  const url = 'https%3A%2F%2Fvidplay.online%2Fe%2Fid123%3Fx%3D1%26y%3D2';
  assert.equal(decodeVidsrcUrl(rc4(Buffer.from(url), 'WXrUARXb1aDLaZjI').toString('base64url')), 'https://vidplay.online/e/id123?x=1&y=2');
  const encoded = encodeVidplayId('id123', ['first-key', 'second-key']);
  assert.equal(rc4(rc4(Buffer.from(encoded.replace(/_/g, '/'), 'base64'), 'second-key'), 'first-key').toString(), 'id123');
  assert.throws(() => encodeVidplayId('id123', []), /keys/);
});

test('legacy Vidlink tokens encrypt with Node AES, and invalid keys fail explicitly', () => {
  const key = '12'.repeat(32), iv = Buffer.alloc(16, 3);
  const [ivHex, ciphertext] = Buffer.from(encodeVidlinkId(603, key, iv), 'base64').toString().split(':');
  const decoder = createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(ivHex, 'hex'));
  assert.equal(Buffer.concat([decoder.update(Buffer.from(ciphertext, 'hex')), decoder.final()]).toString(), '603');
  assert.throws(() => encodeVidlinkId(603, 'short'), /32 bytes/);
});

test('Embed.su nested base64 configurations ignore its advertisement URL', () => {
  const servers = [{ name: 'primary', hash: 'stream-hash' }];
  const hash = Buffer.from(Buffer.from(JSON.stringify(servers)).toString('base64')).toString('base64');
  const token = Buffer.from(JSON.stringify({ hash, uwuId: 'https://tracker.example/pixel' })).toString('base64');
  assert.deepEqual(decodeEmbedSuConfig(`window.vConfig = JSON.parse(atob(\`${token}\`));`), ['stream-hash']);
  assert.throws(() => decodeEmbedSuConfig('window.vConfig = dangerous()'), /configuration/);
});

test('custom source selection and provider order reject unknown or duplicated fallback names', () => {
  assert.deepEqual(providerOrder({}), ['miami', 'boise', 'orlando', 'paris', 'munich']);
  assert.deepEqual(providerOrder({ STREAM_MOVIE_EXTRACTOR_URL: 'https://example.org' }), ['custom']);
  for (const value of ['vidsrc,vidsrc', 'evil', 'custom', 'vidsrc,']) assert.throws(() => providerOrder({ STREAM_PROVIDER_ORDER: value }), /order/);
});

test('Automatic checks mirrors concurrently and uses the verified VidCore handshake', async () => {
  const fixture = vidcoreFixture(), logs = [];
  const result = await handleStreamRequest(request(), env, { upstream: fixture.upstream, log: (value) => logs.push(value) });
  assert.equal(result.status, 200, JSON.stringify({ logs, paths: fixture.calls.map((call) => new URL(call.url).pathname) }));
  const data = await result.json();
  assert.deepEqual(Object.keys(data), ['source']);
  const ticket = streamConfiguration(env).tickets.decode(new URL(data.source).searchParams.get('token'));
  assert.equal(ticket.provider, 'vidcore');
  assert(ticket.url.includes('/supreme/'));
  assert(fixture.calls.some((call) => call.url.includes('/1080/index.m3u8')));
  assert(!fixture.calls.some((call) => /pixel|prime-token/.test(call.url)));
  assert(!JSON.stringify(logs).includes('secret'));
  const blocked = logs.map((entry) => JSON.parse(entry)).find((entry) => entry.provider === 'vidsrc');
  assert.equal(blocked.upstreamHost, 'vidsrc.to');
  assert.equal(blocked.upstreamStatus, 403);
  assert(!data.source.includes('cdn.example'));
});

test('failed mirror validation advances to the next ranked mirror', async () => {
  const fixture = vidcoreFixture({ badMirror: true });
  const result = await handleStreamRequest(request(), env, { upstream: fixture.upstream, log: () => {} });
  assert.equal(result.status, 200);
  const data = await result.json();
  assert(streamConfiguration(env).tickets.decode(new URL(data.source).searchParams.get('token')).url.includes('/prime/'));
});

test('helper supplied token endpoints cannot cross hosts, and mismatched TMDB streams are rejected', async () => {
  for (const settings of [{ hostileHandshake: true }, { wrongTitle: true }]) {
    const fixture = vidcoreFixture(settings);
    const result = await handleStreamRequest(request(), { ...env, STREAM_PROVIDER_ORDER: 'vidcore' }, { upstream: fixture.upstream, log: () => {} });
    assert.equal(result.status, 422);
    assert(!fixture.calls.some((call) => call.url.includes('steal-token')));
  }
});

test('provider Referer survives master, rendition and segment tickets and no CSRF headers reach the CDN', async () => {
  const fixture = vidcoreFixture();
  const result = await handleStreamRequest(request(), env, { upstream: fixture.upstream, log: () => {} });
  const source = (await result.json()).source;
  const relay = (url) => handleProxyRequest(new Request(new URL(url, 'https://horizon.example'), { headers: { cookie } }), env, { upstream: fixture.upstream, log: () => {} });
  const masterText = await (await relay(source)).text();
  const variant = masterText.split('\n').find((line) => line && !line.startsWith('#'));
  const mediaText = await (await relay(variant)).text();
  const segment = mediaText.split('\n').find((line) => line && !line.startsWith('#'));
  const segmentToken = streamConfiguration(env).tickets.decode(new URL(segment, 'https://horizon.example').searchParams.get('token'));
  assert.equal(segmentToken.provider, 'vidcore');
  assert(fixture.calls.filter((call) => call.url.includes('cdn.example')).every((call) => call.referer === 'https://vidcore.io/' && call.headers === undefined));
  assert(!/https?:\/\//.test(masterText + mediaText));
});

test('all providers failing returns a controlled error, never HTML, iframe or a sample movie', async () => {
  const result = await handleStreamRequest(request(), env, { upstream: async (url) => ({ url, response: response('denied', 403) }), log: () => {} });
  assert.equal(result.status, 502);
  const data = await result.json();
  assert.equal(data.code, 'ALL_PROVIDERS_FAILED');
  assert(!data.source);
});

test('a timed out provider is cancelled and a later provider can still resolve', async () => {
  const result = await handleStreamRequest(request(), { ...env, STREAM_PROVIDER_ORDER: 'vidsrc,embedsu' }, {
    providerTimeoutMs: 30, log: () => {}, upstream: async (url, _config, { signal }) => {
      if (url.includes('vidsrc.to')) await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      return { url, response: response(url.includes('embed.su') ? '{"source":"https://cdn.example/master.m3u8"}' : url.endsWith('master.m3u8') ? master : url.endsWith('.m4s') ? Buffer.from('000000106d6f6f660000000000000000', 'hex') : media, 200, url.endsWith('.m4s') ? 'video/mp4' : 'application/json') };
    },
  });
  assert.equal(result.status, 200);
});

test('native VidSrc source-token and futoken pipeline uses server requests only', async () => {
  const calls = [];
  const config = streamConfiguration(env);
  const read = async (url, settings) => {
    calls.push({ url, referer: settings.referer });
    let text;
    if (url.includes('/embed/movie/')) text = '<a data-id="episode123"></a>';
    else if (url.includes('/episode/episode123/sources')) text = '{"result":[{"title":"Vidplay","id":"source123"}]}';
    else if (url.includes('/source/source123')) text = JSON.stringify({ result: { url: rc4(Buffer.from('https://vidplay.online/e/video123?token=secret'), 'WXrUARXb1aDLaZjI').toString('base64url') } });
    else if (url.endsWith('/futoken')) text = "var k = 'fukey';window.alert('never execute');";
    else text = '{"result":{"sources":[{"file":"https://cdn.example/master.m3u8"}]}}';
    return { url, text };
  };
  assert.deepEqual(await resolveProvider('vidsrc', payload, env, { config, read, signal: new AbortController().signal }), ['https://cdn.example/master.m3u8']);
  assert(calls.some((call) => call.url.includes('/mediainfo/')));
});

test('provider POSTs refuse browser credentials, header injection and oversized bodies before DNS', async () => {
  const settings = { hosts: new Set(['not-a-real-host.invalid']), referer: 'https://vidcore.io/', userAgent: 'test' };
  for (const options of [
    { method: 'DELETE' }, { headers: { Cookie: 'private-browser-cookie' } },
    { headers: { 'X-CSRF-Token': 'bad\r\nInjected: header' } },
    { method: 'POST', body: 'x'.repeat(2 * 1024 * 1024 + 1), contentType: 'application/json' },
    { method: 'POST', body: 'data', contentType: 'text/html' },
  ]) await assert.rejects(axiosUpstream('https://not-a-real-host.invalid/api', settings, options), (error) => error.code === 'INVALID_PROVIDER_REQUEST');
});

test('tickets cannot select an unknown provider even when their ciphertext is authentic', async () => {
  const token = streamConfiguration(env).tickets.encode({ kind: 'manifest', url: 'https://cdn.example/master.m3u8', provider: 'unregistered' });
  let called = false;
  const result = await handleProxyRequest(new Request(`https://horizon.example/api/proxy-stream?token=${token}`, { headers: { cookie } }), env, { upstream: async () => { called = true; }, log: () => {} });
  assert.equal(result.status, 403);
  assert.equal(called, false);
});
