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
const _tvRooms = new Map(); // code → res

function _genTVCode() {
  let code;
  do { code = String(Math.floor(Math.random() * 9000) + 1000); }
  while (_tvRooms.has(code));
  return code;
}

app.get('/api/tv/register', (req, res) => {
  const code = _genTVCode();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'code', code })}\n\n`);
  _tvRooms.set(code, res);
  req.on('close', () => _tvRooms.delete(code));
});

app.post('/api/tv/join', (req, res) => {
  const { code } = req.body;
  const tvRes = _tvRooms.get(String(code));
  if (!tvRes) return res.status(404).json({ error: 'Código inválido' });
  tvRes.write(`data: ${JSON.stringify({ type: 'phone_connected' })}\n\n`);
  res.json({ ok: true });
});

app.post('/api/tv/play', (req, res) => {
  const { code, videoId } = req.body;
  const tvRes = _tvRooms.get(String(code));
  if (!tvRes) return res.status(410).json({ error: 'Sessão encerrada' });
  tvRes.write(`data: ${JSON.stringify({ type: 'play', videoId })}\n\n`);
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
