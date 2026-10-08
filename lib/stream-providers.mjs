import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { playlistCandidates } from '../services/stream-relay/hls.mjs';
import { StreamError } from './stream-errors.mjs';
import { decodeMovySources, movyCandidates } from './stream-movy.mjs';

// Protocol references and live limitations are recorded in docs/PRIVATE-STREAMING.md.
// No player code, ad scripts, remote modules, eval or browser engine is executed.
export const PROVIDERS = Object.freeze({
  miami: { origin: 'https://api.wecollege.net', referer: 'https://www.movy.sx/', name: 'Miami', timeout: 6000, movy: true },
  boise: { origin: 'https://api.wecollege.net', referer: 'https://www.movy.sx/', name: 'Boise', timeout: 6000, movy: true },
  orlando: { origin: 'https://api.wecollege.net', referer: 'https://www.movy.sx/', name: 'Orlando', timeout: 8000, movy: true },
  paris: { origin: 'https://api.wecollege.net', referer: 'https://www.movy.sx/', name: 'Paris', timeout: 8000, movy: true },
  munich: { origin: 'https://api.wecollege.net', referer: 'https://www.movy.sx/', name: 'Munich', timeout: 8000, movy: true },
  vidsrc: { origin: 'https://vidsrc.to', timeout: 4000 },
  vidcore: { origin: 'https://vidcore.io', timeout: 14000 },
  vidlink: { origin: 'https://vidlink.pro', timeout: 4000 },
  embedsu: { origin: 'https://embed.su', timeout: 3000 },
});
export const VERIFIED_MEDIA_HOSTS = ['moon.zenoak.top', 'pulsedesk.top', 'emberwave.top', 'dawn-dew-dd4f.barbaraadamse463.workers.dev', 'sun.paleoak.top'];
const sourceSeeds = new Map();

function rejected(message = 'The provider exposes no supported HLS source.') {
  return new StreamError(message, 422, 'NO_HLS_SOURCE');
}
function invalidConfig(message) { return new StreamError(message, 503, 'INVALID_CONFIG'); }
function parseJson(body) {
  try { return JSON.parse(body); } catch { throw rejected('The provider returned an unsupported response.'); }
}
function boundedToken(value, maximum = 16000) {
  if (typeof value !== 'string' || !value.length || value.length > maximum || /[\r\n\x00]/.test(value)) throw rejected('The provider returned an invalid token.');
  return value;
}
function decode64(value) {
  if (typeof value !== 'string' || value.length > 100000 || !/^[A-Za-z0-9+/_=-]+$/.test(value)) throw rejected('The provider returned invalid encoded data.');
  return Buffer.from(value, 'base64');
}
const reverse = (value) => [...value].reverse().join('');

/** Standard RC4, implemented with bytes so non-ASCII ciphertext is never corrupted. */
export function rc4(data, key) {
  const input = Buffer.from(data);
  const secret = Buffer.from(key);
  if (!secret.length || secret.length > 1024 || input.length > 100000) throw rejected('Invalid cipher input.');
  const state = Uint8Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + state[i] + secret[i % secret.length]) & 255; [state[i], state[j]] = [state[j], state[i]]; }
  const output = Buffer.alloc(input.length);
  let i = 0; j = 0;
  for (let n = 0; n < input.length; n++) {
    i = (i + 1) & 255; j = (j + state[i]) & 255; [state[i], state[j]] = [state[j], state[i]];
    output[n] = input[n] ^ state[(state[i] + state[j]) & 255];
  }
  return output;
}

export function decodeVidsrcUrl(token) {
  const plain = rc4(decode64(token), 'WXrUARXb1aDLaZjI').toString('utf8').replace(/&amp;/g, '&');
  try { return decodeURIComponent(plain); } catch { throw rejected('The provider source token changed.'); }
}
export function encodeVidplayId(id, keys) {
  if (!Array.isArray(keys) || keys.length !== 2 || keys.some((key) => typeof key !== 'string' || !key.length || key.length > 1024)) throw invalidConfig('Configure two Vidplay cipher keys.');
  return rc4(rc4(Buffer.from(boundedToken(id, 1024)), keys[0]), keys[1]).toString('base64').replace(/\//g, '_');
}
export function encodeVidlinkId(id, keyHex, iv = randomBytes(16)) {
  if (!/^[a-f\d]{64}$/i.test(keyHex || '')) throw invalidConfig('The Vidlink cipher key must be 32 bytes of hexadecimal.');
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(keyHex, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(String(id)), cipher.final()]);
  return Buffer.from(`${iv.toString('hex')}:${encrypted.toString('hex')}`).toString('base64');
}
export function decodeEmbedSuConfig(html) {
  const token = html.match(/window\.vConfig\s*=\s*JSON\.parse\(atob\([`"']([A-Za-z0-9+/=_-]+)[`"']\)\)/)?.[1];
  if (!token) throw rejected('Embed.su did not expose its configuration.');
  const config = parseJson(decode64(token).toString('utf8'));
  const pieces = decode64(config.hash).toString('utf8').split('.').map(reverse);
  const servers = parseJson(decode64(reverse(pieces.join(''))).toString('utf8'));
  if (!Array.isArray(servers)) throw rejected('Embed.su returned an invalid server list.');
  return servers.slice(0, 4).map((server) => boundedToken(server.hash, 2048));
}

/** Server-owned fallback order; a custom extractor remains a single source unless configured otherwise. */
export function providerOrder(env) {
  const custom = !!(env.STREAM_MOVIE_EXTRACTOR_URL || env.STREAM_SHOW_EXTRACTOR_URL);
  const order = (env.STREAM_PROVIDER_ORDER || (custom ? 'custom' : 'miami,boise,orlando,paris,munich')).split(',').map((value) => value.trim());
  if (!order.length || order.length > Object.keys(PROVIDERS).length + 1 || new Set(order).size !== order.length || order.some((id) => id !== 'custom' && !Object.hasOwn(PROVIDERS, id)) || (order.includes('custom') && !custom)) throw invalidConfig('The stream provider order is invalid.');
  return order;
}

export function providerReferer(id, config) {
  if (id === undefined || id === 'custom') return config.referer;
  if (!Object.hasOwn(PROVIDERS, id)) throw new StreamError('Invalid playback provider.', 403, 'INVALID_TICKET');
  return PROVIDERS[id].referer || `${PROVIDERS[id].origin}/`;
}

export function publicServers(env) {
  const labels = { vidsrc: 'VidSrc', vidcore: 'VidCore', vidlink: 'VidLink', embedsu: 'Embed.su', custom: 'Custom' };
  return providerOrder(env).map((id) => ({ id, name: PROVIDERS[id]?.name || labels[id] }));
}

function pagePath(payload) {
  return payload.type === 'movie' ? `movie/${payload.tmdbId}` : `tv/${payload.tmdbId}/${payload.season}/${payload.episode}`;
}
function helperBase(env) {
  const value = env.STREAM_CRYPTO_API_URL || 'https://enc-dec.app/api';
  let url;
  try { url = new URL(value); } catch { throw invalidConfig('The crypto helper URL is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443')) throw invalidConfig('The crypto helper must be an HTTPS API URL.');
  return url.href.replace(/\/$/, '');
}
export function providerControlHosts(env) {
  return [...Object.values(PROVIDERS).map((provider) => new URL(provider.origin).hostname), 'vidplay.online', new URL(helperBase(env)).hostname];
}
function controlUrl(value, origin) {
  const url = new URL(boundedToken(value, 24000), origin);
  // Helper replies cannot redirect token-bearing requests to other hosts or endpoints with credentials.
  if (url.origin !== origin || url.username || url.password || url.hash) throw rejected('The provider returned an unexpected API host.');
  return url.href;
}

/** All I/O goes through the caller's bounded, pinned-DNS Axios client. */
export async function resolveProvider(id, payload, env, context) {
  const { read, config } = context;
  const origin = PROVIDERS[id]?.origin;
  const request = (url, options = {}) => read(url, { ...config, referer: providerReferer(id, config) }, options);
  const helperOrigin = new URL(helperBase(env)).origin;
  const helper = async (path, options = {}) => {
    const body = await read(`${helperBase(env)}/${path}`, { ...config, referer: `${helperOrigin}/` }, options);
    const data = parseJson(body.text);
    if (data?.status !== 200 || data.result === undefined) throw new StreamError('The token helper could not process this provider.', 502, 'TOKEN_HELPER_ERROR');
    return data.result;
  };
  if (id === 'custom') {
    const template = payload.type === 'movie' ? config.movieTemplate : config.showTemplate;
    const endpoint = template.replace(/\{(tmdbId|season|episode)\}/g, (_match, name) => String(payload[name]));
    const body = await request(endpoint);
    return body.text.trimStart().startsWith('#EXTM3U') ? [body.url] : playlistCandidates(body.text);
  }
  if (PROVIDERS[id]?.movy) {
    const cache = context.seedCache || sourceSeeds;
    // Concurrent mirrors must share a seed request, not hammer the rate-limited API.
    // Pending work belongs to this playback request, so an aborted request cannot
    // strand a future request behind another request's AbortSignal.
    const pending = context.seedPending || new Map();
    const cacheKey = `${origin}|${payload.tmdbId}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      let entry = cache.get(cacheKey);
      if (!entry || entry.expires - 5000 <= Date.now()) {
        let loading = pending.get(cacheKey);
        if (!loading) {
          loading = (async () => {
            const data = parseJson((await (context.readSeed || request)(`${origin}/seed?mediaId=${payload.tmdbId}`)).text);
            if (typeof data?.seed !== 'string' || !data.seed.length || data.seed.length > 512) throw rejected('The source provider returned an invalid seed.');
            const value = { seed: data.seed, expires: Date.now() + Math.max(0, Math.min(60000, Number.isFinite(data.ttlMs) ? data.ttlMs : 30000)) };
            if (cache.size >= 128) cache.delete(cache.keys().next().value);
            cache.set(cacheKey, value);
            return value;
          })();
          pending.set(cacheKey, loading);
          void loading.finally(() => { if (pending.get(cacheKey) === loading) pending.delete(cacheKey); }).catch(() => {});
        }
        entry = await loading;
      }
      const { seed } = entry;
      const params = new URLSearchParams({ tmdbId: String(payload.tmdbId), mediaType: payload.type === 'movie' ? 'movie' : 'tv', enc: '2', seed });
      if (payload.type === 'show') { params.set('seasonId', String(payload.season)); params.set('episodeId', String(payload.episode)); }
      try {
        const result = await request(`${origin}/${id}/sources?${params}`);
        return movyCandidates(decodeMovySources(result.text, seed, payload.tmdbId));
      } catch (error) {
        if (attempt !== 0 || error.upstreamStatus !== 401) throw error;
        cache.delete(cacheKey);
      }
    }
  }
  if (id === 'vidsrc') {
    const body = await request(`${origin}/embed/${pagePath(payload)}`);
    const clear = playlistCandidates(body.text);
    if (clear.length) return clear;
    const episodeId = body.text.match(/<a\b[^>]*\bdata-id\s*=\s*["']([A-Za-z0-9_-]{1,256})["']/i)?.[1];
    if (!episodeId) throw rejected('VidSrc did not expose its legacy episode token.');
    const data = parseJson((await request(`${origin}/ajax/embed/episode/${episodeId}/sources`)).text);
    const sources = Array.isArray(data?.result) ? data.result.filter((source) => /vidplay/i.test(source.title || '')).slice(0, 3) : [];
    let keys;
    try { keys = JSON.parse(env.STREAM_VIDPLAY_KEYS || '["dawQCziL2v","E1KyOcIMf9v7XHg"]'); } catch { throw invalidConfig('The Vidplay keys are invalid JSON.'); }
    const candidates = [];
    for (const source of sources) {
      const sourceId = boundedToken(String(source.id), 256);
      const result = parseJson((await request(`${origin}/ajax/embed/source/${encodeURIComponent(sourceId)}`)).text);
      const embed = controlUrl(decodeVidsrcUrl(result?.result?.url), 'https://vidplay.online');
      const videoId = new URL(embed).pathname.match(/^\/e\/([A-Za-z0-9_-]+)$/)?.[1];
      if (!videoId) continue;
      const encoded = encodeVidplayId(videoId, keys);
      const futoken = (await read('https://vidplay.online/futoken', { ...config, referer: embed })).text.match(/\bvar\s+k\s*=\s*['"]([^'"\r\n]{1,1024})['"]/)?.[1];
      if (!futoken) continue;
      const token = `${futoken},${[...encoded].map((char, i) => futoken.charCodeAt(i % futoken.length) + char.charCodeAt(0)).join(',')}`;
      const info = new URL(`/mediainfo/${encodeURIComponent(token)}`, embed);
      info.search = new URL(embed).search;
      info.searchParams.set('autostart', 'true');
      candidates.push(...playlistCandidates((await read(info.href, { ...config, referer: embed })).text));
    }
    return candidates;
  }
  if (id === 'embedsu') {
    const page = await request(`${origin}/embed/${pagePath(payload)}`);
    const candidates = playlistCandidates(page.text);
    if (candidates.length) return candidates;
    for (const hash of decodeEmbedSuConfig(page.text)) candidates.push(...playlistCandidates((await request(`${origin}/api/e/${encodeURIComponent(hash)}`)).text));
    return candidates;
  }
  if (id === 'vidlink') {
    const encoded = env.STREAM_VIDLINK_KEY ? encodeVidlinkId(payload.tmdbId, env.STREAM_VIDLINK_KEY) : boundedToken(await helper(`enc-vidlink?text=${payload.tmdbId}`), 4096);
    const path = payload.type === 'movie' ? `movie/${encodeURIComponent(encoded)}` : `tv/${encodeURIComponent(encoded)}/${payload.season}/${payload.episode}`;
    let body = (await request(`${origin}/api/b/${path}?multiLang=0`)).text;
    if (env.STREAM_VIDLINK_KEY && /^[a-f\d]{32}:[a-f\d]+$/i.test(body) && body.length <= 200000) {
      const [iv, encrypted] = body.split(':');
      const decipher = createDecipheriv('aes-256-cbc', Buffer.from(env.STREAM_VIDLINK_KEY, 'hex'), Buffer.from(iv, 'hex'));
      body = Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
    }
    // MP4/DASH responses deliberately do not masquerade as an HLS source.
    return playlistCandidates(body);
  }
  if (id === 'vidcore') {
    const page = await request(`${origin}/${pagePath(payload)}`);
    const clear = playlistCandidates(page.text);
    if (clear.length) return clear;
    const en = page.text.match(/\\"(?:en|token)\\":\\"([^\\"]+)\\"/)?.[1];
    if (!en) throw rejected('VidCore did not expose its catalog token.');
    const stage1 = await helper(`enc-vidcore?stage=1&text=${encodeURIComponent(boundedToken(en))}`);
    const handshakeHeaders = { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': boundedToken(stage1?.token, 8192) };
    const handshake = await request(controlUrl(stage1?.stage1, origin), { method: 'POST', headers: handshakeHeaders });
    const stage2 = await helper(`enc-vidcore?stage=2&text=${encodeURIComponent(boundedToken(handshake.text))}`);
    const headers = { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': boundedToken(stage2?.token, 8192) };
    const decode = (text) => helper('dec-vidcore', { method: 'POST', body: JSON.stringify({ text }), contentType: 'application/json' });
    const servers = await decode((await request(controlUrl(stage2?.servers, origin), { method: 'POST', headers })).text);
    if (!Array.isArray(servers)) throw rejected('VidCore returned an invalid mirror catalog.');
    const streamBase = controlUrl(stage2?.stream, origin);
    // Known mirrors first; ignore advertisements and other fields in the catalog.
    const rank = ['Supreme', 'Prime', 'Orbit', 'Premiere 4K', 'Horizon'];
    const mirrors = servers.filter((server) => rank.includes(server.name)).sort((a, b) => rank.indexOf(a.name) - rank.indexOf(b.name)).slice(0, 5);
    const candidates = [];
    for (const server of mirrors) {
      try {
        const stream = await decode((await request(`${streamBase}/${encodeURIComponent(boundedToken(server.data))}`, { method: 'POST', headers })).text);
        if (stream?.tmdbId !== undefined && String(stream.tmdbId) !== String(payload.tmdbId)) continue;
        if (typeof stream?.url === 'string') {
          if (context.validate) {
            // Stop at the first verified mirror instead of unlocking all five on every request.
            await context.validate(stream.url);
            return [stream.url];
          }
          candidates.push(stream.url);
        }
      } catch (error) { if (context.signal.aborted) throw error; }
    }
    return [...new Set(candidates)];
  }
  throw invalidConfig('Unknown stream provider.');
}
