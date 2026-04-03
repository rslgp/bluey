// Note: Imports removed as you are using CDN globals (videojs and Hls)

const playerSection = document.getElementById('player-section');
const playerTitle = document.getElementById('player-title');
const castPreviewW = document.getElementById('cast-preview-wrap');
const btnPrevEp = document.getElementById('btn-prev-ep');
const btnNextEp = document.getElementById('btn-next-ep');
const videoEl = document.getElementById('main-video');

// Initialize Video.js
const player = videojs(videoEl, {
  controls: true,
  preload: 'auto',
  fluid: true,
  playbackRates: [0.5, 1, 1.5, 2]
});

let hlsInstance = null;
let _videoList = [];
let _currentIndex = -1;
let _castVideoEl, _onUpgrade;
let _isPremium = false;

export function setIsPremium(v) { _isPremium = v; }

export function initPlayer({ castVideoEl, onUpgrade }) {
  _castVideoEl = castVideoEl;
  _onUpgrade = onUpgrade;

  btnPrevEp.addEventListener('click', () => _playAdjacent(-1));
  btnNextEp.addEventListener('click', () => _playAdjacent(+1));

  const _playNext = () => {
    const next = _findNextPlayable(_currentIndex);
    if (next) playVideo(next.id);
  };

  player.on('ended', _playNext);
  castVideoEl.addEventListener('ended', _playNext);
}

export function setVideoList(list) {
  _videoList = list;
  _updateNavButtons();
}

export function getPlayer() { return player; }

export function getVideoList() { return _videoList; }

export async function playVideo(id) {
  const video = _videoList.find(v => v.id === id);
  if (!video) return;

  if (video.tier === 'premium' && !_isPremium) {
    _onUpgrade();
    return;
  }

  _currentIndex = _videoList.findIndex(v => v.id === id);
  _updateNavButtons();
  localStorage.setItem('bluey_last_ep', id);

  playerTitle.textContent = video.title;
  playerSection.removeAttribute('hidden');
  playerSection.scrollIntoView({ behavior: 'smooth' });
  castPreviewW.setAttribute('hidden', '');

  // Request portrait fullscreen — must run synchronously in the user-gesture call chain
  videoEl.requestFullscreen?.()
    .then(() => screen.orientation.lock?.('portrait-primary').catch(() => {}))
    .catch(() => {});

  _castVideoEl.src = video.url;
  _castVideoEl.title = video.title;

  if (_castVideoEl.remote?.state === 'connected') {
    _castVideoEl.load();
    return;
  }

  // --- Clean up previous HLS instance ---
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  // --- Playback Logic ---
  if (video.url.includes('.m3u8')) {
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      player.src({ src: video.url, type: 'application/vnd.apple.mpegurl' });
      player.play();
    } else if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        startFragPrefetch: true,          // pipeline: prefetch next fragment while current plays
        progressive: true,                // parse large segments progressively as bytes arrive
        maxBufferLength: 60,              // buffer 60s ahead (default 30)
        maxMaxBufferLength: 120,          // allow up to 120s buffer
        maxBufferSize: 120 * 1000 * 1000, // 120 MB in-memory buffer
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeMaxRetry: 5,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        backBufferLength: 30,
      });
      hlsInstance.loadSource(video.url);
      hlsInstance.attachMedia(videoEl);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        player.play();
      });
    }
  } else {
    _playMp4Parallel(video.url);
  }
}

// --- Parallel MP4 downloader via MediaSource ---
// Opens N simultaneous Range requests so archive.org throttling is spread
// across multiple connections, and appends chunks in order to MSE so
// playback starts as soon as the first chunk lands (no full-file wait).
const _MP4_CHUNK  = 2 * 1024 * 1024; // 2 MB per range request
const _MP4_CONNS  = 4;               // parallel connections

let _mp4BlobUrl = null; // track so we can revoke on next play

async function _playMp4Parallel(url) {
  // Clean up previous blob URL
  if (_mp4BlobUrl) { URL.revokeObjectURL(_mp4BlobUrl); _mp4BlobUrl = null; }

  const fallback = () => {
    player.src({ src: url, type: 'video/mp4' });
    player.play();
  };

  if (!window.MediaSource || !window.fetch) return fallback();

  // 1. Get total file size
  let total;
  try {
    const head = await fetch(url, { method: 'HEAD' });
    total = parseInt(head.headers.get('content-length') || '0', 10);
  } catch { return fallback(); }
  if (!total) return fallback();

  // 2. Pick a supported codec string (H.264 High → Baseline, both common on archive.org)
  const CODECS = [
    'video/mp4; codecs="avc1.640028, mp4a.40.2"',
    'video/mp4; codecs="avc1.4D4028, mp4a.40.2"',
    'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  ];
  const mimeType = CODECS.find(c => MediaSource.isTypeSupported(c));
  if (!mimeType) return fallback();

  // 3. Build chunk list
  const chunks = [];
  for (let s = 0; s < total; s += _MP4_CHUNK) {
    chunks.push({ start: s, end: Math.min(s + _MP4_CHUNK - 1, total - 1), buf: null });
  }

  const ms = new MediaSource();
  _mp4BlobUrl = URL.createObjectURL(ms);

  ms.addEventListener('sourceopen', async () => {
    let sb;
    try { sb = ms.addSourceBuffer(mimeType); }
    catch { URL.revokeObjectURL(_mp4BlobUrl); _mp4BlobUrl = null; return fallback(); }

    let nextAppend  = 0;
    let allDone     = false;

    // Append the next in-order chunk if MSE is idle and data is ready
    const appendNext = () => {
      if (sb.updating) return;
      if (nextAppend >= chunks.length) {
        if (allDone) try { ms.endOfStream(); } catch {}
        return;
      }
      const c = chunks[nextAppend];
      if (!c.buf) return; // chunk not yet downloaded
      try {
        sb.appendBuffer(c.buf);
        c.buf = null; // release memory immediately
        nextAppend++;
      } catch (e) {
        console.warn('[MSE] appendBuffer failed:', e);
      }
    };

    sb.addEventListener('updateend', appendNext);

    // 4. Download one chunk, store its bytes, then nudge the appender
    const downloadChunk = async (i) => {
      const c = chunks[i];
      try {
        const resp = await fetch(url, { headers: { Range: `bytes=${c.start}-${c.end}` } });
        c.buf = new Uint8Array(await resp.arrayBuffer());
      } catch {
        c.buf = new Uint8Array(0); // skip broken chunk
      }
      appendNext(); // try to append if this was the next needed slot
    };

    // 5. Pipeline: _MP4_CONNS workers each pull from a shared index queue
    const queue = chunks.map((_, i) => i);
    const worker = async () => {
      while (queue.length) await downloadChunk(queue.shift());
    };
    await Promise.all(Array.from({ length: _MP4_CONNS }, worker));
    allDone = true;
    appendNext(); // flush endOfStream if last chunks came in out of order
  }, { once: true });

  // Hand the MSE blob URL to videojs so controls still work
  player.src({ src: _mp4BlobUrl, type: 'video/mp4' });
}

function _findNextPlayable(fromIndex) {
  const currentCategory = _videoList[fromIndex]?.category;
  const immediateNext = _videoList[fromIndex + 1];
  if (immediateNext && !immediateNext.locked) return immediateNext;
  for (let i = fromIndex + 1; i < _videoList.length; i++) {
    if (_videoList[i].category !== currentCategory && !_videoList[i].locked) {
      return _videoList[i];
    }
  }
  return null;
}

function _findPrevPlayable(fromIndex) {
  const currentCategory = _videoList[fromIndex]?.category;
  const immediatePrev = _videoList[fromIndex - 1];
  if (immediatePrev && !immediatePrev.locked) return immediatePrev;
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (_videoList[i].category !== currentCategory && !_videoList[i].locked) {
      return _videoList[i];
    }
  }
  return null;
}

function _updateNavButtons() {
  const prevPlayable = _currentIndex >= 0 ? _findPrevPlayable(_currentIndex) : null;
  btnPrevEp.hidden = !prevPlayable;
  if (prevPlayable) {
    const crossingSeason = prevPlayable.category !== _videoList[_currentIndex]?.category;
    btnPrevEp.title = crossingSeason ? `Temporada anterior: ${prevPlayable.category}` : 'Episódio anterior';
  }

  const nextPlayable = _currentIndex >= 0 ? _findNextPlayable(_currentIndex) : null;
  btnNextEp.hidden = !nextPlayable;
  if (nextPlayable) {
    const crossingSeason = nextPlayable.category !== _videoList[_currentIndex]?.category;
    btnNextEp.title = crossingSeason ? `Próxima temporada: ${nextPlayable.category}` : 'Próximo episódio';
  }
}

function _playAdjacent(offset) {
  if (offset === 1) {
    const next = _findNextPlayable(_currentIndex);
    if (next) playVideo(next.id);
  } else {
    const prev = _findPrevPlayable(_currentIndex);
    if (prev) playVideo(prev.id);
  }
}
