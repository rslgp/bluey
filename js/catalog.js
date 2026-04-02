// public/js/catalog.js — video grid module

const videoGrid = document.getElementById('video-grid');

let _onPlay, _onUpgrade;

export function initCatalog({ onPlay, onUpgrade }) {
  _onPlay    = onPlay;
  _onUpgrade = onUpgrade;
}

export async function loadCatalog(isPremium) {
  const videos = await fetch('catalog.json').then(r => r.json());
  const mapped = videos.map(v => ({ ...v, locked: v.tier === 'premium' && !isPremium }));

  videoGrid.innerHTML = '';
  _groupByCategory(mapped).forEach(({ category, items }) => {
    videoGrid.appendChild(_buildSeason(category, items));
  });
  return mapped;
}

// ── Group preserving server order ─────────────────────────────────────────────
function _groupByCategory(videos) {
  const map = new Map();
  videos.forEach(v => {
    if (!map.has(v.category)) map.set(v.category, []);
    map.get(v.category).push(v);
  });
  return [...map.entries()].map(([category, items]) => ({ category, items }));
}

// ── Season collapsible block ──────────────────────────────────────────────────
function _buildSeason(category, items) {
  const details  = document.createElement('details');
  details.className = 'season-group';
  details.open   = true;

  const summary  = document.createElement('summary');
  summary.className = 'season-header';
  const free     = items.filter(v => !v.locked).length;
  const total    = items.length;
  summary.innerHTML = `
    <span class="season-title">${category}</span>
    <span class="season-meta">${total} episódios · ${free} grátis</span>
    <span class="season-chevron">▾</span>
  `;
  details.appendChild(summary);

  const grid = document.createElement('div');
  grid.className = 'video-grid';
  items.forEach((v, i) => grid.appendChild(_buildCard(v, i)));
  details.appendChild(grid);

  return details;
}

function _buildCard(v, index) {
  const card = document.createElement('div');
  card.className = `video-card${v.locked ? ' locked' : ''}`;
  card.style.animationDelay = `${index * 0.06}s`;
  card.innerHTML = `
    <div class="card-thumb">
      <img src="${v.thumbnail}" alt="${v.title}" loading="lazy" />
      <span class="card-duration">${v.duration}</span>
      ${v.locked ? `
      <div class="card-lock">
        <span class="card-lock-icon">✦</span>
        <span>Conteúdo Premium</span>
        <button class="card-lock-cta">Assinar agora</button>
      </div>` : ''}
    </div>
    <div class="card-body">
      <p class="card-category">${v.category}</p>
      <h3 class="card-title">${v.title}</h3>
      <p class="card-desc">${v.description}</p>
    </div>
  `;
  if (!v.locked) card.addEventListener('click', () => _onPlay(v.id));
  else card.querySelector('.card-lock-cta')?.addEventListener('click', _onUpgrade);
  return card;
}
