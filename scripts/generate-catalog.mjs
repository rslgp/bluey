// scripts/generate-catalog.mjs
// Run once: node scripts/generate-catalog.mjs
// Outputs: public/catalog.json
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { meta_info_eps } from '../routes/metadata_videos.js';

const __dir = dirname(fileURLToPath(import.meta.url));

const BASE_URL   = 'https://archive.org/download/bluey-dublado-ptbr-temporada';
const FREE_LIMIT = 5;

function episodeUrl(season, fileId) {
  return `${BASE_URL}${season}/bluey-s${season}%2F${fileId}.mp4`;
}

function range(start, end) {
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

const SEASON_RANGES = [
  { season: 1, fileIds: range(147092, 147142) },
  { season: 2, fileIds: range(147143, 147193) },
  { season: 3, fileIds: [...range(147194, 147230), ...range(186629, 186641)] },
];

const videos = SEASON_RANGES.flatMap(({ season, fileIds }) =>
  fileIds.map((fileId, idx) => {
    const ep        = idx + 1;
    const tier      = ep <= FREE_LIMIT ? 'free' : 'premium';
    const isPremium = tier === 'premium';
    const preview   = meta_info_eps.preview_season[season][idx];
    const rating    = meta_info_eps.rating_season[season][idx];
    return {
      id:          `bluey-s${season}-ep${ep}`,
      title:       `Bluey – Temporada ${season}, Ep. ${ep}${isPremium ? ' ✦ Premium' : ''}`,
      description: isPremium
        ? 'Episódio exclusivo para assinantes Premium.'
        : `Bluey – Temporada ${season}, episódio ${ep}.`,
      thumbnail:   `${preview}`,
      duration:    `⭐${rating} /10`,
      tier,
      category:    `Temporada ${season}`,
      url:         episodeUrl(season, fileId),
    };
  })
);

const outPath = resolve(__dir, '../public/catalog.json');
writeFileSync(outPath, JSON.stringify(videos, null, 2), 'utf8');
console.log(`✓ Wrote ${videos.length} episodes to public/catalog.json`);
