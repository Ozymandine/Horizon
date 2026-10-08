// Pure browser helpers are also exercised with synthetic pixels and progress in Node tests.
// The native player loads this as a local, external script under its strict CSP.
export const PLAYER_CORE_SCRIPT = String.raw`(() => {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const hours = Math.floor(value / 3600), minutes = Math.floor(value / 60) % 60, rest = value % 60;
    return (hours ? hours + ':' + String(minutes).padStart(2, '0') : String(minutes).padStart(2, '0')) + ':' + String(rest).padStart(2, '0');
  }
  function fillScale(width, height, viewportWidth, viewportHeight, bounds = { width: 1, height: 1 }) {
    if (![width, height, viewportWidth, viewportHeight, bounds.width, bounds.height].every((v) => Number.isFinite(v) && v > 0)) return 1;
    const scale = Math.min(viewportWidth / width, viewportHeight / height);
    return clamp(Math.max(viewportWidth / (width * scale * bounds.width), viewportHeight / (height * scale * bounds.height)), 1, 3);
  }
  function blackBarBounds(pixels, width, height) {
    if (!pixels || pixels.length !== width * height * 4 || width < 8 || height < 8) return null;
    const dark = (x, y) => { const i = (y * width + x) * 4; return pixels[i] < 18 && pixels[i + 1] < 18 && pixels[i + 2] < 18; };
    // A dark fade/scene cannot establish a crop. Require a visibly lit central area.
    let light = 0, count = 0;
    for (let y = Math.floor(height / 3); y < height * 2 / 3; y++) for (let x = Math.floor(width / 3); x < width * 2 / 3; x++) { count++; if (!dark(x, y)) light++; }
    if (light / count < .35) return null;
    const row = (y) => { let n = 0; for (let x = 0; x < width; x++) if (dark(x, y)) n++; return n / width >= .97; };
    const column = (x) => { let n = 0; for (let y = 0; y < height; y++) if (dark(x, y)) n++; return n / height >= .97; };
    let top = 0, bottom = 0, left = 0, right = 0;
    while (top < height * .25 && row(top)) top++;
    while (bottom < height * .25 && row(height - 1 - bottom)) bottom++;
    while (left < width * .25 && column(left)) left++;
    while (right < width * .25 && column(width - 1 - right)) right++;
    // Only balanced, continuous edge bands count; never chase scene composition.
    const vertical = top >= 2 && bottom >= 2 && Math.abs(top - bottom) <= 2 ? Math.min(top, bottom) : 0;
    const horizontal = left >= 2 && right >= 2 && Math.abs(left - right) <= 2 ? Math.min(left, right) : 0;
    return { width: 1 - horizontal * 2 / width, height: 1 - vertical * 2 / height };
  }
  function settings(value) {
    const data = value && typeof value === 'object' ? value : {};
    const bound = (v, fallback, min, max) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback;
    return { fit: ['fit', 'fill', 'auto'].includes(data.fit) ? data.fit : 'fit', zoom: bound(data.zoom, 1, 1, 2.5), volume: bound(data.volume, 1, 0, 1), muted: data.muted === true, speed: bound(data.speed, 1, .5, 2), subtitleSize: bound(data.subtitleSize, 100, 75, 175) };
  }
  function progressKey(type, id, season, episode) { return type === 'show' ? 'show:' + id + ':' + season + ':' + episode : 'movie:' + id; }
  function progress(value) {
    if (!value || !['movie', 'show'].includes(value.type) || !Number.isSafeInteger(value.tmdbId) || value.tmdbId < 1 || !Number.isFinite(value.position) || value.position < 0 || !Number.isFinite(value.duration) || value.duration <= 0 || value.position > value.duration + 2) return null;
    if (value.type === 'show' && (!Number.isSafeInteger(value.season) || value.season < 0 || !Number.isSafeInteger(value.episode) || value.episode < 1)) return null;
    return value;
  }
  window.HorizonPlayerCore = Object.freeze({ clamp, formatTime, fillScale, blackBarBounds, settings, progressKey, progress });
})();`;
