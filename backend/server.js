import express from 'express';
import cors from 'cors';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { handleStreamRequest, handleProxyRequest, handleServersRequest } from './.build/stream-serverless.mjs';

// The complete in-memory RC4/futoken, AES-CBC and Embed.su base64/reversal
// loops are packaged in .build/stream-providers.mjs by npm run build.
// This is a historical VidLink AES key, not a guarantee that upstream still accepts it.
const LEGACY_VIDLINK_KEY = '2de6e6ea13a9df9503b11a6117fd7e51941e04a0c223dfeacfe8a1dbb6c52783';
const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };

export function configuration(env = process.env) {
  if (!/^[A-Za-z0-9_-]{32,512}$/.test(env.STREAM_RELAY_TOKEN || '')) throw new Error('Set STREAM_RELAY_TOKEN to a random secret of at least 32 URL-safe characters.');
  const publicUrl = env.STREAM_PUBLIC_URL || env.RENDER_EXTERNAL_URL;
  let origin;
  if (publicUrl) {
    const url = new URL(publicUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.port && url.port !== '443')) throw new Error('The public service URL must be an HTTPS origin.');
    origin = url.origin;
  } else if (env.NODE_ENV === 'production') throw new Error('RENDER_EXTERNAL_URL or STREAM_PUBLIC_URL is required in production.');
  return { token: env.STREAM_RELAY_TOKEN, origin, coreEnv: {
    ...env, AUTH_SECRET: env.STREAM_RELAY_TOKEN, STREAM_TICKET_SECRET: env.STREAM_TICKET_SECRET || env.STREAM_RELAY_TOKEN,
    // Prevent recursive delegation. Only the Vercel app sets RENDER_URL.
    RENDER_URL: '',
    STREAM_PROVIDER_ORDER: env.STREAM_PROVIDER_ORDER || 'miami,boise,orlando',
    STREAM_VIDLINK_KEY: env.STREAM_VIDLINK_KEY || LEGACY_VIDLINK_KEY,
  } };
}

function authorized(header, token) {
  const supplied = Buffer.from(header || ''), expected = Buffer.from(`Bearer ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** CORS is open as requested; playback still requires the private server bearer token. */
export function createApp(config, dependencies = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use((_req, res, next) => { res.set(RESPONSE_HEADERS); next(); });
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'horizon-streams', browserEngine: false }));
  let active = 0, resolving = 0;
  const starts = [];
  app.use((req, res, next) => {
    if (!authorized(req.get('authorization'), config.token)) return res.status(401).json({ error: 'Unauthorized stream service request.', code: 'UNAUTHORIZED' });
    if (active >= 24) return res.status(429).json({ error: 'The stream service is busy.', code: 'SERVICE_BUSY' });
    active++;
    res.once('close', () => active--);
    next();
  });
  app.use(express.json({ limit: '4kb', strict: true }));

  function route(core, resolution = false) {
    return async (req, res, next) => {
      if (resolution) {
        while (starts.length && starts[0] < Date.now() - 60000) starts.shift();
        if (resolving >= 4 || starts.length >= 12) return res.status(429).json({ error: 'The resolver is busy. Try again shortly.', code: 'SERVICE_BUSY' });
        resolving++; starts.push(Date.now());
      }
      const controller = new AbortController();
      res.once('close', () => { if (!res.writableFinished) controller.abort(); });
      try {
        // Render terminates TLS before Express. Use its documented external URL,
        // not a browser-controlled Host or X-Forwarded-Host header.
        const origin = config.origin || `http://127.0.0.1:${req.socket.localPort}`;
        const expiry = String(Math.floor(Date.now() / 1000) + 120);
        const cookie = `horizon_session=${expiry}.${createHmac('sha256', config.token).update(expiry).digest('base64url')}`;
        const headers = new Headers({ cookie, origin, host: new URL(origin).host });
        if (req.get('content-type')) headers.set('content-type', req.get('content-type'));
        if (req.get('range')) headers.set('range', req.get('range'));
        const options = { method: req.method, headers, signal: controller.signal };
        if (req.method === 'POST') options.body = JSON.stringify(req.body ?? null);
        const result = await core(new Request(new URL(req.originalUrl, origin), options), config.coreEnv, dependencies);
        res.status(result.status);
        result.headers.forEach((value, name) => res.setHeader(name, value));
        if (result.body) await pipeline(Readable.fromWeb(result.body), res, { signal: controller.signal });
        else res.end();
      } catch (error) {
        if (!controller.signal.aborted) next(error);
      } finally { if (resolution) resolving--; }
    };
  }
  app.get('/api/stream/servers', route(handleServersRequest));
  app.get('/api/stream', route(handleStreamRequest, true));
  app.post(['/api/stream', '/api/resolve-stream'], route(handleStreamRequest, true));
  app.get('/api/proxy-stream', route(handleProxyRequest));
  app.use((_req, res) => res.status(404).json({ error: 'Unknown stream service endpoint.', code: 'NOT_FOUND' }));
  app.use((error, _req, res, _next) => {
    void _next;
    if (res.headersSent) return res.destroy();
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    console.error(JSON.stringify({ event: 'horizon_backend_error', status, code: status === 500 ? 'SERVICE_ERROR' : 'INVALID_REQUEST' }));
    res.status(status).json({ error: status === 500 ? 'The stream service could not complete the request.' : 'Invalid playback request.', code: status === 500 ? 'SERVICE_ERROR' : 'INVALID_REQUEST' });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
  const server = createApp(configuration()).listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'horizon_backend_ready', port })));
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  function stop() {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 30000).unref();
  }
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
