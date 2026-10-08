import axios from 'axios';
import { Agent } from 'node:https';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { boundedBody, pinnedAddress, validRange } from '../services/stream-relay/security.mjs';
import { StreamError } from './stream-errors.mjs';
import { PROVIDERS } from './stream-providers.mjs';

const HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };
const PLAYLIST_TYPES = new Set(['application/vnd.apple.mpegurl', 'application/x-mpegurl']);
const MEDIA_TYPES = new Set(['video/mp2t', 'video/mp4', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'video/webm', 'application/octet-stream', 'text/vtt']);
const MAX_MEDIA = 32 * 1024 * 1024;
const ticketPattern = /^[A-Za-z0-9_-]{1,12000}$/;

/** Render is a server-owned origin, never a URL supplied by a browser. */
export function renderConfiguration(env) {
  let base;
  try { base = new URL(env.RENDER_URL); } catch { throw new StreamError('The hosted stream service URL is not configured.', 503, 'RENDER_NOT_CONFIGURED'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/' || (base.port && base.port !== '443')) throw new StreamError('The hosted stream service URL must be an HTTPS origin.', 503, 'RENDER_NOT_CONFIGURED');
  if (!/^[A-Za-z0-9_-]{32,512}$/.test(env.STREAM_RELAY_TOKEN || '')) throw new StreamError('The hosted stream service credential is not configured.', 503, 'RENDER_NOT_CONFIGURED');
  return { origin: base.origin, hosts: new Set([base.hostname]), token: env.STREAM_RELAY_TOKEN };
}

/** Authenticated server-to-server HTTP with pinned public DNS and no redirects. */
export async function renderUpstream(url, config, { signal, method = 'GET', body, range } = {}) {
  const address = await pinnedAddress(new URL(url), config.hosts);
  signal?.throwIfAborted();
  const agent = new Agent({ lookup: (_host, options, callback) => options.all ? callback(null, [address]) : callback(null, address.address, address.family) });
  const headers = { Authorization: `Bearer ${config.token}`, Accept: '*/*', 'Accept-Encoding': 'identity' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (range) headers.Range = validRange(range);
  try {
    const result = await axios.request({ url, method, data: body, headers, adapter: 'http', proxy: false, httpsAgent: agent, responseType: 'stream', decompress: false, maxRedirects: 0, timeout: 25000, signal, validateStatus: () => true });
    const response = result.data;
    response.statusCode = result.status;
    response.headers = result.headers;
    response.once('close', () => agent.destroy());
    return { response };
  } catch (error) { agent.destroy(); throw error; }
}

function abortable(promise, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function readBody(response, maximum, signal) {
  const cancel = () => response.destroy(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  try { return await abortable(boundedBody(response, maximum), signal); }
  finally { signal.removeEventListener('abort', cancel); }
}

async function serviceRequest(path, env, dependencies, options) {
  const config = renderConfiguration(env);
  const { response } = await abortable((dependencies.renderUpstream || renderUpstream)(`${config.origin}${path}`, config, options), options.signal);
  if (![200, 206].includes(response.statusCode)) {
    const status = response.statusCode;
    // Read only bounded JSON errors. Never send a Render error page or signed URL to the browser.
    let data;
    if (String(response.headers['content-type'] || '').startsWith('application/json')) {
      try { data = JSON.parse((await readBody(response, 16000, options.signal)).toString()); } catch { /* Generic controlled error below. */ }
    }
    response.destroy();
    if (status === 401) throw new StreamError('The hosted stream service credential does not match.', 502, 'RENDER_AUTH_FAILED');
    const code = /^[A-Z_]{1,64}$/.test(data?.code || '') ? data.code : 'RENDER_UNAVAILABLE';
    // Use our own messages even if a misconfigured service echoes credentials or HTML.
    const message = status === 403 ? 'This playback link expired or is invalid. Open Play again.'
      : status === 429 ? 'The stream service is busy. Try again shortly.'
      : status === 504 ? 'The stream service timed out. Try again shortly.'
      : 'The hosted stream service could not supply this stream.';
    throw new StreamError(message, [400, 403, 404, 413, 415, 416, 422, 429, 503, 504].includes(status) ? status : 502, code);
  }
  return { response, config };
}

/** The browser receives the original one-field contract and stays on Horizon's origin. */
export async function resolveThroughRender(payload, browserOrigin, env, dependencies, signal) {
  const { response, config } = await serviceRequest('/api/stream', env, dependencies, { method: 'POST', body: JSON.stringify(payload), signal });
  if (!String(response.headers['content-type'] || '').startsWith('application/json')) { response.destroy(); throw new StreamError('The hosted resolver returned an invalid response.', 502, 'INVALID_RENDER_SOURCE'); }
  let data, source;
  try { data = JSON.parse((await readBody(response, 16000, signal)).toString()); source = new URL(data.source); } catch { throw new StreamError('The hosted resolver returned an invalid playback link.', 502, 'INVALID_RENDER_SOURCE'); }
  const token = source.searchParams.get('token');
  if (Object.keys(data).length !== 1 || source.origin !== config.origin || source.pathname !== '/api/proxy-stream' || source.hash || source.username || source.password || [...source.searchParams.keys()].length !== 1 || !ticketPattern.test(token || '')) throw new StreamError('The hosted resolver returned an invalid playback link.', 502, 'INVALID_RENDER_SOURCE');
  const server = response.headers['x-horizon-stream-server'];
  if (server !== undefined && (typeof server !== 'string' || (server !== 'custom' && !Object.hasOwn(PROVIDERS, server)))) throw new StreamError('The hosted resolver returned an invalid server.', 502, 'INVALID_RENDER_SOURCE');
  return Response.json({ source: `${browserOrigin}/api/proxy-stream?token=${token}` }, { headers: { ...HEADERS, ...(server ? { 'X-Horizon-Stream-Server': server } : {}) } });
}

export async function serversThroughRender(env, dependencies, signal) {
  const { response } = await serviceRequest('/api/stream/servers', env, dependencies, { signal });
  let data;
  try { data = JSON.parse((await readBody(response, 16000, signal)).toString()); } catch { throw new StreamError('The hosted server list is invalid.', 502, 'INVALID_RENDER_SOURCE'); }
  if (!data || !Array.isArray(data.servers) || data.servers.length > Object.keys(PROVIDERS).length + 1
    || new Set(data.servers.map((server) => server?.id)).size !== data.servers.length
    || data.servers.some((server) => !server || (server.id !== 'custom' && !Object.hasOwn(PROVIDERS, server.id)))) throw new StreamError('The hosted server list is invalid.', 502, 'INVALID_RENDER_SOURCE');
  // Labels are owned by Horizon; remote error strings/HTML never populate the UI.
  const names = { vidsrc: 'VidSrc', vidcore: 'VidCore', vidlink: 'VidLink', embedsu: 'Embed.su', custom: 'Custom' };
  return data.servers.map(({ id }) => ({ id, name: PROVIDERS[id]?.name || names[id] }));
}

/** Relay capabilities remain encrypted by Render; the website never exposes its bearer credential. */
export async function proxyThroughRender(request, env, dependencies, signal, onStreamError) {
  const token = new URL(request.url).searchParams.get('token');
  if (!ticketPattern.test(token || '')) throw new StreamError('Invalid playback link.', 400, 'INVALID_TICKET');
  const range = validRange(request.headers.get('range'));
  const { response } = await serviceRequest(`/api/proxy-stream?token=${token}`, env, dependencies, { signal, range });
  const mime = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (PLAYLIST_TYPES.has(mime)) {
    const text = (await readBody(response, 1024 * 1024, signal)).toString();
    const validPath = (value) => /^\/api\/proxy-stream\?token=[A-Za-z0-9_-]{1,12000}$/.test(value);
    if (!text.startsWith('#EXTM3U\n') || !/^#(?:EXTINF:|EXT-X-STREAM-INF:|EXT-X-I-FRAME-STREAM-INF:|EXT-X-PART:)/m.test(text) || /https?:\/\//i.test(text) || text.split('\n').some((line) => line && !line.startsWith('#') && !validPath(line)) || [...text.matchAll(/\bURI="([^"]+)"/g)].some((entry) => !validPath(entry[1]))) throw new StreamError('The hosted service returned an unsafe playlist.', 502, 'INVALID_RENDER_MEDIA');
    return new Response(text, { headers: { ...HEADERS, 'Content-Type': 'application/vnd.apple.mpegurl' } });
  }
  if (!MEDIA_TYPES.has(mime) || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') || Number(response.headers['content-length'] || 0) > MAX_MEDIA) { response.destroy(); throw new StreamError('The hosted service returned invalid media.', 502, 'INVALID_RENDER_MEDIA'); }
  let received = 0;
  const limited = new Transform({ transform(chunk, _encoding, callback) { received += chunk.length; callback(received > MAX_MEDIA ? new StreamError('Media chunk exceeds its limit.', 502, 'MEDIA_TOO_LARGE') : null, chunk); } });
  const headers = new Headers({ ...HEADERS, 'Content-Type': mime });
  for (const name of ['content-range', 'accept-ranges']) if (response.headers[name]) headers.set(name, String(response.headers[name]));
  void pipeline(response, limited, { signal }).catch((error) => {
    // An error after headers closes the stream and gets the same sanitized request log.
    if (!request.signal.aborted) onStreamError?.(error);
  });
  return new Response(Readable.toWeb(limited), { status: response.statusCode, headers });
}
