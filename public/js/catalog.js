// public/js/catalog.js — video grid module

const videoGrid     = document.getElementById('video-grid');
const seasonSelect  = document.getElementById('filter-season');
const episodeSelect = document.getElementById('filter-episode');

const PAGE_SIZE = 10;

let _onPlay, _onUpgrade;
let _allVideos = [];

export function initCatalog({ onPlay, onUpgrade }) {
  _onPlay    = onPlay;
  _onUpgrade = onUpgrade;

  seasonSelect.addEventListener('change', () => {
    _populateEpisodes();
    _render();
  });
  episodeSelect.addEventListener('input', _render);
}

export async function loadCatalog(isPremium) {
  const videos = await fetch('catalog.json').then(r => r.json());
  _allVideos = videos.map(v => ({ ...v, locked: v.tier === 'premium' && !isPremium }));
  _renderContinueBanner();
  _render();
  return _allVideos;
}

export function getLastEpisodeId() {
  return localStorage.getItem('bluey_last_ep');
}

function _renderContinueBanner() {
  const existing = document.getElementById('continue-banner');
  if (existing) existing.remove();

  const lastId = localStorage.getItem('bluey_last_ep');
  if (!lastId) return;

  const video = _allVideos.find(v => v.id === lastId);
  if (!video) return;

  const banner = document.createElement('div');
  banner.id = 'continue-banner';
  banner.className = 'continue-banner';
  banner.innerHTML = `
    <span class="continue-label continue-btn">Continuar assistindo</span>
    <button class="continue-btn">${video.title}</button>
    <button class="continue-dismiss" title="Dispensar">✕</button>
  `;
  banner.querySelector('.continue-btn').addEventListener('click', () => {
    _onPlay(video.id);
  });
  banner.querySelector('.continue-dismiss').addEventListener('click', () => {
    localStorage.removeItem('bluey_last_ep');
    banner.remove();
  });

  videoGrid.parentElement.insertBefore(banner, videoGrid);
}

// ── Populate episode input max for selected season ───────────────────────────
function _populateEpisodes() {
  const season = seasonSelect.value;
  episodeSelect.value = '';

  if (!season) {
    episodeSelect.disabled = true;
    episodeSelect.removeAttribute('max');
    return;
  }

  const count = _allVideos.filter(v => v.category === season).length;
  episodeSelect.max     = count;
  episodeSelect.disabled = false;
}

// ── Render grid based on current filter selections ───────────────────────────
function _render() {
  const season  = seasonSelect.value;
  const epNum   = parseInt(episodeSelect.value, 10);

  let filtered = _allVideos;
  if (season) filtered = filtered.filter(v => v.category === season);

  // epNum: find the Nth episode within the filtered season list
  const targetVideo = (season && epNum >= 1)
    ? filtered[epNum - 1] ?? null
    : null;

  if (targetVideo) filtered = [targetVideo];

  videoGrid.innerHTML = '';

  if (filtered.length === 0) {
    videoGrid.innerHTML = '<p class="search-empty">Nenhum episódio encontrado.</p>';
    return;
  }

  if (targetVideo) {
    const grid = document.createElement('div');
    grid.className = 'video-grid';
    filtered.forEach((v, i) => grid.appendChild(_buildCard(v, i)));
    videoGrid.appendChild(grid);
  } else {
    _groupByCategory(filtered).forEach(({ category, items }) => {
      videoGrid.appendChild(_buildSeason(category, items));
    });
  }
}

// ── Group preserving order ────────────────────────────────────────────────────
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

  let shown = 0;

  function renderMore() {
    const batch = items.slice(shown, shown + PAGE_SIZE);
    batch.forEach((v, i) => grid.appendChild(_buildCard(v, shown + i)));
    shown += batch.length;

    const old = details.querySelector('.btn-show-more');
    if (old) old.remove();

    if (shown < items.length) {
      const btn = document.createElement('button');
      btn.className = 'btn-show-more';
      btn.textContent = `Ver mais (${items.length - shown} restantes)`;
      btn.addEventListener('click', renderMore);
      details.appendChild(btn);
    }
  }

  details.appendChild(grid);
  renderMore();

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
