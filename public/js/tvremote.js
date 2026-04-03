// public/js/tvremote.js — TV remote control via Server-Sent Events

// Named constants eliminate magic strings shared between server and client
const MSG = Object.freeze({
  CODE:            'code',
  PHONE_CONNECTED: 'phone_connected',
  PLAY:            'play',
  PAUSE:           'pause',
  RESUME:          'resume',
});

let _pairedCode = null; // room code this device joined as phone controller

// ── TV side ───────────────────────────────────────────────────────────────────
export function activateTVMode({ onPlay, onPause, onResume }) {
  const tvModePanel = document.getElementById('tv-mode-panel');
  const tvCodeEl    = document.getElementById('tv-code-display');
  const tvStatusEl  = document.getElementById('tv-mode-status');

  const evtSource = new EventSource('/api/tv/register');

  evtSource.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    switch (msg.type) {
      case MSG.CODE:
        tvCodeEl.textContent = msg.code;
        tvModePanel.removeAttribute('hidden');
        tvStatusEl.textContent = 'Aguardando celular…';
        break;
      case MSG.PHONE_CONNECTED:
        tvStatusEl.textContent = '📱 Celular conectado!';
        break;
      case MSG.PLAY:   onPlay(msg.videoId); break;
      case MSG.PAUSE:  onPause?.();         break;
      case MSG.RESUME: onResume?.();        break;
    }
  };

  evtSource.onerror = () => {
    tvStatusEl.textContent = 'Conexão perdida. Recarregue a página.';
    console.error('[TVRemote] SSE connection lost');
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
  _pairedCode = String(code);
}

export function disconnectTV() { _pairedCode = null; }

export function isConnectedToTV() { return _pairedCode !== null; }

// DRY: single fetch helper for all phone → TV commands
async function _sendCommand(endpoint, body) {
  if (!_pairedCode) return;
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: _pairedCode, ...body }),
    });
  } catch (err) {
    console.error(`[TVRemote] Command failed (${endpoint}):`, err);
  }
}

export const playOnTV = (videoId) => _sendCommand('/api/tv/play',  { videoId });
export const pauseTV  = (paused)  => _sendCommand('/api/tv/pause', { paused });
