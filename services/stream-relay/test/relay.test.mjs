import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { publicAddress, allowedUrl, pinnedAddress, validRange, ticketCodec, boundedBody } from '../security.mjs';
import { gzipSync } from 'node:zlib';
import { rewriteManifest, playlistCandidates } from '../hls.mjs';
import { playbackRequest, providerEndpoint } from '../resolver.mjs';
import { createRelay } from '../server.mjs';

const hosts = new Set(['media.example', 'vidsrc.to']);
const secret = 'a-test-secret-that-is-at-least-32-characters';
test('bounded bodies decode provider gzip but refuse oversized decompressed payloads', async () => {
  const response = Readable.from([gzipSync(Buffer.from('#EXTM3U'))]);
  response.headers = { 'content-encoding': 'gzip' };
  assert.equal((await boundedBody(response)).toString(), '#EXTM3U');
  const bomb = Readable.from([gzipSync(Buffer.alloc(5000))]);
  bomb.headers = { 'content-encoding': 'gzip' };
  await assert.rejects(boundedBody(bomb, 1000), /too large/);
});
test('private, reserved, mapped-private, link-local and multicast IPs are blocked', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.2', '169.254.169.254', '0.0.0.0', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1']) assert.equal(publicAddress(address), false, address);
  for (const address of ['8.8.8.8', '2606:4700:4700::1111', '::ffff:8.8.8.8']) assert.equal(publicAddress(address), true, address);
});
test('URL allowlist rejects HTTP, foreign hosts, credentials and alternate ports', () => {
  for (const url of ['http://media.example/a', 'https://evil.example/a', 'https://user:pass@media.example/a', 'https://media.example:8443/a']) assert.throws(() => allowedUrl(url, hosts));
  assert.equal(allowedUrl('https://media.example/a', hosts).hostname, 'media.example');
});
test('DNS pinning refuses mixed public and private DNS answers', async () => {
  await assert.rejects(pinnedAddress(new URL('https://media.example/a'), hosts, async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]), /non-public/);
  assert.deepEqual(await pinnedAddress(new URL('https://media.example/a'), hosts, async () => [{ address: '8.8.8.8', family: 4 }]), { address: '8.8.8.8', family: 4 });
});
test('single byte ranges work; multi-range and reversed ranges fail', () => {
  for (const range of ['bytes=0-999', 'bytes=100-', 'bytes=-500']) assert.equal(validRange(range), range);
  for (const range of ['bytes=500-1', 'bytes=0-1,4-5', 'other=2-3']) assert.throws(() => validRange(range));
});
test('encrypted capabilities hide URLs, expire, and reject tampering', () => {
  let now = 1000;
  const codec = ticketCodec(secret, () => now);
  const resource = { kind: 'manifest', url: 'https://media.example/master.m3u8?secret=abc' };
  const token = codec.encode(resource);
  assert.ok(!Buffer.from(token, 'base64url').toString().includes('media.example'));
  assert.equal(codec.decode(token).url, resource.url);
  assert.throws(() => codec.decode('X' + token.slice(1)));
  now += 7200001;
  assert.throws(() => codec.decode(token), /expired/);
});
test('master playlists rewrite variants, audio, subtitles, session keys and strip beacon metadata', () => {
  const issued = [];
  const output = rewriteManifest('#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio.m3u8"\n#EXT-X-MEDIA:TYPE=SUBTITLES,URI="sub.m3u8"\n#EXT-X-SESSION-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-SESSION-DATA:DATA-ID="tracking",URI="https://evil.example/pixel"\n#EXT-X-STREAM-INF:BANDWIDTH=40000\nvariant.m3u8\n', 'https://media.example/hls/master.m3u8', hosts, (resource) => { issued.push(resource); return String(issued.length); });
  assert.ok(!output.includes('https://'));
  assert.ok(!output.includes('SESSION-DATA'));
  assert.deepEqual(issued.map((item) => item.kind), ['manifest', 'manifest', 'key', 'manifest']);
});
test('media playlists rewrite AES key, init fragment, and segment with relative paths and ranges', () => {
  const issued = [];
  const output = rewriteManifest('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="../key"\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6,\n#EXT-X-BYTERANGE:1000@0\nchunk.mp4\n#EXT-X-ENDLIST', 'https://media.example/hls/p.m3u8', hosts, (resource) => { issued.push(resource); return String(issued.length); });
  assert.equal(issued[0].url, 'https://media.example/key');
  assert.deepEqual(issued.map((item) => item.kind), ['key', 'media', 'media']);
  assert.match(output, /BYTERANGE:1000@0/);
});
test('HTML, foreign segments, unsupported DRM and variable manifests fail closed', () => {
  for (const text of ['<html>bad</html>', '#EXTM3U\nhttps://evil.example/pixel', '#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="a"', '#EXTM3U\n#EXT-X-DEFINE:NAME="a",VALUE="b"']) assert.throws(() => rewriteManifest(text, 'https://media.example/a.m3u8', hosts, () => 'test'));
});
test('data extraction handles JSON, escaped slash URLs and bounded base64 without evaluation', () => {
  const url = 'https://media.example/a.m3u8?key=123';
  assert.deepEqual(playlistCandidates(JSON.stringify({ sources: [{ file: url }] })), [url]);
  assert.deepEqual(playlistCandidates(`atob("${Buffer.from(url).toString('base64')}")`), [url]);
  assert.deepEqual(playlistCandidates(JSON.stringify({ file: url.replaceAll('/', '\\/') })), [url]);
});
test('TMDB payload validation and correct movie/episode endpoint templates', () => {
  const config = { hosts, movieTemplate: 'https://vidsrc.to/embed/movie/{tmdbId}', showTemplate: 'https://vidsrc.to/embed/tv/{tmdbId}/{season}/{episode}' };
  assert.equal(providerEndpoint(playbackRequest({ type: 'show', tmdbId: 2, season: 1, episode: 5 }), config), 'https://vidsrc.to/embed/tv/2/1/5');
  for (const payload of [{ type: 'movie', tmdbId: -1 }, { type: 'show', tmdbId: 1, season: 1 }, { type: 'movie', tmdbId: '1' }]) assert.throws(() => playbackRequest(payload));
});

test('authenticated pipeline resolves, rewrites, relays bytes/ranges, and rejects tracking pixels', async (t) => {
  const requests = [];
  const config = { hosts, token: secret, browserImage: '' };
  const app = createRelay(config, {
    resolvePlaylist: async () => 'https://media.example/master.m3u8',
    upstream: async (url, _config, options = {}) => {
      requests.push({ url, options });
      const playlist = '#EXTM3U\n#EXTINF:6,\nsegment.ts\n#EXT-X-ENDLIST';
      const isPlaylist = url.endsWith('.m3u8');
      const pixel = url.endsWith('.gif');
      const response = Readable.from([Buffer.from(isPlaylist ? playlist : pixel ? 'GIF89a' : 'media-bytes')]);
      response.statusCode = options.range ? 206 : 200;
      response.headers = { 'content-type': isPlaylist ? 'application/vnd.apple.mpegurl' : pixel ? 'image/gif' : 'video/mp2t', ...(options.range ? { 'content-range': 'bytes 0-10/11', 'accept-ranges': 'bytes' } : {}) };
      return { response, url };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };
  assert.equal((await fetch(base + '/health')).status, 401);
  const resolution = await fetch(base + '/api/resolve-stream', { method: 'POST', headers, body: JSON.stringify({ type: 'movie', tmdbId: 1 }) });
  assert.equal(resolution.status, 200);
  const { source } = await resolution.json();
  assert.ok(!source.includes('media.example'));
  const manifest = await fetch(base + source, { headers });
  const text = await manifest.text();
  const media = text.split('\n').find((line) => line.startsWith('/api/proxy-stream'));
  const segment = await fetch(base + media, { headers: { ...headers, range: 'bytes=0-10', cookie: 'secret-client-cookie', 'x-forwarded-for': '1.2.3.4' } });
  assert.equal(segment.status, 206);
  assert.equal(await segment.text(), 'media-bytes');
  assert.equal(requests.at(-1).options.range, 'bytes=0-10');
  assert.ok(!('cookie' in requests.at(-1).options));
  const pixel = ticketCodec(secret).encode({ url: 'https://media.example/a.gif', kind: 'media' });
  assert.equal((await fetch(base + '/api/proxy-stream?token=' + pixel, { headers })).status, 502);
  assert.equal((await fetch(base + '/api/proxy-stream?url=https://evil.example/a', { headers })).status, 403);
});
