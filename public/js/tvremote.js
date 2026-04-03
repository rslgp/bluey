// public/js/tvremote.js — TV remote control via Server-Sent Events

let _phoneCode = null; // code this device joined as phone controller

// ── TV side ───────────────────────────────────────────────────────────────────
export function activateTVMode({ onPlay }) {
  const tvModePanel  = document.getElementById('tv-mode-panel');
  const tvCodeEl     = document.getElementById('tv-code-display');
  const tvStatusEl   = document.getElementById('tv-mode-status');

  const evtSource = new EventSource('/api/tv/register');

  evtSource.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'code') {
      tvCodeEl.textContent   = msg.code;
      tvModePanel.removeAttribute('hidden');
      tvStatusEl.textContent = 'Aguardando celular…';
    }
    if (msg.type === 'phone_connected') {
      tvStatusEl.textContent = '📱 Celular conectado!';
    }
    if (msg.type === 'play') {
      onPlay(msg.videoId);
    }
  };

  evtSource.onerror = () => {
    tvStatusEl.textContent = 'Conexão perdida. Recarregue a página.';
  };
}

// ── Phone side ────────────────────────────────────────────────────────────────
export async function joinTV(code) {
  const res = await fetch('/api/tv/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: String(code) }),
  });
  if (!res.ok) throw new Error('Código inválido');
  _phoneCode = String(code);
  return true;
}

export function disconnectTV() {
  _phoneCode = null;
}

export function isConnectedToTV() {
  return !!_phoneCode;
}

export async function playOnTV(videoId) {
  if (!_phoneCode) return;
  await fetch('/api/tv/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: _phoneCode, videoId }),
  }).catch(() => {});
}
