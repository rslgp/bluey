// Note: Imports removed as you are using CDN globals (videojs and Hls)
import { getToken } from './auth.js'; 

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
  fluid: true, // Makes the player responsive
  playbackRates: [0.5, 1, 1.5, 2]
});

let hlsInstance = null;
let _videoList = [];
let _currentIndex = -1;
let _castVideoEl, _onUpgrade;

export function initPlayer({ castVideoEl, onUpgrade }) {
  _castVideoEl = castVideoEl;
  _onUpgrade = onUpgrade;

  btnPrevEp.addEventListener('click', () => _playAdjacent(-1));
  btnNextEp.addEventListener('click', () => _playAdjacent(+1));

  player.on('ended', () => {
    const next = _findNextPlayable(_currentIndex);
    if (next) playVideo(next.id);
  });
}

export function setVideoList(list) {
  _videoList = list;
  _updateNavButtons();
}

export function getPlayer() { return player; }

export async function playVideo(id) {
  const token = await getToken();
  const res = await fetch(`/api/videos/${id}`, { 
    headers: { Authorization: `Bearer ${token}` } 
  });

  if (res.status === 403) {
    const d = await res.json();
    if (d.upgrade) _onUpgrade();
    return;
  }

  const video = await res.json();
  _currentIndex = _videoList.findIndex(v => v.id === id);
  _updateNavButtons();

  playerTitle.textContent = video.title;
  playerSection.removeAttribute('hidden');
  playerSection.scrollIntoView({ behavior: 'smooth' });
  castPreviewW.setAttribute('hidden', '');

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
    // Check if browser supports HLS natively (Safari/iOS)
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      player.src({ src: video.url, type: 'application/vnd.apple.mpegurl' });
      player.play();
    } 
    // Otherwise use HLS.js
    else if (Hls.isSupported()) {
      hlsInstance = new Hls();
      hlsInstance.loadSource(video.url);
      hlsInstance.attachMedia(videoEl);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        player.play();
      });
    }
  } else {
    // Standard MP4 Fallback
    player.src({ src: video.url, type: 'video/mp4' });
    player.play();
  }
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
  // If blocked, find the last unlocked episode in a prior season
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