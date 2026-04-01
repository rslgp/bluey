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

// Retorna o app para qualquer rota não-API (SPA fallback)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 StreamCast rodando em http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
});
