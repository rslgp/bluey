// public/js/cast.js — castable-video / Chromecast integration
export function initCast({ castVideoEl, getPlayer, castChromeStatusEl, btnCastToTV }) {
  // Wait for the custom element to upgrade before accessing .remote
  customElements.whenDefined('castable-video').then(() => {
    _setup({ castVideoEl, getPlayer, castChromeStatusEl, btnCastToTV });
  });
}

function _setup({ castVideoEl, getPlayer, castChromeStatusEl, btnCastToTV }) {
  castVideoEl.remote?.watchAvailability(available => {
    btnCastToTV.hidden = !available;
  }).catch(() => { btnCastToTV.hidden = true; });

  btnCastToTV.addEventListener('click', () => castVideoEl.remote?.prompt());

  castVideoEl.remote?.addEventListener('connect', () => {
    castChromeStatusEl.textContent = '📺 Transmitindo para TV';
    btnCastToTV.textContent        = 'Parar transmissão';
    const p = getPlayer();
    if (p && !p.paused) p.pause();
  });

  castVideoEl.remote?.addEventListener('disconnect', () => {
    castChromeStatusEl.textContent = '';
    btnCastToTV.textContent        = 'Transmitir';
  });
}
