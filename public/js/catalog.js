// public/js/catalog.js — video grid module
import { getToken } from './auth.js';

const videoGrid = document.getElementById('video-grid');

let _onPlay, _onUpgrade;

export function initCatalog({ onPlay, onUpgrade }) {
  _onPlay    = onPlay;
  _onUpgrade = onUpgrade;
}

export async function loadCatalog() {
  const token = await getToken();
  if (!token) return [];

  const { videos } = await fetch('/api/videos', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());

  videoGrid.innerHTML = '';
  videos.forEach((v, i) => videoGrid.appendChild(_buildCard(v, i)));
  return videos;
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
