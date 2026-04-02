// routes/videos.js
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { meta_info_eps } = require('./metadata_videos');
 
const BASE_URL    = 'https://archive.org/download/bluey-dublado-ptbr-temporada';
const FREE_LIMIT  = 5; // free episodes per season

// ── URL builder ───────────────────────────────────────────────────────────────
function episodeUrl(season, fileId) {
  return `${BASE_URL}${season}/bluey-s${season}%2F${fileId}.mp4`;
}

// ── Range generator: [start, end] inclusive ───────────────────────────────────
function range(start, end) {
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

// ── Season definitions ────────────────────────────────────────────────────────
const SEASON_RANGES = [
  { season: 1, fileIds: range(147092, 147142) },
  { season: 2, fileIds: range(147143, 147193) },
  { season: 3, fileIds: [...range(147194, 147230), ...range(186629, 186641)] },
];

// ── Build catalog at startup (static — no per-request allocation) ─────────────
const VIDEOS = SEASON_RANGES.flatMap(({ season, fileIds }) =>
  fileIds.map((fileId, idx) => {
    const ep        = idx + 1;
    const tier      = ep <= FREE_LIMIT ? 'free' : 'premium';
    const isPremium = tier === 'premium';
    const preview = meta_info_eps.preview_season[season][idx]
    const rating = meta_info_eps.rating_season[season][idx]
    return {
      id:          `bluey-s${season}-ep${ep}`,
      title:       `Bluey – Temporada ${season}, Ep. ${ep}${isPremium ? ' ✦ Premium' : ''}`,
      description: isPremium
        ? `Episódio exclusivo para assinantes Premium.`
        : `Bluey – Temporada ${season}, episódio ${ep}.`,
      // thumbnail:   `https://picsum.photos/seed/bluey-s${season}e${ep}/640/360`,
      thumbnail: `${preview}`,
      duration:    `⭐${rating} /10`,
      tier,
      category:    `Temporada ${season}`,
      url:         episodeUrl(season, fileId),
    };
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const videos = VIDEOS.map(({ url, ...meta }) => ({
    ...meta,
    locked: meta.tier === 'premium' && !req.user.premium,
  }));
  res.json({ videos, premium: req.user.premium });
});

router.get('/:id', requireAuth, (req, res) => {
  const video = VIDEOS.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Vídeo não encontrado.' });

  if (video.tier === 'premium' && !req.user.premium) {
    return res.status(403).json({ error: 'Conteúdo exclusivo Premium.', upgrade: true });
  }

  res.json(video);
});

module.exports = router;
