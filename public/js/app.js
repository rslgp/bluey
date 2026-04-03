// public/js/app.js — orchestrator (bootstraps and wires all modules)
// URL of the PIX payment microservice (update after deploying streamcast-pix)
export const PIX_API_BASE = 'https://pix.055190.xyz';
// export const PIX_API_BASE = 'http://localhost:3001';

import { initFirebase, watchAuthState, refreshClaims,
         getCurrentUserEmail, initAuthForms }   from './auth.js';
import { initCatalog, loadCatalog }             from './catalog.js';
import { initPlayer, playVideo, setVideoList,
         getPlayer, setIsPremium }              from './player.js';
import { initPix, openPixModal }                from './pix.js';
// import { initScreencast }                       from './screencast.js';
import { initCast }                             from './cast.js';
import { activateTVMode, joinTV, disconnectTV,
         isConnectedToTV, playOnTV }            from './tvremote.js';

// ─── DOM refs (orchestrator-only) ────────────────────────────────────────────
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
const btnUseAsTV         = document.getElementById('btn-use-as-tv');
const btnControlTV       = document.getElementById('btn-control-tv');
const phoneControlPanel  = document.getElementById('phone-control-panel');
const tvCodeInput        = document.getElementById('tv-code-input');
const btnJoinTV          = document.getElementById('btn-join-tv');
const tvConnectStatus    = document.getElementById('tv-connect-status');
const btnDisconnectTV    = document.getElementById('btn-disconnect-tv');

// ─── Bootstrap ────────────────────────────────────────────────────────────────
await initFirebase();

// Catalog play: route to TV if connected, else local player
function _onPlay(id) {
  if (isConnectedToTV()) {
    playOnTV(id);
  } else {
    playVideo(id);
  }
}

initPlayer({ castVideoEl, onUpgrade: openPixModal });
initCatalog({ onPlay: _onPlay, onUpgrade: openPixModal });
initPix({ onSuccess: _onPaymentSuccess });
// initScreencast();
initCast({ castVideoEl, getPlayer, castChromeStatusEl, btnCastToTV, audioOutputWrapEl });
initAuthForms();

btnUpgradeN.addEventListener('click', openPixModal);

// ─── TV Remote buttons ────────────────────────────────────────────────────────
btnUseAsTV.addEventListener('click', () => {
  btnUseAsTV.hidden    = true;
  btnControlTV.hidden  = true;
  activateTVMode({ onPlay: playVideo });
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
  tvConnectStatus.textContent = '';
  tvCodeInput.value           = '';
  tvCodeInput.removeAttribute('hidden');
  btnJoinTV.removeAttribute('hidden');
  btnDisconnectTV.setAttribute('hidden', '');
  phoneControlPanel.setAttribute('hidden', '');
});

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
