import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import ipaddr from 'ipaddr.js';
import { createGunzip, createBrotliDecompress, createInflate } from 'node:zlib';

export class RelayError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export function publicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}

export function allowedUrl(input, hosts) {
  let url;
  try { url = new URL(input); } catch { throw new RelayError('Invalid provider URL.', 400); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !hosts.has(url.hostname)) {
    throw new RelayError('Provider host is not allowed.', 502);
  }
  url.hash = '';
  return url;
}

/** Validate every DNS answer and pin the socket: rechecking a URL alone leaves DNS rebinding open. */
export async function pinnedAddress(url, hosts, resolve = lookup) {
  allowedUrl(url, hosts);
  const answers = await resolve(url.hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some(({ address }) => !publicAddress(address))) throw new RelayError('Provider resolved to a non-public address.');
  return answers[0];
}

export function validRange(value) {
  if (!value) return undefined;
  if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(value) || value.length > 70) throw new RelayError('Invalid byte range.', 416);
  const [start, end] = value.slice(6).split('-');
  if (start && end && BigInt(start) > BigInt(end)) throw new RelayError('Invalid byte range.', 416);
  return value;
}

/** Only selected headers leave the server. Browser cookies, IP, authorization and telemetry never do. */
export async function upstream(input, config, { range, signal, method = 'GET', body, contentType } = {}, redirects = 0) {
  const url = allowedUrl(input, config.hosts);
  const address = await pinnedAddress(url, config.hosts);
  if (signal?.aborted) throw new RelayError('Request cancelled.', 499);
  const headers = { 'user-agent': config.userAgent, accept: '*/*', 'accept-encoding': 'identity' };
  if (config.referer) headers.referer = config.referer;
  if (range) headers.range = validRange(range);
  if (body) {
    const suppliedType = (contentType || '').split(';')[0];
    headers['content-type'] = ['application/json', 'application/x-www-form-urlencoded', 'text/plain'].includes(suppliedType) ? suppliedType : 'application/x-www-form-urlencoded';
  }
  const response = await new Promise((resolve, reject) => {
    const req = request(url, {
      method, headers, signal,
      lookup: (_host, options, cb) => options.all ? cb(null, [address]) : cb(null, address.address, address.family),
    }, resolve);
    req.setTimeout(20_000, () => req.destroy(new RelayError('Provider timed out.')));
    req.on('error', reject);
    req.end(body);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    response.resume();
    if (redirects >= 3 || !response.headers.location) throw new RelayError('Provider redirected too many times.');
    return upstream(new URL(response.headers.location, url).href, config, { range, signal, contentType, method: response.statusCode === 303 ? 'GET' : method, body: response.statusCode === 303 ? undefined : body }, redirects + 1);
  }
  return { response, url: url.href };
}

export async function boundedBody(response, maximum = 2 * 1024 * 1024) {
  const encoding = response.headers?.['content-encoding'];
  let source = response;
  if (encoding && encoding !== 'identity') {
    const decode = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null;
    if (!decode) { response.destroy(); throw new RelayError('Unsupported provider response encoding.'); }
    response.on('error', (error) => decode.destroy(error));
    source = response.pipe(decode);
  }
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of source) {
      size += chunk.length;
      if (size > maximum) throw new RelayError('Provider response is too large.');
      chunks.push(chunk);
    }
  } catch (error) { response.destroy(); source.destroy(); throw error; }
  return Buffer.concat(chunks);
}

/** Encrypted capabilities hide CDN URLs and expire; the relay never accepts arbitrary browser URLs. */
export function ticketCodec(secret, now = () => Date.now(), lifetimeMs = 2 * 60 * 60 * 1000) {
  const key = createHash('sha256').update(secret).digest();
  return {
    encode(resource) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify({ ...resource, expires: now() + lifetimeMs })), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
    },
    decode(token) {
      try {
        if (typeof token !== 'string' || token.length > 12000) throw new Error();
        const raw = Buffer.from(token, 'base64url');
        const cipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
        cipher.setAuthTag(raw.subarray(12, 28));
        const resource = JSON.parse(Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString());
        if (!Number.isSafeInteger(resource.expires) || resource.expires < now() || typeof resource.url !== 'string' || !['manifest', 'media', 'key'].includes(resource.kind)) throw new Error();
        return resource;
      } catch { throw new RelayError('This playback link expired or is invalid. Open Play again.', 403); }
    },
  };
}
