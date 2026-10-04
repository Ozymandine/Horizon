import { allowedUrl, RelayError } from './security.mjs';

const allowedTags = new Set(['EXTM3U', 'EXTINF', 'EXT-X-VERSION', 'EXT-X-TARGETDURATION', 'EXT-X-MEDIA-SEQUENCE', 'EXT-X-DISCONTINUITY-SEQUENCE', 'EXT-X-ENDLIST', 'EXT-X-PLAYLIST-TYPE', 'EXT-X-I-FRAMES-ONLY', 'EXT-X-INDEPENDENT-SEGMENTS', 'EXT-X-DISCONTINUITY', 'EXT-X-BYTERANGE', 'EXT-X-START', 'EXT-X-GAP', 'EXT-X-STREAM-INF', 'EXT-X-I-FRAME-STREAM-INF', 'EXT-X-MEDIA', 'EXT-X-MAP', 'EXT-X-KEY', 'EXT-X-SESSION-KEY', 'EXT-X-PART', 'EXT-X-PART-INF', 'EXT-X-SERVER-CONTROL', 'EXT-X-PRELOAD-HINT', 'EXT-X-RENDITION-REPORT']);

/** Rewrite variants, audio, subtitles, init segments, AES keys and ordinary segments to the same origin. */
export function rewriteManifest(text, base, hosts, issue) {
  if (!text.trimStart().startsWith('#EXTM3U')) throw new RelayError('Provider did not return an HLS playlist.');
  let variant = false;
  const output = [];
  const relay = (value, kind) => {
    const url = allowedUrl(new URL(value, base).href, hosts).href;
    return `/api/proxy-stream?token=${issue({ url, kind })}`;
  };
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes('{$') || line.startsWith('#EXT-X-DEFINE:')) throw new RelayError('HLS variable substitution is unsupported.');
    if (!line.startsWith('#')) {
      output.push(relay(line, variant || /\.m3u8(?:\?|$)/i.test(line) ? 'manifest' : 'media'));
      variant = false;
      continue;
    }
    const tag = line.slice(1).split(':')[0];
    // Drop session data, date-range beacons and arbitrary metadata. Never deliver HTML or scripts.
    if (!allowedTags.has(tag)) continue;
    if (/EXT-X-(?:SESSION-)?KEY/.test(tag) && !/METHOD=(?:AES-128|NONE)(?:,|$)/.test(line)) throw new RelayError('This stream uses unsupported media encryption.');
    const kind = /KEY$/.test(tag) ? 'key' : ['EXT-X-MEDIA', 'EXT-X-I-FRAME-STREAM-INF', 'EXT-X-RENDITION-REPORT'].includes(tag) ? 'manifest' : 'media';
    const rewritten = line.replace(/\bURI="([^"]+)"/g, (_match, uri) => `URI="${relay(uri, kind)}"`);
    // Unknown URL-bearing attributes cannot slip an external request through.
    if (/https?:\/\//i.test(rewritten)) throw new RelayError('Unsupported external playlist metadata.');
    output.push(rewritten);
    if (tag === 'EXT-X-STREAM-INF') variant = true;
  }
  return `${output.join('\n')}\n`;
}

/** Data-only fallback for clear JSON/HTML and bounded base64 wrappers; never eval provider scripts here. */
export function playlistCandidates(text) {
  const candidates = new Set();
  const visited = new Set();
  function inspect(value, depth = 0) {
    if (depth > 5 || typeof value !== 'string' || value.length > 2_000_000 || visited.has(value)) return;
    visited.add(value);
    const normalized = value.replace(/\\\//g, '/').replace(/&amp;/g, '&').replace(/\\u0026/gi, '&');
    for (const match of normalized.matchAll(/https:\/\/[^\s"'<>\\]+\.m3u8(?:\?[^\s"'<>\\]*)?/gi)) candidates.add(match[0]);
    try { walk(JSON.parse(normalized), depth + 1); } catch { /* HTML is also supported as data. */ }
    for (const match of normalized.matchAll(/(?:atob\s*\(|["'](?:file|src|url|source|playlist)["']\s*:\s*)["']([A-Za-z0-9+/=_-]{20,100000})["']/g)) inspect(Buffer.from(match[1], 'base64').toString(), depth + 1);
  }
  function walk(value, depth) {
    if (depth > 5) return;
    if (typeof value === 'string') inspect(value, depth);
    else if (Array.isArray(value)) value.slice(0, 100).forEach((item) => walk(item, depth + 1));
    else if (value && typeof value === 'object') Object.values(value).slice(0, 100).forEach((item) => walk(item, depth + 1));
  }
  inspect(text);
  return [...candidates].slice(0, 30);
}
