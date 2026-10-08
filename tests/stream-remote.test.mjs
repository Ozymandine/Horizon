import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { handleStreamRequest, handleProxyRequest, handleServersRequest } from '../lib/stream-serverless.mjs';
import { renderConfiguration, renderUpstream, resolveThroughRender } from '../lib/stream-remote.mjs';

const env = { AUTH_SECRET: 'test-only-horizon-secret', RENDER_URL: 'https://relay.example', STREAM_RELAY_TOKEN: 'fixture-only-secret-with-32-characters' };
const expires = String(Math.floor(Date.now() / 1000) + 3600);
const cookie = `horizon_session=${expires}.${createHmac('sha256', env.AUTH_SECRET).update(expires).digest('base64url')}`;
const logs = [];
const log = (value) => logs.push(JSON.parse(value));
function body(value, statusCode = 200, headers = {}) {
  const response = Readable.from([Buffer.from(value)]);
  response.statusCode = statusCode;
  response.headers = { 'content-type': 'application/json', ...headers };
  return { response };
}
function resolveRequest(payload = { type: 'movie', tmdbId: 603 }, headers = {}) {
  return new Request('https://horizon.example/api/stream', { method: 'POST', headers: { cookie, origin: 'https://horizon.example', 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });
}
function mediaRequest(token = 'Ticket_123', headers = {}) {
  return new Request(`https://horizon.example/api/proxy-stream?token=${token}`, { headers: { cookie, ...headers } });
}
const source = JSON.stringify({ source: 'https://relay.example/api/proxy-stream?token=Ticket_123' });

test('Render resolver preserves the exact source contract and dynamic movie/episode payloads', async () => {
  for (const payload of [{ type: 'movie', tmdbId: 603, server: 'boise' }, { type: 'show', tmdbId: 1399, season: 0, episode: 2 }]) {
    let call;
    const result = await handleStreamRequest(resolveRequest(payload), env, { log, renderUpstream: async (...args) => { call = args; return body(source); } });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { source: 'https://horizon.example/api/proxy-stream?token=Ticket_123' });
    assert.equal(call[0], 'https://relay.example/api/stream');
    assert.equal(call[1].token, env.STREAM_RELAY_TOKEN);
    assert.equal(call[2].method, 'POST');
    assert.deepEqual(JSON.parse(call[2].body), payload);
    assert.equal(call[2].headers, undefined);
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
  }
});

test('hosted server discovery follows Render configuration and replaces untrusted labels', async () => {
  const request = new Request('https://horizon.example/api/stream/servers', { headers: { cookie } });
  const result = await handleServersRequest(request, env, { log, renderUpstream: async (url) => {
    assert.equal(url, 'https://relay.example/api/stream/servers');
    return body(JSON.stringify({ servers: [{ id: 'boise', name: '<script>unsafe</script>' }] }));
  } });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { servers: [{ id: 'boise', name: 'Boise' }] });
  for (const servers of [[{ id: 'unknown' }], [{ id: '__proto__' }], [{ id: 'miami' }, { id: 'miami' }]]) {
    const rejected = await handleServersRequest(request, env, { log, renderUpstream: async () => body(JSON.stringify({ servers })) });
    assert.equal(rejected.status, 502);
  }
});

test('the hosted gateway retains only a registered selected-server header', async () => {
  const result = await handleStreamRequest(resolveRequest(), env, { log, renderUpstream: async () => body(source, 200, { 'x-horizon-stream-server': 'orlando' }) });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('x-horizon-stream-server'), 'orlando');
  assert.deepEqual(Object.keys(await result.json()), ['source']);
  for (const server of ['__proto__', 'unknown', 'https://signed.example/?secret=hidden']) {
    const rejected = await handleStreamRequest(resolveRequest(), env, { log, renderUpstream: async () => body(source, 200, { 'x-horizon-stream-server': server }) });
    assert.equal(rejected.status, 502);
    assert.equal((await rejected.json()).code, 'INVALID_RENDER_SOURCE');
  }
});

test('private app authentication, origin and ID validation precede any Render call', async () => {
  let calls = 0;
  const dependencies = { log, renderUpstream: async () => { calls++; return body(source); } };
  assert.equal((await handleStreamRequest(resolveRequest(undefined, { cookie: '' }), env, dependencies)).status, 401);
  assert.equal((await handleProxyRequest(mediaRequest(undefined, { cookie: '' }), env, dependencies)).status, 401);
  assert.equal((await handleStreamRequest(resolveRequest(undefined, { origin: 'https://evil.example' }), env, dependencies)).status, 403);
  assert.equal((await handleStreamRequest(resolveRequest({ type: 'movie', tmdbId: 'https://127.0.0.1' }), env, dependencies)).status, 400);
  assert.equal(calls, 0);
});

test('server configuration rejects paths, credentials, HTTP origins and missing shared secrets', async () => {
  for (const url of ['', 'http://relay.example', 'https://relay.example/api/stream', 'https://user:pass@relay.example', 'https://relay.example/?token=secret', 'https://relay.example/#x', 'https://relay.example:8443']) {
    assert.throws(() => renderConfiguration({ ...env, RENDER_URL: url }), /hosted stream service/);
  }
  assert.throws(() => renderConfiguration({ ...env, STREAM_RELAY_TOKEN: 'short' }), /credential/);
  assert.equal(renderConfiguration({ ...env, RENDER_URL: 'https://relay.example/' }).origin, env.RENDER_URL);
  await assert.rejects(renderUpstream('https://127.0.0.1/api/stream', renderConfiguration({ ...env, RENDER_URL: 'https://127.0.0.1' })), /non-public/);
  await assert.rejects(renderUpstream('https://other.example/api/stream', renderConfiguration(env)), /not allowed/);
});

test('remote HTML, malformed JSON, oversized bodies and non-relay sources fail closed', async () => {
  for (const value of [
    'not JSON', '{}', 'null', source.slice(0, -1), 'x'.repeat(16001),
    JSON.stringify({ source: 'https://cdn.example/movie.m3u8' }),
    JSON.stringify({ source: 'https://relay.example/api/proxy-stream?token=a&other=b' }),
    JSON.stringify({ source: 'https://relay.example/api/proxy-stream?token=a&token=b' }),
    JSON.stringify({ source: 'https://user:pass@relay.example/api/proxy-stream?token=a' }),
    JSON.stringify({ source: 'https://relay.example/api/proxy-stream?token=a#x' }),
    JSON.stringify({ source: 'https://relay.example/api/proxy-stream?token=a', html: '<iframe>' }),
  ]) {
    const response = await handleStreamRequest(resolveRequest(), env, { log, renderUpstream: async () => body(value) });
    assert.equal(response.status, 502, value.slice(0, 60));
    assert.equal((await response.json()).code, 'INVALID_RENDER_SOURCE');
  }
  const response = await handleStreamRequest(resolveRequest(), env, { log, renderUpstream: async () => body('<html>error</html>', 200, { 'content-type': 'text/html' }) });
  assert.equal(response.status, 502);
});

test('Render credential mismatches and expired tickets are distinct, bounded errors', async () => {
  for (const [status, expected, code] of [[401, 502, 'RENDER_AUTH_FAILED'], [403, 403, 'STREAM_REJECTED'], [429, 429, 'SERVICE_BUSY'], [504, 504, 'PROVIDER_TIMEOUT'], [502, 502, 'ALL_PROVIDERS_FAILED']]) {
    const response = await handleProxyRequest(mediaRequest(), env, { log, renderUpstream: async () => body(JSON.stringify({ error: 'https://signed.example/?secret=NEVER_ECHO', code }), status) });
    assert.equal(response.status, expected);
    const data = await response.json();
    assert.equal(data.code, code);
    assert(!JSON.stringify(data).includes('NEVER_ECHO'));
    assert(data.requestId);
  }
  assert(!JSON.stringify(logs).includes('NEVER_ECHO'));
});

test('timeouts and network errors yield safe JSON without logging Axios secrets', async () => {
  const response = await handleStreamRequest(resolveRequest(), env, { log, renderUpstream: async () => { const error = new Error('Authorization Bearer DO_NOT_LOG'); error.code = 'ETIMEDOUT'; throw error; } });
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, 'PROVIDER_TIMEOUT');
  assert(!JSON.stringify(logs).includes('DO_NOT_LOG'));
});

test('hosted relay accepts only rewritten nonempty same-origin HLS resources', async () => {
  const playlist = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000\n/api/proxy-stream?token=Child_123\n';
  const call = async (text) => handleProxyRequest(mediaRequest(), env, { log, renderUpstream: async () => body(text, 200, { 'content-type': 'application/vnd.apple.mpegurl' }) });
  const response = await call(playlist);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), playlist);
  for (const value of [playlist.replace('/api/proxy-stream?token=Child_123', 'https://cdn.example/master.m3u8'), playlist.replace('/api/proxy-stream?token=Child_123', '//evil.example/a'), '#EXTM3U\n', `${playlist}#EXT-X-KEY:METHOD=AES-128,URI="https://evil.example/key"\n`, `${playlist}#EXT-X-KEY:METHOD=AES-128,URI="/other/path"\n`]) {
    assert.equal((await call(value)).status, 502);
  }
});

test('hosted media streams beyond 4.5MB and preserves a valid byte range', async () => {
  const data = Buffer.alloc(5 * 1024 * 1024, 0x47);
  let call;
  const result = await handleProxyRequest(mediaRequest(undefined, { range: 'bytes=0-5242879', authorization: 'client-secret', 'x-forwarded-for': 'client-ip' }), env, {
    log, renderUpstream: async (...args) => { call = args; return body(data, 206, { 'content-type': 'video/mp2t', 'content-length': String(data.length), 'content-range': 'bytes 0-5242879/7000000', 'accept-ranges': 'bytes' }); },
  });
  assert.equal(result.status, 206);
  assert.equal(call[2].range, 'bytes=0-5242879');
  assert.equal(call[2].headers, undefined);
  assert.equal(result.headers.get('content-range'), 'bytes 0-5242879/7000000');
  assert.equal(result.headers.get('content-length'), null);
  assert.equal((await result.arrayBuffer()).byteLength, data.length);
});

test('hosted HTML, compressed media, invalid ranges and oversized segments are rejected', async () => {
  for (const headers of [{ 'content-type': 'text/html' }, { 'content-type': 'video/mp2t', 'content-encoding': 'gzip' }, { 'content-type': 'video/mp2t', 'content-length': String(32 * 1024 * 1024 + 1) }]) {
    assert.equal((await handleProxyRequest(mediaRequest(), env, { log, renderUpstream: async () => body('rejected', 200, headers) })).status, 502);
  }
  assert.equal((await handleProxyRequest(mediaRequest(undefined, { range: 'bytes=1-2,5-8' }), env, { log })).status, 416);
  assert.equal((await handleProxyRequest(mediaRequest('bad.token'), env, { log })).status, 400);
  const result = await handleProxyRequest(mediaRequest(), env, { log, renderUpstream: async () => body(Buffer.alloc(32 * 1024 * 1024 + 1), 200, { 'content-type': 'video/mp2t' }) });
  await assert.rejects(result.arrayBuffer());
});

test('post-header remote stream errors close the response and receive sanitized logs', async () => {
  const previous = logs.length;
  const result = await handleProxyRequest(mediaRequest(), env, { log, renderUpstream: async () => {
    const response = Readable.from((async function* () { yield Buffer.alloc(100); throw new Error('secret signed stream URL'); })());
    response.statusCode = 200; response.headers = { 'content-type': 'video/mp2t' };
    return { response };
  } });
  await assert.rejects(result.arrayBuffer());
  assert(logs.length > previous);
  assert(!JSON.stringify(logs).includes('secret signed stream URL'));
});

test('cancellation destroys a pending remote response body', async () => {
  const controller = new AbortController();
  const response = new Readable({ read() {} });
  response.statusCode = 200; response.headers = { 'content-type': 'application/json' };
  const promise = resolveThroughRender({ type: 'movie', tmdbId: 603 }, 'https://horizon.example', env, { renderUpstream: async () => ({ response }) }, controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(promise);
  assert.equal(response.destroyed, true);
});
