// routes/videos.js
const express = require('express');
const router = express.Router();
const { requireAuth, requirePremium } = require('../middleware/authMiddleware');

// Catálogo de vídeos. Em produção, viria de um banco de dados.
const VIDEOS = [
  // ── FREE ──────────────────────────────────────────────────────────────────
  {
    id: 'bluey-s3-ep1',
    title: 'Bluey – Temporada 3, Ep. 1',
    description: 'As aventuras da família Heeler continuam nesta temporada cheia de imaginação.',
    thumbnail: 'https://picsum.photos/seed/bluey1/640/360',
    duration: '07:00',
    tier: 'free',
    url: 'https://dn710004.ca.archive.org/0/items/bluey-dublado-ptbr-temporada3/bluey-s3%2F147200.mp4',
    category: 'Animação',
  },
  {
    id: 'bluey-s3-ep2',
    title: 'Bluey – Temporada 3, Ep. 2',
    description: 'Bluey e Bingo inventam um novo jogo que vai envolver toda a família.',
    thumbnail: 'https://picsum.photos/seed/bluey2/640/360',
    duration: '07:00',
    tier: 'free',
    url: 'https://dn710004.ca.archive.org/0/items/bluey-dublado-ptbr-temporada3/bluey-s3%2F147200.mp4',
    category: 'Animação',
  },
  // ── PREMIUM ───────────────────────────────────────────────────────────────
  {
    id: 'bluey-s3-ep3',
    title: 'Bluey – Temporada 3, Ep. 3 ✦ Premium',
    description: 'Episódio exclusivo para assinantes Premium.',
    thumbnail: 'https://picsum.photos/seed/bluey3/640/360',
    duration: '07:00',
    tier: 'premium',
    url: 'https://dn710004.ca.archive.org/0/items/bluey-dublado-ptbr-temporada3/bluey-s3%2F147200.mp4',
    category: 'Animação',
  },
  {
    id: 'bluey-s3-ep4',
    title: 'Bluey – Temporada 3, Ep. 4 ✦ Premium',
    description: 'Uma aventura especial disponível apenas para membros Premium.',
    thumbnail: 'https://picsum.photos/seed/bluey4/640/360',
    duration: '07:00',
    tier: 'premium',
    url: 'https://dn710004.ca.archive.org/0/items/bluey-dublado-ptbr-temporada3/bluey-s3%2F147200.mp4',
    category: 'Animação',
  },
];

// GET /api/videos  →  lista sem a URL real (protege links premium)
router.get('/', requireAuth, (req, res) => {
  const list = VIDEOS.map(({ url, ...meta }) => ({
    ...meta,
    locked: meta.tier === 'premium' && !req.user.premium,
  }));
  res.json({ videos: list, premium: req.user.premium });
});

// GET /api/videos/:id  →  retorna URL apenas se autorizado
router.get('/:id', requireAuth, (req, res) => {
  const video = VIDEOS.find((v) => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Vídeo não encontrado.' });

  if (video.tier === 'premium' && !req.user.premium) {
    return res.status(403).json({
      error: 'Conteúdo exclusivo Premium.',
      upgrade: true,
    });
  }

  res.json(video);
});

module.exports = router;
