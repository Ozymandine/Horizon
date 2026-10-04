import axios from 'axios';
import { Agent } from 'node:https';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { allowedUrl, boundedBody, pinnedAddress, RelayError, ticketCodec, validRange } from '../services/stream-relay/security.mjs';
import { rewriteManifest } from '../services/stream-relay/hls.mjs';
import { StreamError } from './stream-errors.mjs';
import { PROVIDERS, VERIFIED_MEDIA_HOSTS, providerControlHosts, providerOrder, providerReferer, resolveProvider } from './stream-providers.mjs';
export { StreamError } from './stream-errors.mjs';

const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };
const MEDIA_TYPES = new Set(['video/mp2t', 'video/mp4', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'video/webm', 'application/octet-stream', 'text/vtt']);
const MAX_SEGMENT = 32 * 1024 * 1024;

/** Server-owned templates only. A TMDB ID is never interpreted as a hostname or URL. */
export function streamConfiguration(env = process.env) {
  if (!env.AUTH_SECRET) throw new StreamError('Private playback authentication is not configured.', 503, 'NOT_CONFIGURED');
  const movieTemplate = env.STREAM_MOVIE_EXTRACTOR_URL || 'https://vidsrc.to/embed/movie/{tmdbId}';
  const showTemplate = env.STREAM_SHOW_EXTRACTOR_URL || 'https://vidsrc.to/embed/tv/{tmdbId}/{season}/{episode}';
  const hosts = new Set((env.STREAM_ALLOWED_HOSTS || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
  const order = providerOrder(env);
  for (const host of providerControlHosts(env)) hosts.add(host);
  if (order.some((id) => id !== 'custom')) for (const host of VERIFIED_MEDIA_HOSTS) hosts.add(host);
  for (const template of [movieTemplate, showTemplate]) {
    let url;
    try { url = new URL(template.replace(/\{(?:tmdbId|season|episode)\}/g, '1')); } catch { throw new StreamError('The extractor URL is not configured correctly.', 503, 'INVALID_CONFIG'); }
    hosts.add(url.hostname);
    allowedUrl(url, hosts);
  }
  const referer = env.STREAM_REFERER || `${new URL(movieTemplate.replace('{tmdbId}', '1')).origin}/`;
  if (!/^https:\/\//.test(referer) || /[\r\n]/.test(referer)) throw new StreamError('The provider Referer is invalid.', 503, 'INVALID_CONFIG');
  return { hosts, movieTemplate, showTemplate, referer, order,
    userAgent: env.STREAM_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    // Domain separation: login signatures cannot be used as playback capabilities.
    // Long movies should not stop at the old relay's two-hour ticket boundary.
    tickets: ticketCodec(`horizon-stream-v1:${env.STREAM_TICKET_SECRET || env.AUTH_SECRET}`, () => Date.now(), 6 * 60 * 60 * 1000),
  };
}

/** Axios HTTP adapter, verified TLS, public DNS pinned to the socket, manual safe redirects. */
export async function axiosUpstream(input, config, { range, signal, method = 'GET', body, contentType, headers: providerHeaders = {} } = {}, redirects = 0) {
  const url = allowedUrl(input, config.hosts);
  const headers = { 'User-Agent': config.userAgent, Referer: config.referer, Accept: '*/*', 'Accept-Encoding': 'identity' };
  if (range) headers.Range = validRange(range);
  if (!['GET', 'POST'].includes(method) || (body !== undefined && (typeof body !== 'string' || Buffer.byteLength(body) > 2 * 1024 * 1024))) throw new StreamError('Invalid provider request.', 502, 'INVALID_PROVIDER_REQUEST');
  for (const [name, value] of Object.entries(providerHeaders)) {
    if (!['X-CSRF-Token', 'X-Requested-With'].includes(name) || typeof value !== 'string' || value.length > 8192 || /[\r\n\x00]/.test(value)) throw new StreamError('Invalid provider header.', 502, 'INVALID_PROVIDER_REQUEST');
    headers[name] = value;
  }
  if (body !== undefined) {
    if (!['application/json', 'application/x-www-form-urlencoded'].includes(contentType)) throw new StreamError('Invalid provider content type.', 502, 'INVALID_PROVIDER_REQUEST');
    headers['Content-Type'] = contentType;
  }
  // DNS itself has no AbortSignal API. Bound it by the same overall request deadline.
  const address = await abortable(pinnedAddress(url, config.hosts), signal);
  signal?.throwIfAborted();
  const agent = new Agent({ keepAlive: false, lookup: (_host, options, callback) => {
    if (options.all) callback(null, [address]);
    else callback(null, address.address, address.family);
  } });
  let result;
  try {
    result = await axios.request({ url: url.href, method, data: body, adapter: 'http', proxy: false, httpsAgent: agent, headers,
      responseType: 'stream', decompress: false, maxRedirects: 0, timeout: 10_000, signal,
      maxContentLength: MAX_SEGMENT, validateStatus: () => true,
    });
  } catch (error) { agent.destroy(); throw error; }
  const response = result.data;
  response.statusCode = result.status;
  response.headers = result.headers;
  response.once('close', () => agent.destroy());
  if ([301, 302, 303, 307, 308].includes(result.status)) {
    response.destroy();
    if (redirects >= 3 || !result.headers.location) throw new StreamError('The provider redirected too many times.', 502, 'PROVIDER_REDIRECT');
    const target = new URL(result.headers.location, url);
    if (target.origin !== url.origin && (method === 'POST' || Object.keys(providerHeaders).length)) throw new StreamError('The token request redirected to another host.', 502, 'PROVIDER_REDIRECT');
    const toGet = result.status === 303 || ([301, 302].includes(result.status) && method === 'POST');
    return axiosUpstream(target.href, config, { range, signal, method: toGet ? 'GET' : method, body: toGet ? undefined : body, contentType, headers: toGet ? {} : providerHeaders }, redirects + 1);
  }
  return { response, url: url.href };
}

function abortable(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

// Match Horizon's HttpOnly session, including in a standalone /api/stream.js deployment.
function authenticated(request, secret) {
  const token = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('horizon_session='))?.slice('horizon_session='.length);
  if (!secret || !token) return false;
  const [expires, signature, extra] = token.split('.');
  if (extra !== undefined || !/^\d{10,12}$/.test(expires) || Number(expires) <= Date.now() / 1000 || !signature) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(expires).digest('base64url'));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function originOf(request) {
  const url = new URL(request.url);
  // Next may normalize 127.0.0.1 internally; compare the actual HTTP Host.
  const host = request.headers.get('host') || url.host;
  const origin = new URL(`${url.protocol}//${host}`);
  if (origin.host !== host || origin.username || origin.password || origin.pathname !== '/') throw new StreamError('Invalid request host.', 400, 'INVALID_REQUEST');
  return origin.origin;
}

async function playbackPayload(request, signal) {
  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    return { type: params.get('type') || 'movie', tmdbId: Number(params.get('tmdbId')), season: Number(params.get('season')), episode: Number(params.get('episode')) };
  }
  if (request.method !== 'POST') throw new StreamError('Use GET or POST for playback.', 405, 'METHOD_NOT_ALLOWED');
  if (request.headers.get('origin') !== originOf(request)) throw new StreamError('Use Play from your Horizon details page.', 403, 'INVALID_ORIGIN');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new StreamError('A JSON playback request is required.', 415, 'INVALID_CONTENT_TYPE');
  if (Number(request.headers.get('content-length') || 0) > 4096) throw new StreamError('Playback request is too large.', 413, 'REQUEST_TOO_LARGE');
  const reader = request.body?.getReader();
  const chunks = [];
  let size = 0;
  try {
    if (reader) while (true) {
      const { done, value } = await abortable(reader.read(), signal);
      if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); throw new StreamError('Playback request is too large.', 413, 'REQUEST_TOO_LARGE'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof StreamError) throw error;
    throw new StreamError('Invalid playback request.', 400, 'INVALID_REQUEST');
  } finally { reader?.releaseLock(); }
}

function validPayload(payload) {
  if (!payload || !['movie', 'show'].includes(payload.type) || !Number.isSafeInteger(payload.tmdbId) || payload.tmdbId < 1 ||
    (payload.type === 'show' && (!Number.isSafeInteger(payload.season) || payload.season < 0 || !Number.isSafeInteger(payload.episode) || payload.episode < 1))) {
    throw new StreamError('Choose a movie or a valid show episode.', 400, 'INVALID_REQUEST');
  }
  return payload;
}

function providerStatus(response, url) {
  if (![200, 206].includes(response.statusCode)) {
    const status = response.statusCode;
    response.destroy();
    const error = new StreamError(status === 404 ? 'The provider has no stream for this title.' : 'The provider could not serve this stream.', status === 404 ? 404 : status === 416 ? 416 : 502, 'PROVIDER_HTTP_ERROR');
    error.upstreamStatus = status;
    // Host only: no signed path, query, CSRF token or response body enters logs.
    error.upstreamHost = url ? new URL(url).hostname : undefined;
    throw error;
  }
}

function json(data, status = 200) { return Response.json(data, { status, headers: RESPONSE_HEADERS }); }

/** Logs exclude signed URLs, Axios config, cookies, response HTML and stacks. */
function failure(error, context, logger = console.error) {
  const timeout = ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code) || error?.name === 'TimeoutError' || context.signal?.reason?.name === 'TimeoutError';
  const known = error instanceof RelayError;
  const status = timeout ? 504 : known ? error.status : 502;
  const code = timeout ? 'PROVIDER_TIMEOUT' : error instanceof StreamError ? error.code : known ? 'STREAM_REJECTED' : 'PROVIDER_UNREACHABLE';
  const message = timeout ? 'The provider timed out. Try again shortly.' : known ? error.message : 'The stream provider could not be reached.';
  logger(JSON.stringify({ event: 'horizon_stream_error', requestId: context.id, operation: context.operation, phase: context.phase, provider: context.provider, code, status, upstreamStatus: error?.upstreamStatus, upstreamHost: error?.upstreamHost, elapsedMs: Date.now() - context.started }));
  return json({ error: message, code, requestId: context.id }, status);
}

/** Resolve data exposed by an extractor; never execute third-party player JavaScript. */
export async function handleStreamRequest(request, env = process.env, dependencies = {}) {
  const context = { id: randomUUID(), operation: 'resolve', phase: 'authenticate', started: Date.now() };
  if (!authenticated(request, env.AUTH_SECRET)) return json({ error: 'Sign in to Horizon to play.', code: 'UNAUTHORIZED' }, 401);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(28_000)]);
  context.signal = signal;
  const fetchSource = dependencies.upstream || axiosUpstream;
  try {
    context.phase = 'request';
    const payload = validPayload(await playbackPayload(request, signal));
    const config = streamConfiguration(env);
    let lastError;
    for (const provider of config.order) {
      signal.throwIfAborted();
      context.provider = provider;
      const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(dependencies.providerTimeoutMs || PROVIDERS[provider]?.timeout || 20_000)]);
      const attemptConfig = { ...config, referer: providerReferer(provider, config) };
      const read = async (endpoint, settings = attemptConfig, options = {}) => {
        attemptSignal.throwIfAborted();
        allowedUrl(endpoint, config.hosts);
        const { response, url } = await abortable(fetchSource(endpoint, settings, { ...options, signal: attemptSignal }), attemptSignal);
        const cancel = () => response.destroy(attemptSignal.reason);
        attemptSignal.addEventListener('abort', cancel, { once: true });
        try {
          providerStatus(response, url);
          return { url, text: (await abortable(boundedBody(response), attemptSignal)).toString('utf8') };
        } finally { attemptSignal.removeEventListener('abort', cancel); }
      };
      const validated = new Map();
      const validate = async (candidate) => {
        context.phase = 'playlist';
        const manifest = await read(candidate);
        if (Buffer.byteLength(manifest.text) > 1024 * 1024) throw new StreamError('The playlist exceeds the relay limit.', 502, 'INVALID_MEDIA');
        rewriteManifest(manifest.text, manifest.url, config.hosts, config.tickets.encode);
        if (provider !== 'custom') {
          // An accessible master can still point at blocked or rotated CDN hosts.
          // Preflight one video rendition before claiming that this mirror is usable.
          const variants = [...manifest.text.matchAll(/#EXT-X-STREAM-INF:([^\r\n]+)\r?\n([^#\r\n]+)/g)];
          const selected = variants.find((entry) => /RESOLUTION=\d+x1080(?:,|$)/.test(entry[1])) || variants[0];
          if (selected) {
            const media = await read(new URL(selected[2].trim(), manifest.url).href);
            if (Buffer.byteLength(media.text) > 1024 * 1024) throw new StreamError('The playlist exceeds the relay limit.', 502, 'INVALID_MEDIA');
            rewriteManifest(media.text, media.url, config.hosts, config.tickets.encode);
          }
        }
        validated.set(candidate, manifest);
        return manifest;
      };
      try {
        context.phase = 'extractor';
        const candidates = await resolveProvider(provider, payload, env, { read, config, signal: attemptSignal, validate });
        if (!candidates.length) throw new StreamError('The provider returned no HLS source for this title.', 422, 'NO_HLS_SOURCE');
        context.phase = 'playlist';
        let candidateError;
        for (const candidate of candidates.slice(0, 6)) {
          attemptSignal.throwIfAborted();
          try {
            const manifest = validated.get(candidate) || await validate(candidate);
            const ticket = config.tickets.encode({ url: manifest.url, kind: 'manifest', provider });
            return json({ source: `${originOf(request)}/api/proxy-stream?token=${ticket}` });
          } catch (error) { candidateError = error; }
        }
        throw candidateError;
      } catch (error) {
        lastError = attemptSignal.reason?.name === 'TimeoutError' ? attemptSignal.reason : error;
        if (signal.aborted) throw signal.reason;
        if (config.order.length === 1) throw lastError;
        // Only sanitized metadata is logged for an unsuccessful fallback.
        failure(lastError, context, dependencies.log);
      }
    }
    throw new StreamError('None of the stream providers could supply a verified HLS playlist. Try again later.', 502, 'ALL_PROVIDERS_FAILED');
  } catch (error) { return failure(error, context, dependencies.log); }
}

/** Stateless relay: capabilities survive cold starts while the server secret remains stable. */
export async function handleProxyRequest(request, env = process.env, dependencies = {}) {
  const context = { id: randomUUID(), operation: 'proxy', phase: 'authenticate', started: Date.now() };
  if (!authenticated(request, env.AUTH_SECRET)) return json({ error: 'Sign in to Horizon to play.', code: 'UNAUTHORIZED' }, 401);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]);
  context.signal = signal;
  try {
    if (request.method !== 'GET') throw new StreamError('Use GET for media.', 405, 'METHOD_NOT_ALLOWED');
    context.phase = 'ticket';
    const token = new URL(request.url).searchParams.get('token');
    if (!token || token.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new StreamError('Invalid playback link.', 400, 'INVALID_TICKET');
    const config = streamConfiguration(env);
    const resource = config.tickets.decode(token);
    config.referer = providerReferer(resource.provider, config);
    context.provider = resource.provider;
    const range = resource.kind === 'manifest' ? undefined : validRange(request.headers.get('range'));
    context.phase = 'upstream';
    const { response, url } = await (dependencies.upstream || axiosUpstream)(resource.url, config, { range, signal });
    providerStatus(response, url);
    context.phase = resource.kind;
    if (resource.kind === 'manifest') {
      const text = rewriteManifest((await boundedBody(response, 1024 * 1024)).toString('utf8'), url, config.hosts, (child) => config.tickets.encode({ ...child, provider: resource.provider }));
      return new Response(text, { headers: { ...RESPONSE_HEADERS, 'Content-Type': 'application/vnd.apple.mpegurl' } });
    }
    const mime = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const maximum = resource.kind === 'key' ? 1024 : MAX_SEGMENT;
    if (!MEDIA_TYPES.has(mime) || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
      response.destroy(); throw new StreamError('The provider returned non-media content.', 502, 'INVALID_MEDIA');
    }
    if (Number(response.headers['content-length'] || 0) > maximum) { response.destroy(); throw new StreamError('This media chunk exceeds the relay limit.', 502, 'MEDIA_TOO_LARGE'); }
    if (resource.kind === 'key') {
      const key = await boundedBody(response, maximum);
      if (key.length !== 16) throw new StreamError('The AES media key is invalid.', 502, 'INVALID_KEY');
      return new Response(key, { headers: { ...RESPONSE_HEADERS, 'Content-Type': 'application/octet-stream' } });
    }
    const headers = new Headers({ ...RESPONSE_HEADERS, 'Content-Type': mime });
    for (const name of ['content-range', 'accept-ranges']) if (response.headers[name]) headers.set(name, String(response.headers[name]));
    let received = 0;
    const limited = new Transform({ transform(chunk, _encoding, callback) {
      received += chunk.length;
      callback(received > maximum ? new StreamError('This media chunk exceeds the relay limit.', 502, 'MEDIA_TOO_LARGE') : null, chunk);
    } });
    // No whole-file buffering/content-length: send an actual streaming response to Vercel.
    // Errors after headers close the stream; they cannot become a second JSON response.
    void pipeline(response, limited, { signal }).catch((error) => {
      if (!request.signal.aborted) failure(error, context, dependencies.log);
    });
    return new Response(Readable.toWeb(limited), { status: response.statusCode, headers });
  } catch (error) { return failure(error, context, dependencies.log); }
}

/** Classic Vercel req/res adapter; Next's route handlers use the same Web API core. */
export function nodeHandler(core) {
  return async (req, res) => {
    const controller = new AbortController();
    res.once('close', () => { if (!res.writableFinished) controller.abort(); });
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      const protocol = process.env.VERCEL || req.socket.encrypted ? 'https:' : 'http:';
      const init = { method: req.method, headers, signal: controller.signal };
      if (!['GET', 'HEAD'].includes(req.method)) {
        // Vercel can preparse JSON. The core still bounds input to 4KB.
        init.body = req.body === undefined ? Readable.toWeb(req) : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        init.duplex = 'half';
      }
      const response = await core(new Request(`${protocol}//${req.headers.host}${req.url}`, init));
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      if (response.body) await pipeline(Readable.fromWeb(response.body), res, { signal: controller.signal });
      else res.end();
    } catch (error) {
      if (controller.signal.aborted) return;
      const response = failure(error, { id: randomUUID(), operation: 'adapter', phase: 'response', started: Date.now() });
      if (res.headersSent) res.destroy();
      else { res.statusCode = response.status; response.headers.forEach((value, name) => res.setHeader(name, value)); res.end(await response.text()); }
    }
  };
}
