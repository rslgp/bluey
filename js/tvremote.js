// public/js/tvremote.js — TV remote control via PeerJS (WebRTC P2P)
// No server relay needed — works over the internet and on GitHub Pages.

const PEER_PREFIX = 'bc'; // namespaces peers on the shared public PeerJS server

const MSG = Object.freeze({ PLAY: 'play', PAUSE: 'pause', RESUME: 'resume', FULLSCREEN: 'fullscreen' });

let _peer     = null;
let _conn     = null;
let _isPaired = false;

function _destroyPeer() {
  _isPaired = false; _conn = null;
  if (_peer) { try { _peer.destroy(); } catch (_) {} _peer = null; }
}

// ── TV side ───────────────────────────────────────────────────────────────────
export function activateTVMode({ onPlay, onPause, onResume }) {
  const tvModePanel = document.getElementById('tv-mode-panel');
  const tvCodeEl    = document.getElementById('tv-code-display');
  const tvStatusEl  = document.getElementById('tv-mode-status');

  _destroyPeer();
  const code = String(Math.floor(1000 + Math.random() * 9000));
  _peer = new Peer(PEER_PREFIX + code, { debug: 0 });

  _peer.on('open', () => {
    tvCodeEl.textContent = code;
    tvModePanel.removeAttribute('hidden');
    tvStatusEl.textContent = 'Aguardando celular…';
  });

  _peer.on('connection', c => {
    _conn = c;
    c.on('open',  () => { _isPaired = true; tvStatusEl.textContent = '📱 Celular conectado!'; });
    c.on('data',  msg => {
      switch (msg.type) {
        case MSG.PLAY:       onPlay(msg.videoId); break;
        case MSG.PAUSE:      onPause?.();         break;
        case MSG.RESUME:     onResume?.();        break;
        case MSG.FULLSCREEN:
          if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
          else document.documentElement.requestFullscreen?.().catch(() => {});
          break;
      }
    });
    c.on('close', () => { _isPaired = false; tvStatusEl.textContent = 'Celular desconectado.'; });
    c.on('error', () => { _isPaired = false; tvStatusEl.textContent = 'Erro de conexão.'; });
  });

  _peer.on('error', err => {
    tvStatusEl.textContent = 'Erro ao gerar código. Recarregue.';
    console.error('[TVRemote] PeerJS error:', err);
  });
}

// ── Phone side ────────────────────────────────────────────────────────────────
export function joinTV(code) {
  return new Promise((resolve, reject) => {
    _destroyPeer();
    _peer = new Peer(undefined, { debug: 0 });
    _peer.on('open', () => {
      _conn = _peer.connect(PEER_PREFIX + String(code), { reliable: true });
      _conn.on('open',  () => { _isPaired = true; resolve(); });
      _conn.on('close', () => { _isPaired = false; });
      _conn.on('error', () => reject(new Error('Conexão falhou')));
      setTimeout(() => { if (!_isPaired) reject(new Error('Timeout')); }, 9000);
    });
    _peer.on('error', () => reject(new Error('Código inválido ou TV offline.')));
  });
}

export function disconnectTV()    { _destroyPeer(); }
export function isConnectedToTV() { return _isPaired; }

// DRY: single send helper for all phone → TV commands
function _send(payload) {
  if (_conn && _conn.open) try { _conn.send(payload); } catch (err) {
    console.error('[TVRemote] Send failed:', err);
  }
}

export const playOnTV      = (videoId) => _send({ type: MSG.PLAY,  videoId });
export const pauseTV       = (paused)  => _send({ type: paused ? MSG.PAUSE : MSG.RESUME });
export const fullscreenTV  = ()        => _send({ type: MSG.FULLSCREEN });
