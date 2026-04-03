// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Inicializa Firebase Admin antes de qualquer rota
require('./middleware/firebase').getFirebaseAdmin();

const app = express();

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/libs/plyr', express.static(path.join(__dirname, 'node_modules/plyr/dist')));

// Rate limit nas rotas de pagamento
app.use(
  '/api/payment',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  })
);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/videos', require('./routes/videos'));
app.use('/api/payment', require('./routes/payment'));

// Rota de status/health
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// Serve credenciais Firebase Client para o frontend (lidas do .env)
app.get('/api/firebase-config', (_, res) => {
  res.json({
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID,
    measurementId:     process.env.FIREBASE_MEASUREMENT_ID,
  });
});

// ── TV Remote (SSE-based, no extra packages) ──────────────────────────────────
const _tvSessions       = new Map(); // pairingCode → SSE response
const _TV_CODE_MIN      = 1000;
const _TV_CODE_RANGE    = 9000;
const _VALID_CODE_RE    = /^\d{4}$/;

function _generatePairingCode() {
  let code;
  do { code = String(Math.floor(Math.random() * _TV_CODE_RANGE) + _TV_CODE_MIN); }
  while (_tvSessions.has(code));
  return code;
}

// Wraps res.write so a mid-stream disconnect doesn't crash the process
function _sendSSE(res, payload) {
  try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch { /* client gone */ }
}

// Validates code format and resolves the TV session; sends error response if invalid
function _resolveSession(code, res) {
  if (!_VALID_CODE_RE.test(String(code ?? ''))) {
    res.status(400).json({ error: 'Código deve ter 4 dígitos numéricos' });
    return null;
  }
  const tvRes = _tvSessions.get(String(code));
  if (!tvRes) {
    res.status(410).json({ error: 'Sessão encerrada ou código inválido' });
    return null;
  }
  return tvRes;
}

app.get('/api/tv/register', (req, res) => {
  const code = _generatePairingCode();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  _sendSSE(res, { type: 'code', code });
  _tvSessions.set(code, res);
  req.on('close', () => _tvSessions.delete(code));
});

app.post('/api/tv/join', (req, res) => {
  const tvRes = _resolveSession(req.body?.code, res);
  if (!tvRes) return;
  _sendSSE(tvRes, { type: 'phone_connected' });
  res.json({ ok: true });
});

app.post('/api/tv/play', (req, res) => {
  const tvRes = _resolveSession(req.body?.code, res);
  if (!tvRes) return;
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId obrigatório' });
  _sendSSE(tvRes, { type: 'play', videoId });
  res.json({ ok: true });
});

app.post('/api/tv/pause', (req, res) => {
  const tvRes = _resolveSession(req.body?.code, res);
  if (!tvRes) return;
  _sendSSE(tvRes, { type: req.body?.paused ? 'pause' : 'resume' });
  res.json({ ok: true });
});

// Retorna o app para qualquer rota não-API (SPA fallback)
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }else if (req.path === '/bluey') {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }else {
    res.redirect('/bluey');
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 Blueycast rodando em http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
});
