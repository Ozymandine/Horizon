// A standalone document keeps the playback CSP strict without weakening it for Next's runtime or trailers.
export const PLAYER_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'";

export const PLAYER_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${PLAYER_CSP.replace("; frame-ancestors 'none'", "")}">
<meta name="referrer" content="no-referrer"><title>Play · Horizon</title>
<link rel="stylesheet" href="/api/stream-player/assets/plyr.css"><link rel="stylesheet" href="/api/stream-player/assets/player.css?v=2">
<script defer src="/api/stream-player/assets/plyr.min.js"></script><script defer src="/api/stream-player/assets/hls.min.js"></script><script defer src="/api/stream-player/assets/player.js?v=3"></script>
</head><body><main><header><a id="back" href="/discover">← Details</a><span>Horizon</span></header>
<h1 id="title">Play</h1><div class="playback-options"><label>Server <select id="server" aria-label="Playback server"><option value="auto">Automatic</option></select></label><div id="episode" hidden><label>Season <input id="season" type="number" min="0" max="1000" value="1"></label><label>Episode <input id="episode-number" type="number" min="1" max="10000" value="1"></label><button id="change-episode" type="button">Play episode</button></div></div>
<div class="player-shell"><video id="player" controls playsinline preload="metadata"></video></div>
<p id="status" role="status" aria-live="polite">Finding a stream…</p><button id="retry" type="button" hidden>Try again</button>
</main></body></html>`;

export const PLAYER_CSS = `:root{color-scheme:dark;font-family:Arial,Helvetica,sans-serif;--plyr-color-main:#fff;--plyr-video-control-color-hover:#15191c;--plyr-menu-color:#182027;--plyr-menu-background:#fff;--plyr-range-fill-background:#fff;--plyr-video-background:#080c10}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#203940,#0b1118 65%);color:#fff;min-height:100svh}main{max-width:1200px;margin:0 auto;padding:28px 24px 44px}header{display:flex;justify-content:space-between;align-items:center;color:#bac9ce;margin-bottom:28px}a{color:inherit;text-decoration:none}h1{font-size:clamp(22px,4vw,36px);letter-spacing:-.03em;margin:0 0 24px}.player-shell{overflow:hidden;border-radius:20px;background:#080c10;aspect-ratio:16/9;max-height:calc(100svh - 210px);min-height:180px;border:1px solid #ffffff20}video,.plyr{width:100%;height:100%}.plyr__video-wrapper{height:100%}video{object-fit:contain}.plyr__control--overlaid{background:#fff;color:#15191c}.plyr__control--overlaid:hover{background:#e5eef0;color:#15191c}#status{font-size:14px;color:#c0cdd1;line-height:1.6;overflow-wrap:anywhere}.playback-options,#episode{display:flex;flex-wrap:wrap;align-items:center;gap:12px}.playback-options{margin-bottom:20px}[hidden],#episode[hidden]{display:none!important}label{font-size:13px;color:#bac9ce}input,select{padding:8px;margin-left:6px;border:1px solid #ffffff30;border-radius:8px;background:#111b21;color:#fff}input{width:68px}select{min-width:140px}button{border:1px solid #ffffff30;border-radius:999px;padding:10px 18px;background:#ffffff0c;color:#fff;cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid white;outline-offset:4px}@media(max-width:640px){main{padding:20px 14px 30px}header{margin-bottom:22px}.player-shell{border-radius:12px}.playback-options{gap:16px}#episode{gap:10px}}`;

export const PLAYER_SCRIPT = String.raw`(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const title = document.getElementById('title');
  title.textContent = params.get('title') || 'Play';
  document.title = title.textContent + ' · Horizon';
  const type = params.get('type');
  const tmdbId = Number(params.get('tmdbId'));
  const back = params.get('returnTo');
  if (back && /^\/(movies|shows)\/\d+(?:\?|$)/.test(back)) document.getElementById('back').href = back;
  const video = document.getElementById('player');
  const status = document.getElementById('status');
  const retry = document.getElementById('retry');
  const season = document.getElementById('season');
  const episode = document.getElementById('episode-number');
  const server = document.getElementById('server');
  document.getElementById('episode').hidden = type !== 'show';
  const player = new Plyr(video, {
    iconUrl: '/api/stream-player/assets/plyr.svg', loadSprite: false,
    storage: { enabled: false }, ads: { enabled: false }, autoplay: false,
    controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'],
    settings: ['speed'], ratio: '16:9',
  });
  let hls;
  let controller;
  let generation = 0;
  let seekHandler;
  let savedPosition = 0;
  let disposed = false;
  const discoveryController = new AbortController();
  function fail(message) { status.textContent = message; retry.hidden = false; }
  // The authenticated website API reads process.env.RENDER_URL server-side.
  // Keep the relay credential out of browser code and every HLS request on this origin.
  async function resolveSource(payload, signal) {
    const response = await fetch('/api/stream', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal,
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The playback service is unavailable. Try again shortly.'); }
    if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'This stream is unavailable.');
    if (!data || Object.keys(data).length !== 1 || typeof data.source !== 'string') throw new Error('The resolver returned an invalid playback link.');
    const source = new URL(data.source, location.origin);
    if (source.origin !== location.origin || source.pathname !== '/api/proxy-stream' || source.hash || source.username || source.password || [...source.searchParams.keys()].length !== 1 || !/^[A-Za-z0-9_-]{1,12000}$/.test(source.searchParams.get('token') || '')) throw new Error('The resolver returned an invalid playback link.');
    return source;
  }
  async function load(resume = false) {
    const current = ++generation;
    if (!resume) savedPosition = 0;
    else if (video.readyState >= 1 && Number.isFinite(video.currentTime)) savedPosition = video.currentTime;
    // Preserve the last position even if a failed switch has already cleared src.
    const position = savedPosition;
    controller?.abort();
    controller = new AbortController();
    hls?.destroy();
    hls = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (seekHandler) video.removeEventListener('loadedmetadata', seekHandler);
    seekHandler = null;
    status.textContent = 'Finding a stream…';
    retry.hidden = true;
    try {
      const payload = { tmdbId, type };
      if (server.value && server.value !== 'auto') payload.server = server.value;
      if (type === 'show') { payload.season = Number(season.value); payload.episode = Number(episode.value); }
      const source = await resolveSource(payload, controller.signal);
      if (current !== generation) return;
      seekHandler = () => {
        if (current !== generation) return;
        if (position > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(position, Math.max(0, video.duration - 1));
        // Browsers can require a second tap after navigating from the details page.
        void Promise.resolve(video.play()).catch(() => { if (current === generation) status.textContent = 'Ready to play'; });
      };
      video.addEventListener('loadedmetadata', seekHandler, { once: true });
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false, startPosition: position > 0 ? position : -1, maxBufferLength: 30, maxMaxBufferLength: 60 });
        hls.on(Hls.Events.ERROR, (_event, event) => { if (current === generation && event.fatal) fail('Playback stopped. Try another server or refresh the stream.'); });
        hls.on(Hls.Events.MANIFEST_PARSED, () => { if (current === generation) status.textContent = 'Ready to play'; });
        hls.loadSource(source.href);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = source.href;
      else throw new Error('This browser does not support HLS playback.');
    } catch (error) { if (error.name !== 'AbortError' && current === generation) fail(error.message); }
  }
  video.addEventListener('loadedmetadata', () => { status.textContent = 'Ready to play'; });
  video.addEventListener('playing', () => { status.textContent = ''; retry.hidden = true; });
  retry.addEventListener('click', () => load(true));
  server.addEventListener('change', () => load(true));
  document.getElementById('change-episode').addEventListener('click', () => load(false));
  window.addEventListener('pagehide', () => { disposed = true; generation++; discoveryController.abort(); controller?.abort(); hls?.destroy(); player.destroy(); });
  // Load the configured server list as data, never provider HTML or scripts.
  async function start() {
    server.disabled = true;
    const discoveryTimeout = setTimeout(() => discoveryController.abort(), 10000);
    try {
      const response = await fetch('/api/stream/servers', { credentials: 'same-origin', cache: 'no-store', signal: discoveryController.signal });
      const data = await response.json();
      if (response.ok && Array.isArray(data.servers) && data.servers.length <= 32) {
        for (const item of data.servers) {
          if (!/^[a-z]{2,16}$/.test(item?.id || '') || typeof item.name !== 'string' || item.name.length > 40) continue;
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.name;
          server.appendChild(option);
        }
      }
    } catch { /* Automatic playback can still work if server discovery fails. */ }
    finally { clearTimeout(discoveryTimeout); server.disabled = false; }
    if (!disposed) await load();
  }
  void start();
})();`;
