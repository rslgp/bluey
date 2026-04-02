// public/js/player.js — Plyr + playback + episode navigation
import Plyr          from '/libs/plyr/plyr.mjs';
import { getToken }  from './auth.js';

const playerSection = document.getElementById('player-section');
const playerTitle   = document.getElementById('player-title');
const castPreviewW  = document.getElementById('cast-preview-wrap');
const btnPrevEp     = document.getElementById('btn-prev-ep');
const btnNextEp     = document.getElementById('btn-next-ep');

const player = new Plyr(document.getElementById('main-video'), {
  controls: ['play-large','play','rewind','fast-forward','progress',
             'current-time','duration','mute','volume','settings','fullscreen'],
  resetOnEnd: false,
});

let _videoList    = [];
let _currentIndex = -1;
let _castVideoEl, _onUpgrade;

export function initPlayer({ castVideoEl, onUpgrade }) {
  _castVideoEl = castVideoEl;
  _onUpgrade   = onUpgrade;

  btnPrevEp.addEventListener('click', () => _playAdjacent(-1));
  btnNextEp.addEventListener('click', () => _playAdjacent(+1));
  player.on('ended', () => {
    const next = _videoList[_currentIndex + 1];
    if (next && !next.locked) playVideo(next.id);
  });
}

export function setVideoList(list) {
  _videoList = list;
  _updateNavButtons();
}

export function getPlayer() { return player; }

export async function playVideo(id) {
  const token = await getToken();
  const res   = await fetch(`/api/videos/${id}`, { headers: { Authorization: `Bearer ${token}` } });

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

  _castVideoEl.src   = video.url;
  _castVideoEl.title = video.title;

  if (_castVideoEl.remote?.state === 'connected') {
    _castVideoEl.load();
    return;
  }

  player.source = { type: 'video', sources: [{ src: video.url, type: 'video/mp4' }] };
  player.play();
}

function _updateNavButtons() {
  btnPrevEp.hidden = _currentIndex <= 0 || _videoList[_currentIndex - 1]?.locked;
  btnNextEp.hidden = _currentIndex < 0
    || _currentIndex >= _videoList.length - 1
    || _videoList[_currentIndex + 1]?.locked;
}

function _playAdjacent(offset) {
  const target = _videoList[_currentIndex + offset];
  if (target && !target.locked) playVideo(target.id);
}
