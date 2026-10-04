// A standalone document keeps the playback CSP strict without weakening it for Next's runtime or trailers.
export const PLAYER_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'";

export const PLAYER_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${PLAYER_CSP.replace("; frame-ancestors 'none'", "")}">
<meta name="referrer" content="no-referrer"><title>Play · Horizon</title>
<link rel="stylesheet" href="/api/stream-player/assets/plyr.css"><link rel="stylesheet" href="/api/stream-player/assets/player.css?v=1">
<script defer src="/api/stream-player/assets/plyr.min.js"></script><script defer src="/api/stream-player/assets/hls.min.js"></script><script defer src="/api/stream-player/assets/player.js?v=1"></script>
</head><body><main><header><a id="back" href="/discover">← Details</a><span>Horizon</span></header>
<h1 id="title">Play</h1><div id="episode" hidden><label>Season <input id="season" type="number" min="0" max="1000" value="1"></label><label>Episode <input id="episode-number" type="number" min="1" max="10000" value="1"></label><button id="change-episode" type="button">Play episode</button></div>
<div class="player-shell"><video id="player" controls playsinline preload="metadata"></video></div>
<p id="status" role="status" aria-live="polite">Finding a stream…</p><button id="retry" type="button" hidden>Try again</button>
</main></body></html>`;

export const PLAYER_CSS = `:root{color-scheme:dark;font-family:Arial,Helvetica,sans-serif;--plyr-color-main:#fff;--plyr-video-control-color-hover:#15191c;--plyr-menu-color:#182027;--plyr-menu-background:#fff;--plyr-range-fill-background:#fff;--plyr-video-background:#080c10}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#203940,#0b1118 65%);color:#fff;min-height:100svh}main{max-width:1200px;margin:0 auto;padding:28px 24px 44px}header{display:flex;justify-content:space-between;align-items:center;color:#bac9ce;margin-bottom:28px}a{color:inherit;text-decoration:none}h1{font-size:clamp(22px,4vw,36px);letter-spacing:-.03em;margin:0 0 24px}.player-shell{overflow:hidden;border-radius:20px;background:#080c10;aspect-ratio:16/9;max-height:calc(100svh - 210px);min-height:180px;border:1px solid #ffffff20}video,.plyr{width:100%;height:100%}.plyr__video-wrapper{height:100%}video{object-fit:contain}.plyr__control--overlaid{background:#fff;color:#15191c}.plyr__control--overlaid:hover{background:#e5eef0;color:#15191c}#status{font-size:14px;color:#c0cdd1;line-height:1.6;overflow-wrap:anywhere}#episode{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:20px}[hidden],#episode[hidden]{display:none!important}label{font-size:13px;color:#bac9ce}input{width:68px;padding:8px;margin-left:6px;border:1px solid #ffffff30;border-radius:8px;background:#111b21;color:#fff}button{border:1px solid #ffffff30;border-radius:999px;padding:10px 18px;background:#ffffff0c;color:#fff;cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid white;outline-offset:4px}@media(max-width:640px){main{padding:20px 14px 30px}header{margin-bottom:22px}.player-shell{border-radius:12px}}`;

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
  function fail(message) { status.textContent = message; retry.hidden = false; }
  async function load() {
    const current = ++generation;
    controller?.abort();
    controller = new AbortController();
    hls?.destroy();
    hls = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    status.textContent = 'Finding a stream…';
    retry.hidden = true;
    try {
      const payload = { tmdbId, type };
      if (type === 'show') { payload.season = Number(season.value); payload.episode = Number(episode.value); }
      const response = await fetch('/api/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      const data = await response.json();
      if (current !== generation) return;
      if (!response.ok) throw new Error(data.error || 'This stream is unavailable.');
      const source = new URL(data.source, location.origin);
      if (source.origin !== location.origin || source.pathname !== '/api/proxy-stream') throw new Error('The resolver returned an invalid playback link.');
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false, maxBufferLength: 30, maxMaxBufferLength: 60 });
        hls.on(Hls.Events.ERROR, (_event, event) => { if (event.fatal) fail('Playback stopped. Try again to refresh the stream.'); });
        hls.on(Hls.Events.MANIFEST_PARSED, () => { status.textContent = 'Ready to play'; });
        hls.loadSource(source.href);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = source.href;
      else throw new Error('This browser does not support HLS playback.');
    } catch (error) { if (error.name !== 'AbortError' && current === generation) fail(error.message); }
  }
  video.addEventListener('loadedmetadata', () => { status.textContent = 'Ready to play'; });
  video.addEventListener('playing', () => { status.textContent = ''; retry.hidden = true; });
  retry.addEventListener('click', load);
  document.getElementById('change-episode').addEventListener('click', load);
  window.addEventListener('pagehide', () => { controller?.abort(); hls?.destroy(); player.destroy(); });
  void load();
})();`;
