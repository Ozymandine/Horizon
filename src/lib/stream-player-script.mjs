// Browser source served as an external local asset; no inline script or eval is needed.
export const PLAYER_SCRIPT = String.raw`(() => {
  'use strict';
  const core = window.HorizonPlayerCore, el = (id) => document.getElementById(id);
  const page = el('player-page'), video = el('player'), status = el('status'), retry = el('retry');
  const params = new URLSearchParams(location.search), type = params.get('type'), tmdbId = Number(params.get('tmdbId'));
  const valid = ['movie', 'show'].includes(type) && Number.isSafeInteger(tmdbId) && tmdbId > 0;
  let title = params.get('title') || 'Play', catalog = null;
  let currentSeason = Number(params.get('season') || 1), currentEpisode = Number(params.get('episode') || 1);
  const explicitEpisode = params.has('season') || params.has('episode');
  if (!Number.isSafeInteger(currentSeason) || currentSeason < 0) currentSeason = 1;
  if (!Number.isSafeInteger(currentEpisode) || currentEpisode < 1) currentEpisode = 1;
  const back = params.get('returnTo');
  if (back && /^\/(movies|shows)\/\d+(?:\?|$)/.test(back)) el('back').href = back;
  else if (valid) el('back').href = '/' + (type === 'show' ? 'shows' : 'movies') + '/' + tmdbId;
  el('title').textContent = el('info-title').textContent = title; document.title = title + ' · Horizon';
  el('episodes-button').hidden = type !== 'show';
  const SETTINGS_KEY = 'horizon:player:preferences:v1', HISTORY_KEY = 'horizon:playback:v1';
  const stored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; } };
  const store = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Safe defaults remain usable. */ } };
  let preferences = core.settings(stored(SETTINGS_KEY, {}));
  let hls = null, controller, generation = 0, disposed = false, pendingSeek = null, savedPosition = 0, lastDuration = 0, loading = true;
  let playbackId = crypto.randomUUID(), sessionStartedAt = Date.now(), sequence = 0, restartRequested = params.get('restart') === '1';
  let servers = [], serversReady = Promise.resolve(), activeServer = '', selectedServer = 'auto', failedServers = new Set(), idleTimer, stallTimer, metadataTimer, sleepTimer, noticeTimer;
  let cropBounds = { width: 1, height: 1 }, cropCandidate = '', cropSamples = 0, localSubtitleUrl = null, localTrack = null;
  let episodeController, episodeGeneration = 0;
  const lifetime = new AbortController();
  const iconPaths = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m7 4 14 8-14 8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
  };
  function showChrome() {
    page.classList.remove('idle'); clearTimeout(idleTimer);
    if (!video.paused && !loading && !document.querySelector('.panel:not([hidden])')) idleTimer = setTimeout(() => {
      const focused = document.activeElement; if (!video.paused && !(page.contains(focused) && focused?.matches(':focus-visible'))) page.classList.add('idle');
    }, 2800);
  }
  function inform(message, permanent = false) {
    clearTimeout(noticeTimer); status.textContent = message;
    if (!permanent) noticeTimer = setTimeout(() => { if (!loading && retry.hidden) status.textContent = ''; }, 4500);
  }
  function fail(message) { loading = false; page.dataset.state = 'paused'; inform(message, true); retry.hidden = false; showChrome(); }
  function reflectPlayback() {
    const playing = !video.paused && !video.ended;
    page.dataset.state = loading ? 'loading' : playing ? 'playing' : 'paused';
    // This markup is static and owned by Horizon. All API data uses textContent.
    el('play').innerHTML = iconPaths[playing ? 'pause' : 'play']; el('play').setAttribute('aria-label', playing ? 'Pause' : 'Play'); el('play').title = playing ? 'Pause' : 'Play'; showChrome();
  }
  function positionUi() {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : lastDuration;
    const position = !loading && video.readyState >= 1 ? video.currentTime : savedPosition;
    el('time').textContent = core.formatTime(position) + ' / ' + core.formatTime(duration);
    el('seek').disabled = loading || !duration; el('seek').max = String(duration || 1);
    if (document.activeElement !== el('seek')) el('seek').value = String(position);
    if (!loading && video.readyState >= 1) { savedPosition = video.currentTime; lastDuration = duration; }
  }
  function progressKey(season = currentSeason, episode = currentEpisode) { return core.progressKey(type, tmdbId, season, episode); }
  function historyMap() { const value = stored(HISTORY_KEY, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function localProgress(exact = explicitEpisode) {
    const records = Object.values(historyMap()).map(core.progress).filter((record) => record && record.type === type && record.tmdbId === tmdbId && (!exact || type !== 'show' || (record.season === currentSeason && record.episode === currentEpisode)));
    records.sort((a, b) => (Date.parse(b.updatedAt) || b.recordedAt || 0) - (Date.parse(a.updatedAt) || a.recordedAt || 0)); return records[0] || null;
  }
  function useProgress(record, exact = explicitEpisode) {
    if (!record || restartRequested) return;
    if (type === 'show' && !exact) { currentSeason = record.season; currentEpisode = record.episode; }
    if (!record.completed) { savedPosition = record.position; lastDuration = record.duration; }
  }
  function saveProgress(beacon = false) {
    if (loading || !valid || video.readyState < 1 || !Number.isFinite(video.duration) || video.duration <= 0 || !Number.isFinite(video.currentTime)) return;
    const position = Math.max(0, Math.min(video.currentTime, video.duration)), duration = video.duration;
    const recordedAt = Date.now(), completed = video.ended || (duration >= 60 && duration - position <= Math.min(90, duration * .04));
    const record = { key: progressKey(), type, tmdbId, position, duration, season: type === 'show' ? currentSeason : undefined, episode: type === 'show' ? currentEpisode : undefined,
      title, posterUrl: catalog?.posterUrl || null, backdropUrl: catalog?.backdropUrl || null, playbackId, sessionStartedAt, recordedAt, sequence: ++sequence, restart: restartRequested, completed, updatedAt: new Date(recordedAt).toISOString() };
    const map = historyMap();
    const previous = Object.values(map).filter((item) => item?.type === type && item.tmdbId === tmdbId && Number.isFinite(item.sessionStartedAt)).sort((a, b) => b.sessionStartedAt - a.sessionStartedAt || b.sequence - a.sequence)[0];
    if (previous && !(record.sessionStartedAt > previous.sessionStartedAt || (record.sessionStartedAt === previous.sessionStartedAt && record.playbackId === previous.playbackId && record.sequence > previous.sequence && record.recordedAt >= previous.recordedAt))) return;
    map[record.key] = record;
    const latest = Object.entries(map).sort((a, b) => (Date.parse(b[1]?.updatedAt) || 0) - (Date.parse(a[1]?.updatedAt) || 0)).slice(0, 200); store(HISTORY_KEY, Object.fromEntries(latest));
    const body = JSON.stringify(record); restartRequested = false;
    if (beacon && navigator.sendBeacon && navigator.sendBeacon('/api/playback/progress', new Blob([body], { type: 'application/json' }))) return;
    void fetch('/api/playback/progress', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body, keepalive: beacon, signal: beacon ? undefined : lifetime.signal }).catch(() => { /* Local resume remains available offline. */ });
  }
  function newPlaybackSession() { playbackId = crypto.randomUUID(); sessionStartedAt = Date.now(); sequence = 0; }
  async function jsonGet(path, timeout = 6000, signal = lifetime.signal) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]) });
    if (!response.ok) throw new Error('Metadata is unavailable.'); return response.json();
  }
  function metadataUi() {
    if (!catalog) return; title = catalog.title || title;
    el('title').textContent = el('info-title').textContent = title; document.title = title + ' · Horizon'; el('overview').textContent = catalog.overview || '';
    el('film-meta').replaceChildren();
    for (const value of [catalog.year, catalog.runtime ? (Math.floor(catalog.runtime / 60) ? Math.floor(catalog.runtime / 60) + 'h ' : '') + catalog.runtime % 60 + 'm' : '', catalog.rating ? '★ ' + catalog.rating.toFixed(1) : '', catalog.certification]) {
      if (!value) continue; const span = document.createElement('span'); span.textContent = value; el('film-meta').appendChild(span);
    }
    const trustedImage = (value) => typeof value === 'string' && /^https:\/\/image\.tmdb\.org\/t\/p\//.test(value);
    if (trustedImage(catalog.logoUrl)) { el('title-logo').src = catalog.logoUrl; el('title-logo').hidden = false; el('info-title').hidden = true; }
    if (trustedImage(catalog.backdropUrl)) { el('backdrop').src = catalog.backdropUrl; el('backdrop').hidden = false; }
    if (type === 'show' && Array.isArray(catalog.seasons)) {
      el('season').replaceChildren(); for (const season of catalog.seasons) { const option = document.createElement('option'); option.value = String(season.season); option.textContent = season.name; el('season').appendChild(option); }
      el('season').value = String(currentSeason);
    }
  }
  function closePanels() { for (const panel of document.querySelectorAll('.panel')) panel.hidden = true; for (const button of document.querySelectorAll('[aria-controls]')) button.setAttribute('aria-expanded', 'false'); showChrome(); }
  function openPanel(id, button) {
    const wasOpen = !el(id).hidden; closePanels(); if (wasOpen) return;
    el(id).hidden = false; button.setAttribute('aria-expanded', 'true'); showChrome(); el(id).querySelector('select,button,input')?.focus();
    if (id === 'episodes-panel') void showEpisodes(Number(el('season').value || currentSeason));
  }
  for (const [button, panel] of [['servers-button', 'servers-panel'], ['subtitles-button', 'subtitles-panel'], ['settings-button', 'settings-panel'], ['episodes-button', 'episodes-panel']]) el(button).addEventListener('click', () => openPanel(panel, el(button)));
  for (const button of document.querySelectorAll('.panel-close')) button.addEventListener('click', () => { const id = button.closest('.panel').id; closePanels(); document.querySelector('[aria-controls="' + id + '"]')?.focus(); });
  async function showEpisodes(season) {
    const current = ++episodeGeneration; episodeController?.abort(); episodeController = new AbortController();
    el('season').value = String(season); el('episodes-status').textContent = 'Loading episodes…'; el('episode-list').replaceChildren();
    try {
      const data = await jsonGet('/api/playback/episodes?' + new URLSearchParams({ tmdbId: String(tmdbId), season: String(season) }), 8000, episodeController.signal);
      if (current !== episodeGeneration || disposed) return;
      const episodes = Array.isArray(data.episodes) ? data.episodes : []; el('episodes-status').textContent = episodes.length ? '' : 'Episodes are not available for this season yet.';
      const records = historyMap();
      for (const episode of episodes) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'episode-card'; button.setAttribute('aria-label', 'Play season ' + season + ', episode ' + episode.episode + ': ' + episode.title);
        const nowPlaying = season === currentSeason && episode.episode === currentEpisode; button.setAttribute('aria-current', String(nowPlaying));
        const image = document.createElement('span'); image.className = 'episode-image';
        if (typeof episode.stillUrl === 'string' && /^https:\/\/image\.tmdb\.org\//.test(episode.stillUrl)) { const img = document.createElement('img'); img.src = episode.stillUrl; img.alt = ''; img.loading = 'lazy'; image.appendChild(img); }
        const badge = document.createElement('span'); badge.className = 'episode-badge'; badge.textContent = 'S' + season + 'E' + episode.episode + (nowPlaying ? ' · Now playing' : ''); image.appendChild(badge);
        if (episode.runtime) { const runtime = document.createElement('span'); runtime.className = 'episode-runtime'; runtime.textContent = episode.runtime + 'm'; image.appendChild(runtime); }
        const copy = document.createElement('span'); copy.className = 'episode-copy'; const heading = document.createElement('strong'); heading.textContent = episode.title; const overview = document.createElement('p'); overview.textContent = episode.overview || ''; copy.append(heading, overview); button.append(image, copy);
        const record = core.progress(records[progressKey(season, episode.episode)]);
        if (record) { const bar = document.createElement('div'); bar.className = 'episode-progress'; const fill = document.createElement('i'); fill.style.width = core.clamp(record.position / record.duration * 100, 0, 100) + '%'; bar.appendChild(fill); button.appendChild(bar); }
        button.addEventListener('click', async () => {
          saveProgress(); loading = true; const transition = ++generation;
          controller?.abort(); clearTimeout(metadataTimer); hls?.destroy(); hls = null; video.pause();
          localTrack?.remove(); localTrack = null; if (localSubtitleUrl) URL.revokeObjectURL(localSubtitleUrl); localSubtitleUrl = null; el('subtitle-track').value = 'off';
          currentSeason = season; currentEpisode = episode.episode; savedPosition = 0; lastDuration = 0; newPlaybackSession(); restartRequested = false;
          useProgress(core.progress(historyMap()[progressKey()]), true); failedServers.clear();
          el('episode-title').textContent = 'S' + currentSeason + ' E' + currentEpisode + ' · ' + episode.title; el('episode-title').hidden = false;
          params.set('season', String(currentSeason)); params.set('episode', String(currentEpisode));
          try { history.replaceState(null, '', location.pathname + '?' + params); } catch { /* Playback can continue. */ }
          el('season').value = String(currentSeason); closePanels(); page.dataset.state = 'loading'; inform('Loading episode…', true);
          try {
            const data = await jsonGet('/api/playback/progress?' + new URLSearchParams({ type, tmdbId: String(tmdbId), season: String(season), episode: String(episode.episode) }), 2500);
            if (transition !== generation || disposed) return;
            const remote = core.progress(data.progress), local = core.progress(historyMap()[progressKey()]);
            if (remote && remote.type === type && remote.tmdbId === tmdbId && remote.season === season && remote.episode === episode.episode && (!local || Date.parse(remote.updatedAt) >= (Date.parse(local.updatedAt) || local.recordedAt || 0))) { savedPosition = 0; lastDuration = 0; useProgress(remote, true); }
          } catch { /* The cached episode position remains available offline. */ }
          if (transition === generation && !disposed) void load(true);
        }); el('episode-list').appendChild(button);
      }
    } catch (error) { if (error.name !== 'AbortError' && current === episodeGeneration) el('episodes-status').textContent = 'Could not load episodes. Choose the season again to retry.'; }
  }
  el('season').addEventListener('change', () => void showEpisodes(Number(el('season').value)));
  function pictureUi() {
    const width = video.videoWidth, height = video.videoHeight;
    const scale = preferences.fit === 'fit' ? 1 : core.fillScale(width, height, page.clientWidth || innerWidth, page.clientHeight || innerHeight, preferences.fit === 'auto' ? cropBounds : { width: 1, height: 1 });
    video.style.transform = 'scale(' + Math.min(5, scale * preferences.zoom) + ')';
    el('screen-info').textContent = 'Screen ' + Math.round(screen.width * devicePixelRatio) + '×' + Math.round(screen.height * devicePixelRatio) + ' · Viewport ' + innerWidth + '×' + innerHeight + (width ? ' · Video ' + width + '×' + height : '');
  }
  function preferencesUi() {
    video.volume = preferences.volume; video.muted = preferences.muted; video.playbackRate = preferences.speed;
    for (const [id, value] of [['volume', preferences.volume], ['fit', preferences.fit], ['zoom', preferences.zoom], ['speed', preferences.speed], ['subtitle-size', preferences.subtitleSize]]) el(id).value = String(value);
    el('zoom-value').textContent = preferences.zoom.toFixed(2) + '×'; el('subtitle-size-value').textContent = preferences.subtitleSize + '%'; page.style.setProperty('--subtitle-size', preferences.subtitleSize + '%'); pictureUi();
    el('mute').setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute'); el('mute').setAttribute('aria-pressed', String(video.muted));
  }
  function updatePreferences(values) { preferences = core.settings({ ...preferences, ...values }); store(SETTINGS_KEY, preferences); preferencesUi(); }
  const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 54;
  function sampleCrop() {
    if (preferences.fit !== 'auto' || loading || video.readyState < 2) return;
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height); const bounds = core.blackBarBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (!bounds) return; const key = bounds.width.toFixed(2) + ':' + bounds.height.toFixed(2);
      if (key === cropCandidate) cropSamples++; else { cropCandidate = key; cropSamples = 1; }
      if (cropSamples >= 3) { cropBounds = bounds; pictureUi(); el('crop-note').textContent = bounds.width < 1 || bounds.height < 1 ? 'Black borders detected. Cropping to fill your screen.' : 'No encoded borders detected. Filling the screen.'; }
    } catch { el('crop-note').textContent = 'Border detection is unavailable for this stream. Use Fill or extra zoom.'; }
  }
  function populateTracks() {
    const previous = el('subtitle-track').value, quality = hls?.autoLevelEnabled === false ? hls.currentLevel : -1, audio = hls?.audioTrack;
    el('subtitle-track').replaceChildren();
    const option = (select, value, text) => { const item = document.createElement('option'); item.value = String(value); item.textContent = text; select.appendChild(item); };
    option(el('subtitle-track'), 'off', 'Off');
    for (const [i, track] of (hls?.subtitleTracks || []).entries()) option(el('subtitle-track'), 'hls:' + i, track.name || track.lang || 'Subtitles ' + (i + 1));
    if (!hls) for (let i = 0; i < video.textTracks.length; i++) if (video.textTracks[i] !== localTrack?.track) option(el('subtitle-track'), 'native:' + i, video.textTracks[i].label || video.textTracks[i].language || 'Subtitles ' + (i + 1));
    if (localTrack) option(el('subtitle-track'), 'local', 'Your subtitle file');
    el('subtitle-track').value = [...el('subtitle-track').options].some((item) => item.value === previous) ? previous : 'off';
    el('subtitle-note').textContent = el('subtitle-track').options.length > 1 ? '' : 'This stream has no subtitle tracks. You can load a VTT or SRT file.';
    el('quality').replaceChildren(); option(el('quality'), -1, video.videoHeight ? 'Auto · ' + video.videoHeight + 'p' : 'Automatic');
    for (const [i, level] of (hls?.levels || []).entries()) if ((hls?.levels || []).length > 1) option(el('quality'), i, level.height ? level.height + 'p' : Math.round(level.bitrate / 1000) + ' kbps');
    el('quality').value = String(quality ?? -1);
    el('audio-track').replaceChildren(); option(el('audio-track'), 'default', 'Default');
    for (const [i, track] of (hls?.audioTracks || []).entries()) option(el('audio-track'), i, track.name || track.lang || 'Audio ' + (i + 1));
    el('audio-track').value = audio >= 0 ? String(audio) : 'default';
    el('audio-track').disabled = !(hls?.audioTracks?.length > 1);
  }
  function subtitlesUi() {
    const value = el('subtitle-track').value; for (const track of video.textTracks) track.mode = 'disabled';
    if (hls) { hls.subtitleDisplay = value.startsWith('hls:'); hls.subtitleTrack = value.startsWith('hls:') ? Number(value.slice(4)) : -1; }
    if (value === 'local' && localTrack) localTrack.track.mode = 'showing';
    else if (value.startsWith('native:') && video.textTracks[Number(value.slice(7))]) video.textTracks[Number(value.slice(7))].mode = 'showing';
    el('subtitles-button').setAttribute('aria-pressed', String(value !== 'off'));
  }
  async function resolveSource(payload, signal) {
    const response = await fetch('/api/stream', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
    let data; try { data = await response.json(); } catch { throw new Error('The playback service is unavailable. Try again shortly.'); }
    if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'This stream is unavailable.');
    if (!data || Object.keys(data).length !== 1 || typeof data.source !== 'string') throw new Error('The resolver returned an invalid playback link.');
    const source = new URL(data.source, location.origin);
    if (source.origin !== location.origin || source.pathname !== '/api/proxy-stream' || source.hash || source.username || source.password || [...source.searchParams.keys()].length !== 1 || !/^[A-Za-z0-9_-]{1,12000}$/.test(source.searchParams.get('token') || '')) throw new Error('The resolver returned an invalid playback link.');
    const serverId = response.headers.get('X-Horizon-Stream-Server'); return { source, server: /^[a-z]{2,16}$/.test(serverId || '') ? serverId : payload.server || '' };
  }
  async function recover(current, message) {
    if (current !== generation || disposed) return;
    clearTimeout(metadataTimer); await serversReady;
    if (current !== generation || disposed) return;
    if (activeServer) failedServers.add(activeServer);
    const next = servers.find((server) => !failedServers.has(server.id));
    if (selectedServer === 'auto' && next) { failedServers.add(next.id); void load(true, next.id); }
    else fail(message || 'Playback stopped. Choose another server or try again.');
  }
  async function load(resume = false, serverOverride) {
    const current = ++generation;
    if (!resume) savedPosition = 0;
    else if (!loading && video.readyState >= 1 && Number.isFinite(video.currentTime)) savedPosition = video.currentTime;
    const position = savedPosition;
    loading = true; controller?.abort(); controller = new AbortController(); clearTimeout(stallTimer); clearTimeout(metadataTimer);
    hls?.destroy(); hls = null; video.pause(); video.removeAttribute('src'); video.load();
    if (pendingSeek) video.removeEventListener('loadedmetadata', pendingSeek); pendingSeek = null;
    page.dataset.state = 'loading'; page.dataset.ready = 'false'; retry.hidden = true;
    inform(serverOverride ? 'Trying ' + (servers.find((server) => server.id === serverOverride)?.name || 'another server') + '…' : 'Finding a working server…', true); positionUi();
    cropBounds = { width: 1, height: 1 }; cropSamples = 0; cropCandidate = '';
    try {
      const payload = { type, tmdbId }, requestedServer = serverOverride || selectedServer;
      if (requestedServer !== 'auto') payload.server = requestedServer;
      if (type === 'show') { payload.season = currentSeason; payload.episode = currentEpisode; }
      const resolved = await resolveSource(payload, AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]));
      if (current !== generation || disposed) return;
      activeServer = resolved.server; el('active-server').textContent = activeServer ? 'Playing from ' + (servers.find((server) => server.id === activeServer)?.name || activeServer) : 'Automatic selected a working stream.';
      pendingSeek = () => {
        if (current !== generation) return;
        clearTimeout(metadataTimer);
        if (position > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(position, Math.max(0, video.duration - 1));
        loading = false; page.dataset.ready = 'true'; status.textContent = ''; retry.hidden = true; preferencesUi(); populateTracks(); subtitlesUi(); positionUi(); reflectPlayback();
        void Promise.resolve(video.play()).catch(() => { if (current === generation) { reflectPlayback(); status.textContent = ''; } });
      }; video.addEventListener('loadedmetadata', pendingSeek, { once: true });
      metadataTimer = setTimeout(() => { if (current === generation && loading) void recover(current, 'The stream did not load. Try another server.'); }, 22000);
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false, startPosition: position > 0 ? position : -1, maxBufferLength: 30, maxMaxBufferLength: 60 });
        hls.on(Hls.Events.ERROR, (_event, event) => { if (current === generation && event.fatal) recover(current, 'Playback stopped. Try another server.'); });
        for (const event of [Hls.Events.MANIFEST_PARSED, Hls.Events.SUBTITLE_TRACKS_UPDATED, Hls.Events.AUDIO_TRACKS_UPDATED]) if (event) hls.on(event, () => { if (current === generation) populateTracks(); });
        hls.loadSource(resolved.source.href); hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = resolved.source.href;
      else throw new Error('This browser does not support HLS playback.');
    } catch (error) {
      if (current !== generation || controller.signal.aborted || disposed) return;
      if (serverOverride && selectedServer === 'auto') recover(current, error.message); else fail(error.message || 'This stream is unavailable.');
    }
  }
  async function togglePlay() { if (loading) return; if (video.paused) { try { await video.play(); } catch { inform('Tap Play again when the stream is ready.'); } } else video.pause(); }
  el('play').addEventListener('click', () => void togglePlay());
  video.addEventListener('click', () => { if (document.querySelector('.panel:not([hidden])')) closePanels(); else void togglePlay(); });
  el('rewind').addEventListener('click', () => { if (!loading) video.currentTime = Math.max(0, video.currentTime - 10); });
  el('forward').addEventListener('click', () => { if (!loading && Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10); });
  el('seek').addEventListener('input', () => { if (!loading) { video.currentTime = Number(el('seek').value); positionUi(); } }); el('seek').addEventListener('change', () => saveProgress());
  el('volume').addEventListener('input', () => updatePreferences({ volume: Number(el('volume').value), muted: false })); el('mute').addEventListener('click', () => updatePreferences({ muted: !video.muted }));
  el('speed').addEventListener('change', () => updatePreferences({ speed: Number(el('speed').value) }));
  el('fit').addEventListener('change', () => { cropCandidate = ''; cropSamples = 0; updatePreferences({ fit: el('fit').value }); sampleCrop(); });
  el('zoom').addEventListener('input', () => updatePreferences({ zoom: Number(el('zoom').value) })); el('subtitle-size').addEventListener('input', () => updatePreferences({ subtitleSize: Number(el('subtitle-size').value) }));
  el('sleep').addEventListener('change', () => { clearTimeout(sleepTimer); const minutes = Number(el('sleep').value); if (minutes > 0) sleepTimer = setTimeout(() => { video.pause(); el('sleep').value = '0'; inform('Sleep timer finished.'); }, minutes * 60000); });
  el('quality').addEventListener('change', () => { if (hls) hls.currentLevel = Number(el('quality').value); }); el('audio-track').addEventListener('change', () => { if (hls) hls.audioTrack = el('audio-track').value === 'default' ? 0 : Number(el('audio-track').value); }); el('subtitle-track').addEventListener('change', subtitlesUi);
  el('subtitle-file').addEventListener('change', async () => {
    try {
      const file = el('subtitle-file').files?.[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024 || !/\.(vtt|srt)$/i.test(file.name)) { inform('Choose a VTT or SRT subtitle file smaller than 2 MB.'); return; }
      let text = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      if (/\.srt$/i.test(file.name)) text = 'WEBVTT\n\n' + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      if (!/^WEBVTT(?:\s|$)/.test(text)) { inform('This file is not a supported subtitle file.'); return; }
      localTrack?.remove(); if (localSubtitleUrl) URL.revokeObjectURL(localSubtitleUrl);
      localSubtitleUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' })); localTrack = document.createElement('track'); localTrack.kind = 'subtitles'; localTrack.label = 'Your subtitle file'; localTrack.src = localSubtitleUrl;
      localTrack.addEventListener('load', () => { el('subtitle-track').value = 'local'; subtitlesUi(); }); video.appendChild(localTrack); populateTracks(); el('subtitle-track').value = 'local'; subtitlesUi();
    } catch { inform('The subtitle file could not be read.'); }
  });
  el('server').addEventListener('change', () => { saveProgress(); selectedServer = el('server').value; failedServers.clear(); closePanels(); void load(true); }); retry.addEventListener('click', () => { failedServers.clear(); void load(true); });
  el('restart').addEventListener('click', () => { savedPosition = 0; restartRequested = true; newPlaybackSession(); if (!loading) { video.currentTime = 0; saveProgress(); } closePanels(); if (loading) void load(false); else void video.play().catch(() => {}); });
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (page.requestFullscreen) await page.requestFullscreen(); else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); else inform('Fullscreen is unavailable in this browser.'); } catch { inform('Your browser could not enter fullscreen.'); } }
  el('fullscreen').addEventListener('click', () => void fullscreen()); video.addEventListener('dblclick', () => void fullscreen()); document.addEventListener('fullscreenchange', () => { el('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'); pictureUi(); });
  el('pip').addEventListener('click', async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (document.pictureInPictureEnabled && video.requestPictureInPicture && video.readyState >= 2) await video.requestPictureInPicture(); else if (video.webkitSupportsPresentationMode?.('picture-in-picture')) video.webkitSetPresentationMode('picture-in-picture'); else inform('Picture in picture is unavailable or the stream is still loading.'); } catch { inform('Your browser could not open picture in picture.'); } });
  el('cast').addEventListener('click', async () => { try { if (video.webkitShowPlaybackTargetPicker) video.webkitShowPlaybackTargetPicker(); else if (video.remote?.prompt) await video.remote.prompt(); else inform('Use a compatible AirPlay browser or your browser’s Cast screen menu.'); } catch (error) { if (error.name !== 'NotAllowedError') inform('No compatible casting device is available. You can use your browser’s screen-cast menu.'); } });
  for (const event of ['mousemove', 'pointerdown', 'touchstart']) page.addEventListener(event, showChrome, { passive: true }); page.addEventListener('focusin', showChrome); page.addEventListener('focusout', showChrome);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closePanels(); return; }
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(document.activeElement?.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space' || event.key.toLowerCase() === 'k') { event.preventDefault(); void togglePlay(); }
    else if (event.key === 'ArrowLeft' && !loading) { event.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); }
    else if (event.key === 'ArrowRight' && !loading && Number.isFinite(video.duration)) { event.preventDefault(); video.currentTime = Math.min(video.duration, video.currentTime + 10); }
    else if (event.key.toLowerCase() === 'f') void fullscreen(); else if (event.key.toLowerCase() === 'm') updatePreferences({ muted: !video.muted }); showChrome();
  });
  video.addEventListener('pause', () => { reflectPlayback(); saveProgress(); }); video.addEventListener('playing', () => { clearTimeout(stallTimer); status.textContent = ''; retry.hidden = true; reflectPlayback(); });
  video.addEventListener('timeupdate', positionUi); video.addEventListener('durationchange', positionUi); video.addEventListener('loadedmetadata', pictureUi); video.addEventListener('resize', pictureUi); video.addEventListener('ended', () => { saveProgress(); reflectPlayback(); });
  video.addEventListener('error', () => { if (!disposed && (hls || video.getAttribute('src'))) void recover(generation); });
  video.addEventListener('waiting', () => { const current = generation; clearTimeout(stallTimer); if (!video.paused) stallTimer = setTimeout(() => { if (current === generation && video.readyState < 3 && !video.paused) recover(current, 'The stream is buffering. Try another server.'); }, 20000); }); window.addEventListener('resize', pictureUi);
  const saveTimer = setInterval(() => { if (!video.paused) saveProgress(); }, 10000), cropTimer = setInterval(sampleCrop, 2500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveProgress(true); });
  window.addEventListener('pagehide', () => { saveProgress(true); disposed = true; generation++; lifetime.abort(); controller?.abort(); episodeController?.abort(); hls?.destroy(); clearInterval(saveTimer); clearInterval(cropTimer); for (const timer of [idleTimer, stallTimer, metadataTimer, sleepTimer, noticeTimer]) clearTimeout(timer); if (localSubtitleUrl) URL.revokeObjectURL(localSubtitleUrl); });
  async function start() {
    if (!valid) { fail('Open Play from a movie or show details page.'); return; }
    video.controls = false; preferencesUi(); const startup = generation, local = localProgress(); useProgress(local);
    void jsonGet('/api/playback/catalog?' + new URLSearchParams({ type, tmdbId: String(tmdbId) }), 10000).then((data) => { catalog = data; metadataUi(); }).catch(() => {});
    serversReady = jsonGet('/api/stream/servers', 8000).then((data) => {
      servers = Array.isArray(data.servers) ? data.servers.filter((item) => /^[a-z]{2,16}$/.test(item?.id || '') && typeof item.name === 'string' && item.name.length <= 40).slice(0, 16) : [];
      for (const item of servers) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; el('server').appendChild(option); }
    }).catch(() => {});
    try {
      const query = new URLSearchParams({ type, tmdbId: String(tmdbId) }); if (type === 'show' && explicitEpisode) { query.set('season', String(currentSeason)); query.set('episode', String(currentEpisode)); }
      const data = await jsonGet('/api/playback/progress?' + query, 2500), remote = core.progress(data.progress);
      if (generation !== startup || disposed) return;
      if (remote && remote.type === type && remote.tmdbId === tmdbId && (!explicitEpisode || type !== 'show' || (remote.season === currentSeason && remote.episode === currentEpisode)) && (!local || (Date.parse(remote.updatedAt) || 0) >= (Date.parse(local.updatedAt) || local.recordedAt || 0))) { savedPosition = 0; lastDuration = 0; useProgress(remote); }
    } catch { /* Local progress resumes if the account API is unavailable. */ }
    if (!disposed && generation === startup) { if (type === 'show') { el('season').value = String(currentSeason); el('episode-title').textContent = 'Season ' + currentSeason + ' · Episode ' + currentEpisode; el('episode-title').hidden = false; } await load(true); }
  }
  void start();
})();`;
