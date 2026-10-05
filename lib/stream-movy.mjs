import { StreamError } from './stream-errors.mjs';

const MAX_ENCODED = 1400000;
const invalid = () => new StreamError('The provider returned an invalid encoded source response.', 422, 'NO_HLS_SOURCE');

function mix32(value) {
  value >>>= 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}
function rotate32(value, shift) {
  value >>>= 0;
  shift &= 31;
  return shift === 0 ? value : ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

/** Decode the public mvm1 data protocol using bytes and 32-bit arithmetic.
 * Reference and live checks: docs/STREAM-PROVIDER-RESEARCH.md.
 * No downloaded JavaScript, VM, browser engine or external crypto service runs.
 */
export function decodeMovySources(encoded, seed, mediaId) {
  if (typeof encoded !== 'string' || encoded.length < 8 || encoded.length > MAX_ENCODED || !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)
    || typeof seed !== 'string' || seed.length < 1 || seed.length > 512 || !Number.isSafeInteger(mediaId) || mediaId < 1) throw invalid();
  const bytes = Buffer.from(encoded, 'base64url');
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 0x1000193) >>> 0;
  const state = new Array(61);
  let value = mix32(mix32(hash) ^ mix32((mediaId >>> 0) ^ 0x9e3779b9));
  for (let index = 0; index < 8; index++) {
    const slot = value % 61;
    value = rotate32((value + 0x9e3779b9) >>> 0, 7 + (index & 7));
    state[slot] = (value ^ mix32(value)) >>> 0;
    value = mix32((value + slot) >>> 0);
  }
  let accumulator = mix32(0xa5a5a5a5 ^ value);
  for (let offset = 0, wordIndex = 0; offset < bytes.length; wordIndex++) {
    const slot = accumulator % 61;
    const mask = -Number(slot in state);
    const word = ((state[slot] >>> 0) ^ (Math.imul(0x9e3779b9, wordIndex + 1) >>> 0)) >>> 0;
    let combined = (((accumulator ^ word) >>> 0) | ((accumulator & word & mask) >>> 0)) >>> 0;
    combined = (rotate32((combined + accumulator) >>> 0, slot & 31) ^ rotate32(accumulator, Math.imul(slot, 7) & 31)) >>> 0;
    accumulator = mix32((combined + 0x9e3779b9) >>> 0);
    state[slot] = accumulator;
    for (let index = 0; index < 4 && offset < bytes.length; index++, offset++) bytes[offset] ^= (accumulator >>> (index * 8)) & 255;
  }
  if (!bytes.subarray(0, 4).equals(Buffer.from('mvm1'))) throw invalid();
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(4))); } catch { throw invalid(); }
  if (!data || !Array.isArray(data.sources) || data.sources.length > 32) throw invalid();
  return data;
}

/** Prefer 1080p, then 720p/480p, then larger sources. URLs still pass relay validation. */
export function movyCandidates(data) {
  const priority = [1080, 720, 480, 2160];
  return [...new Set(data.sources.filter((source) => typeof source?.url === 'string' && source.url.length <= 24000 && /^https:\/\/[^\s]+\.m3u8(?:\?[^\s]*)?$/i.test(source.url))
    .sort((a, b) => {
      const rank = (source) => { const index = priority.indexOf(Number.parseInt(source.quality, 10)); return index < 0 ? priority.length : index; };
      return rank(a) - rank(b);
    }).map((source) => source.url))].slice(0, 6);
}
