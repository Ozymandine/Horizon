import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { upstream, boundedBody, ticketCodec, RelayError } from './security.mjs';
import { rewriteManifest } from './hls.mjs';
import { resolvePlaylist } from './resolver.mjs';

export function configuration(env = process.env) {
  if (!env.STREAM_RELAY_TOKEN || env.STREAM_RELAY_TOKEN.length < 32) throw new Error('Set STREAM_RELAY_TOKEN to a random secret of at least 32 characters.');
  const hosts = new Set((env.STREAM_ALLOWED_HOSTS || 'vidsrc.to,vsembed.ru').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
  return {
    token: env.STREAM_RELAY_TOKEN, hosts,
    movieTemplate: env.STREAM_MOVIE_TEMPLATE || 'https://vidsrc.to/embed/movie/{tmdbId}',
    showTemplate: env.STREAM_SHOW_TEMPLATE || 'https://vidsrc.to/embed/tv/{tmdbId}/{season}/{episode}',
    userAgent: env.STREAM_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    referer: env.STREAM_REFERER || 'https://vidsrc.to/',
    browserImage: env.STREAM_BROWSER_IMAGE || '',
    seccompPath: resolve(env.STREAM_SECCOMP_PATH || fileURLToPath(new URL('./seccomp_profile.json', import.meta.url))),
  };
}

function authorized(header, token) {
  const supplied = Buffer.from(header || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createRelay(config, dependencies = {}) {
  const app = express();
  const fetchSource = dependencies.upstream || upstream;
  const resolveSource = dependencies.resolvePlaylist || resolvePlaylist;
  const tickets = ticketCodec(config.token);
  let active = 0;
  let resolving = false;
  const resolutions = [];
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
    if (!authorized(req.get('authorization'), config.token)) return res.status(401).json({ error: 'Unauthorized relay request.' });
    if (active >= 24) return res.status(429).json({ error: 'The stream relay is busy.' });
    active++;
    res.once('close', () => active--);
    next();
  });
  app.use(express.json({ limit: '4kb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, browserWorkerConfigured: Boolean(config.browserImage) }));
  app.post('/api/resolve-stream', async (req, res) => {
    while (resolutions.length && resolutions[0] < Date.now() - 60_000) resolutions.shift();
    if (resolving || resolutions.length >= 12) return res.status(429).json({ error: 'The resolver is busy. Try again shortly.' });
    resolutions.push(Date.now());
    resolving = true;
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    try {
      const url = await resolveSource(req.body, config, controller.signal);
      // Validate the actual manifest before issuing a playback capability.
      const { response, url: finalUrl } = await fetchSource(url, config, { signal: controller.signal });
      if (response.statusCode !== 200) { response.resume(); throw new RelayError('The provider stream is unavailable.', 404); }
      rewriteManifest((await boundedBody(response, 1024 * 1024)).toString(), finalUrl, config.hosts, tickets.encode);
      res.json({ source: `/api/proxy-stream?token=${tickets.encode({ url: finalUrl, kind: 'manifest' })}`, expiresIn: 7200 });
    } finally { resolving = false; }
  });
  app.get('/api/proxy-stream', async (req, res) => {
    const resource = tickets.decode(req.query.token);
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const { response, url } = await fetchSource(resource.url, config, { range: resource.kind === 'manifest' ? undefined : req.get('range'), signal: controller.signal });
    if (![200, 206].includes(response.statusCode)) { response.resume(); throw new RelayError('The provider media is unavailable.', response.statusCode === 416 ? 416 : 502); }
    if (resource.kind === 'manifest') {
      const text = (await boundedBody(response, 1024 * 1024)).toString();
      return res.type('application/vnd.apple.mpegurl').send(rewriteManifest(text, url, config.hosts, tickets.encode));
    }
    const mime = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') { response.destroy(); throw new RelayError('Compressed media chunks are unsupported.'); }
    const allowed = ['video/mp2t', 'video/mp4', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'video/webm', 'application/octet-stream', 'text/vtt'];
    if (!allowed.includes(mime)) { response.destroy(); throw new RelayError('The provider returned non-media content.'); }
    const max = resource.kind === 'key' ? 1024 : 32 * 1024 * 1024;
    if (Number(response.headers['content-length'] || 0) > max) { response.destroy(); throw new RelayError('Media chunk exceeds its size limit.'); }
    if (resource.kind === 'key') {
      const key = await boundedBody(response, max);
      if (key.length !== 16) throw new RelayError('The AES media key is invalid.');
      return res.type('application/octet-stream').send(key);
    }
    res.status(response.statusCode).type(mime);
    for (const header of ['content-length', 'content-range', 'accept-ranges']) if (response.headers[header]) res.set(header, String(response.headers[header]));
    let received = 0;
    const limit = new Transform({ transform(chunk, _encoding, callback) {
      received += chunk.length;
      callback(received > max ? new RelayError('Media chunk exceeds its size limit.') : null, chunk);
    } });
    // Streaming backpressure buffers bounded chunks rather than whole movies in memory.
    await pipeline(response, limit, res, { signal: controller.signal }).catch((error) => {
      if (!controller.signal.aborted) throw error;
    });
  });
  app.use((error, _req, res, _next) => {
    void _next; // Express selects error middleware by its four-argument signature.
    if (res.headersSent) return res.destroy();
    // Do not leak upstream URLs, signed query strings, credentials or stack traces.
    const status = error instanceof RelayError ? error.status : error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 502;
    res.status(status).json({ error: error instanceof RelayError ? error.message : 'The private stream service could not complete this request.' });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createRelay(configuration());
  const port = Number(process.env.PORT || 4100);
  const host = process.env.HOST || '127.0.0.1';
  app.listen(port, host, () => console.log(`Private stream relay listening on ${host}:${port}`));
}
