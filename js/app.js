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

// ─── Bootstrap ────────────────────────────────────────────────────────────────
await initFirebase();

initPlayer({ castVideoEl, onUpgrade: openPixModal });
initCatalog({ onPlay: playVideo, onUpgrade: openPixModal });
initPix({ onSuccess: _onPaymentSuccess });
// initScreencast();
initCast({ castVideoEl, getPlayer, castChromeStatusEl, btnCastToTV, audioOutputWrapEl });
initAuthForms();

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
