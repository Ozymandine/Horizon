import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { allowedUrl, upstream, boundedBody, RelayError } from './security.mjs';
import { playlistCandidates } from './hls.mjs';

export function playbackRequest(payload) {
  if (!payload || !['movie', 'show'].includes(payload.type) || !Number.isSafeInteger(payload.tmdbId) || payload.tmdbId < 1) throw new RelayError('A valid movie/show TMDB ID is required.', 400);
  if (payload.type === 'show' && (!Number.isSafeInteger(payload.season) || payload.season < 0 || payload.season > 1000 || !Number.isSafeInteger(payload.episode) || payload.episode < 1 || payload.episode > 10000)) throw new RelayError('A valid season and episode are required.', 400);
  return { type: payload.type, tmdbId: payload.tmdbId, season: payload.season, episode: payload.episode };
}

export function providerEndpoint(payload, config) {
  const template = payload.type === 'movie' ? config.movieTemplate : config.showTemplate;
  return allowedUrl(template.replace(/\{(tmdbId|season|episode)\}/g, (_match, key) => String(payload[key])), config.hosts).href;
}

/** Chromium has no network, no mounted host filesystem, and no dashboard credentials. */
export async function browserResolve(url, config, signal) {
  if (!config.browserImage) throw new RelayError('This provider needs the isolated resolver worker. Configure STREAM_BROWSER_IMAGE on the self-hosted relay.', 503);
  return new Promise((resolve, reject) => {
    const containerName = `horizon-resolver-${randomUUID()}`;
    const child = spawn('docker', ['run', '--name', containerName, '--rm', '--init', '--interactive', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${config.seccompPath}`, '--memory', '1g', '--cpus', '1', '--pids-limit', '256', '--shm-size', '256m', '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m', '--user', '1000:1000', config.browserImage], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let completed = false;
    let requests = 0;
    let bytes = 0;
    let active = 0;
    const blocked = new Set();
    const controller = new AbortController();
    const finish = (error, source) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.abort();
      child.stdin.end();
      child.kill();
      // Killing the Docker client alone can leave its container running.
      const cleanup = spawn('docker', ['rm', '--force', containerName], { stdio: 'ignore', windowsHide: true });
      cleanup.on('error', () => {});
      if (error) reject(error); else resolve(source);
    };
    const abort = () => finish(new RelayError('Playback request cancelled.', 499));
    const timer = setTimeout(() => finish(new RelayError('The provider resolver timed out.')), 45_000);
    signal?.addEventListener('abort', abort, { once: true });
    child.on('error', () => finish(new RelayError('Docker is unavailable. Start the isolated resolver worker on the relay host.', 503)));
    child.stdin.on('error', () => {});
    child.stderr.resume(); // Chromium diagnostic output must not reveal signed source URLs.
    child.on('exit', () => finish(new RelayError(`The isolated resolver could not find a stream.${blocked.size ? ` Review the configured provider allowlist (${[...blocked].join(', ')}).` : ''}`)));
    const lines = createInterface({ input: child.stdout });
    lines.on('line', async (line) => {
      if (completed) return;
      try {
        if (line.length > 100_000) throw new RelayError('Resolver message exceeded its limit.');
        const message = JSON.parse(line);
        if (message.found) {
          const source = allowedUrl(message.found, config.hosts).href;
          return finish(null, source);
        }
        if (message.error) return finish(new RelayError(message.error));
        if (!Number.isInteger(message.id) || ++requests > 250 || active >= 12 || bytes > 32 * 1024 * 1024 || !['GET', 'POST'].includes(message.method) || (message.body?.length ?? 0) > 65536) throw new RelayError('Resolver request budget exceeded.');
        active++;
        try {
          try { allowedUrl(message.url, config.hosts); } catch { try { blocked.add(new URL(message.url).hostname); } catch {} throw new RelayError('Blocked resolver host.'); }
          const { response } = await upstream(message.url, config, { signal: controller.signal, method: message.method, body: message.body, contentType: message.contentType });
          const body = await boundedBody(response, 3 * 1024 * 1024);
          bytes += body.length;
          if (!completed) child.stdin.write(`${JSON.stringify({ id: message.id, status: response.statusCode, headers: { 'content-type': response.headers['content-type'] || 'application/octet-stream', 'access-control-allow-origin': '*' }, body: body.toString('base64') })}\n`);
        } catch {
          if (!completed) child.stdin.write(`${JSON.stringify({ id: message.id, error: true })}\n`);
        } finally { active--; }
      } catch (error) { finish(error instanceof RelayError ? error : new RelayError('Invalid resolver response.')); }
    });
    child.stdin.write(`${JSON.stringify({ job: { url, userAgent: config.userAgent } })}\n`);
  });
}

export async function resolvePlaylist(payload, config, signal) {
  const endpoint = providerEndpoint(playbackRequest(payload), config);
  const { response } = await upstream(endpoint, config, { signal });
  if (response.statusCode !== 200) { response.resume(); throw new RelayError('This title is unavailable from the configured provider.', 404); }
  const body = (await boundedBody(response)).toString();
  for (const candidate of playlistCandidates(body)) {
    try { return allowedUrl(candidate, config.hosts).href; } catch { /* Only configured CDNs can be relayed. */ }
  }
  return browserResolve(endpoint, config, signal);
}
