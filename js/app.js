// public/js/app.js — orchestrator (bootstraps and wires all modules)
export const PIX_API_BASE = 'https://pix.055190.xyz';
// export const PIX_API_BASE = 'http://localhost:3001';

import { initFirebase, watchAuthState, refreshClaims,
         getCurrentUserEmail, initAuthForms }   from './auth.js';
import { initCatalog, loadCatalog }             from './catalog.js';
import { initPlayer, playVideo, setVideoList,
         getPlayer, setIsPremium,
         getVideoList, toggleFullscreen }                         from './player.js';
import { initPix, openPixModal }                from './pix.js';
// import { initScreencast }                       from './screencast.js';
import { initCast }                             from './cast.js';
import { activateTVMode, joinTV, disconnectTV,
         isConnectedToTV, playOnTV, pauseTV,
         fullscreenTV }                         from './tvremote.js';

// ─── Stable DOM refs (used across multiple concerns) ─────────────────────────
const screenAuth         = document.getElementById('screen-auth');
const screenApp          = document.getElementById('screen-app');
const playerSection      = document.getElementById('player-section');
const navBadge           = document.getElementById('nav-badge');
const btnUpgradeN        = document.getElementById('btn-upgrade-nav');
const catalogUser        = document.getElementById('catalog-user');
const castVideoEl        = document.getElementById('cast-video');
const castChromeStatusEl = document.getElementById('cast-chrome-status');
const btnCastToTV        = document.getElementById('btn-cast-to-tv');
const audioOutputWrapEl  = document.getElementById('audio-output-wrap');

// ─── Bootstrap ────────────────────────────────────────────────────────────────
await initFirebase();

// ─── TV state (grouped to reveal coupling) ───────────────────────────────────
const _tv = { currentId: null, paused: false };

// Routes play to TV when connected, local player otherwise (SRP: routing only)
function _onPlay(id) {
  if (!isConnectedToTV()) { playVideo(id); return; }
  _tv.currentId = id;
  _tv.paused    = false;
  _resetPauseUI();
  document.getElementById('tv-nav-buttons').removeAttribute('hidden');
  playOnTV(id);
}

initPlayer({ castVideoEl, onUpgrade: openPixModal });
initCatalog({ onPlay: _onPlay, onUpgrade: openPixModal });
initPix({ onSuccess: _onPaymentSuccess });
// initScreencast();
initCast({ castVideoEl, getPlayer, castChromeStatusEl, btnCastToTV, audioOutputWrapEl });
initAuthForms();
_initTVControls();

btnUpgradeN.addEventListener('click', openPixModal);

// ─── Auth state ───────────────────────────────────────────────────────────────
watchAuthState({
  onLogin: async ({ isPremium }) => {
    screenAuth.classList.remove('active');
    screenApp.classList.add('active');
    setIsPremium(isPremium);
    _updatePremiumUI(isPremium);
    const videos = await loadCatalog(isPremium);
    setVideoList(videos);
  },
  onLogout: () => {
    screenApp.classList.remove('active');
    screenAuth.classList.add('active');
    playerSection.setAttribute('hidden', '');
  },
});

// ─── TV remote controls (scoped to keep DOM refs close to their use) ─────────
function _initTVControls() {
  const btnUseAsTV        = document.getElementById('btn-use-as-tv');
  const btnControlTV      = document.getElementById('btn-control-tv');
  const phoneControlPanel = document.getElementById('phone-control-panel');
  const tvCodeInput       = document.getElementById('tv-code-input');
  const btnJoinTV         = document.getElementById('btn-join-tv');
  const tvConnectStatus   = document.getElementById('tv-connect-status');
  const btnDisconnectTV   = document.getElementById('btn-disconnect-tv');
  const tvNavButtons      = document.getElementById('tv-nav-buttons');
  const btnTVPrev         = document.getElementById('btn-tv-prev');
  const btnTVPause        = document.getElementById('btn-tv-pause');
  const btnTVNext         = document.getElementById('btn-tv-next');
  const btnTVFullscreen   = document.getElementById('btn-tv-fullscreen');

  btnUseAsTV.addEventListener('click', () => {
    btnUseAsTV.hidden   = true;
    btnControlTV.hidden = true;
    activateTVMode({
      onPlay:   playVideo,
      onPause:  () => getPlayer().pause(),
      onResume: () => getPlayer().play(),
      onFullscreen: () => {
        document.body.classList.toggle('windowed-mode');
        // document.body.classList.toggle('theatre-mode');
        // if(document.body.classList.contains('theatre-mode')){
        //   document.getElementById("player-controls-extra").style.display = 'none';
        //   document.getElementById("player-wrap").style.maxWidth = '100vw';
        //   document.getElementById("player-wrap").style.maxHeight = '100vh';
        //   document.getElementById("navbar").style.display = 'none';
          
        // }else{
        //   document.getElementById("player-controls-extra").style.display = '';
        //   document.getElementById("player-wrap").style.maxWidth = '900px';
        //   document.getElementById("player-wrap").style.maxHeight = '';
        //   document.getElementById("navbar").style.display = '';
        // }
        
          //toggleFullscreen();
      },
    });
  });

  btnControlTV.addEventListener('click', () => {
    phoneControlPanel.removeAttribute('hidden');
    tvCodeInput.focus();
  });

  btnJoinTV.addEventListener('click', async () => {
    const code = tvCodeInput.value.trim();
    if (code.length !== 4) { tvConnectStatus.textContent = 'Digite 4 dígitos'; return; }
    btnJoinTV.disabled = true;
    try {
      await joinTV(code);
      tvConnectStatus.textContent = '📺 Conectado! Toque num episódio para abrir na TV.';
      tvCodeInput.hidden          = true;
      btnJoinTV.hidden            = true;
      btnDisconnectTV.removeAttribute('hidden');
    } catch {
      tvConnectStatus.textContent = 'Código inválido ou TV offline.';
    } finally {
      btnJoinTV.disabled = false;
    }
  });

  btnDisconnectTV.addEventListener('click', () => {
    disconnectTV();
    _tv.currentId = null;
    _tv.paused    = false;
    _resetPauseUI();
    tvConnectStatus.textContent = '';
    tvCodeInput.value           = '';
    tvCodeInput.removeAttribute('hidden');
    btnJoinTV.removeAttribute('hidden');
    btnDisconnectTV.setAttribute('hidden', '');
    tvNavButtons.setAttribute('hidden', '');
    phoneControlPanel.setAttribute('hidden', '');
  });

  btnTVPause.addEventListener('click', () => {
    _tv.paused = !_tv.paused;
    pauseTV(_tv.paused);
    _resetPauseUI();
  });

  btnTVPrev.addEventListener('click', () => {
    const prev = _findAdjacentVideo(-1);
    if (!prev) return;
    _tv.currentId = prev.id;
    playOnTV(prev.id);
  });

  btnTVNext.addEventListener('click', () => {
    const next = _findAdjacentVideo(+1);
    if (!next) return;
    _tv.currentId = next.id;
    playOnTV(next.id);
  });

  btnTVFullscreen.addEventListener('click', fullscreenTV);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _resetPauseUI() {
  const iconPause  = document.getElementById('icon-pause');
  const iconResume = document.getElementById('icon-resume');
  iconPause.hidden  = _tv.paused;
  iconResume.hidden = !_tv.paused;
}

function _findAdjacentVideo(direction) {
  const list = getVideoList();
  const idx  = list.findIndex(v => v.id === _tv.currentId);
  if (idx === -1) return null;
  for (let i = idx + direction; i >= 0 && i < list.length; i += direction) {
    if (!list[i].locked) return list[i];
  }
  return null;
}

async function _onPaymentSuccess() {
  const { isPremium } = await refreshClaims();
  setIsPremium(isPremium);
  _updatePremiumUI(isPremium);
  const videos = await loadCatalog(isPremium);
  setVideoList(videos);
}

function _updatePremiumUI(isPremium) {
  catalogUser.textContent = getCurrentUserEmail();
  navBadge.textContent    = isPremium ? '✦ PREMIUM' : 'FREE';
  navBadge.className      = isPremium ? 'badge-premium' : 'badge-free';
  btnUpgradeN.hidden      = isPremium;
}
