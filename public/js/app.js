// public/js/app.js  (ES Module)
// ─── Imports ─────────────────────────────────────────────────────────────────
import { initializeApp }                            from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         GoogleAuthProvider, signInWithPopup,
         signOut, onAuthStateChanged,
         getIdToken, getIdTokenResult }             from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ─── Init — config carregada do servidor (firebase-client.json) ───────────────
const FIREBASE_CONFIG = await fetch('/api/firebase-config').then(r => r.json());
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);
const provider    = new GoogleAuthProvider();

// ─── State ────────────────────────────────────────────────────────────────────
let currentUser    = null;
let idToken        = null;
let isPremium      = false;
let activeCorrelID = null;
let pollInterval   = null;
let mediaRecorder  = null;
let recordedChunks = [];
let castAvailable  = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const screenAuth   = document.getElementById('screen-auth');
const screenApp    = document.getElementById('screen-app');

const loginEmail   = document.getElementById('login-email');
const loginPass    = document.getElementById('login-password');
const btnLogin     = document.getElementById('btn-login');
const btnGoogleL   = document.getElementById('btn-google-login');

const regEmail     = document.getElementById('reg-email');
const regPass      = document.getElementById('reg-password');
const btnRegister  = document.getElementById('btn-register');
const btnGoogleR   = document.getElementById('btn-google-register');

const authError    = document.getElementById('auth-error');

const navBadge     = document.getElementById('nav-badge');
const btnUpgradeN  = document.getElementById('btn-upgrade-nav');
const btnLogout    = document.getElementById('btn-logout');
const catalogUser  = document.getElementById('catalog-user');
const videoGrid    = document.getElementById('video-grid');

const playerSection    = document.getElementById('player-section');
const mainVideo        = document.getElementById('main-video');
const playerTitle      = document.getElementById('player-title');
const btnScreencast    = document.getElementById('btn-screencast');
const btnStopCast      = document.getElementById('btn-stop-cast');
const castStatus       = document.getElementById('cast-status');
const castChromeStatus = document.getElementById('cast-chrome-status');
const castPreviewW     = document.getElementById('cast-preview-wrap');
const castPreview      = document.getElementById('cast-preview');
const castDownload     = document.getElementById('cast-download');

const modalPix      = document.getElementById('modal-pix');
const modalClose    = document.getElementById('modal-close');
const pixQrImg      = document.getElementById('pix-qr-img');
const pixBrcode     = document.getElementById('pix-brcode');
const btnCopyPix    = document.getElementById('btn-copy-pix');
const btnCheckPix   = document.getElementById('btn-check-pix');
const btnRetryCheck = document.getElementById('btn-retry-check');
const btnCloseSucc  = document.getElementById('btn-close-success');

const stepLoading   = document.getElementById('pix-step-loading');
const stepQr        = document.getElementById('pix-step-qr');
const stepSuccess   = document.getElementById('pix-step-success');
const stepError     = document.getElementById('pix-step-error');

// ─── Auth Tabs ────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    clearAuthError();
  });
});

function showAuthError(msg) {
  authError.textContent = msg;
  authError.removeAttribute('hidden');
}
function clearAuthError() { authError.setAttribute('hidden', ''); }

// ─── Auth Handlers ────────────────────────────────────────────────────────────
btnLogin.addEventListener('click', async () => {
  clearAuthError();
  btnLogin.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPass.value);
  } catch (e) {
    showAuthError(friendlyError(e.code));
  } finally {
    btnLogin.disabled = false;
  }
});

btnRegister.addEventListener('click', async () => {
  clearAuthError();
  btnRegister.disabled = true;
  try {
    await createUserWithEmailAndPassword(auth, regEmail.value.trim(), regPass.value);
  } catch (e) {
    showAuthError(friendlyError(e.code));
  } finally {
    btnRegister.disabled = false;
  }
});

[btnGoogleL, btnGoogleR].forEach(btn => {
  btn.addEventListener('click', async () => {
    clearAuthError();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') showAuthError(friendlyError(e.code));
    }
  });
});

btnLogout.addEventListener('click', () => signOut(auth));

function friendlyError(code) {
  const map = {
    'auth/user-not-found':     'Usuário não encontrado.',
    'auth/wrong-password':     'Senha incorreta.',
    'auth/invalid-credential': 'Email ou senha inválidos.',
    'auth/email-already-in-use': 'Email já cadastrado.',
    'auth/weak-password':      'Senha muito fraca (mín. 6 caracteres).',
    'auth/invalid-email':      'Email inválido.',
    'auth/too-many-requests':  'Muitas tentativas. Tente novamente mais tarde.',
  };
  return map[code] || `Erro de autenticação: ${code}`;
}

// ─── Auth State Observer ──────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Força refresh para pegar custom claims atualizadas
    const tokenResult = await getIdTokenResult(user, true);
    isPremium = tokenResult.claims.premium === true;
    idToken   = tokenResult.token;

    screenAuth.classList.remove('active');
    screenApp.classList.add('active');
    updatePremiumUI();
    await loadVideos();
  } else {
    currentUser = null;
    idToken     = null;
    isPremium   = false;
    screenApp.classList.remove('active');
    screenAuth.classList.add('active');
    playerSection.setAttribute('hidden', '');
  }
});

function updatePremiumUI() {
  const email = currentUser?.email || '';
  catalogUser.textContent = email;
  if (isPremium) {
    navBadge.textContent  = '✦ PREMIUM';
    navBadge.className    = 'badge-premium';
    btnUpgradeN.hidden    = true;
  } else {
    navBadge.textContent  = 'FREE';
    navBadge.className    = 'badge-free';
    btnUpgradeN.hidden    = false;
  }
}

async function getToken() {
  if (!currentUser) return null;
  idToken = await getIdToken(currentUser, false);
  return idToken;
}

// ─── Load Videos ─────────────────────────────────────────────────────────────
async function loadVideos() {
  const token = await getToken();
  if (!token) return;

  const res  = await fetch('/api/videos', { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();

  videoGrid.innerHTML = '';
  data.videos.forEach((v, i) => {
    const card = buildCard(v, i);
    videoGrid.appendChild(card);
  });
}

function buildCard(v, index) {
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

  if (!v.locked) {
    card.addEventListener('click', () => playVideo(v.id, v.title));
  } else {
    card.querySelector('.card-lock-cta')?.addEventListener('click', openPixModal);
  }
  return card;
}

// ─── Video Player ─────────────────────────────────────────────────────────────
async function playVideo(id, title) {
  const token = await getToken();
  const res   = await fetch(`/api/videos/${id}`, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 403) {
    const d = await res.json();
    if (d.upgrade) openPixModal();
    return;
  }

  const video = await res.json();
  playerTitle.textContent = title;
  playerSection.removeAttribute('hidden');
  playerSection.scrollIntoView({ behavior: 'smooth' });
  castPreviewW.setAttribute('hidden', '');

  // If a Cast session is active, send to Chromecast
  const castSession = castAvailable &&
    cast.framework.CastContext.getInstance().getCurrentSession();

  if (castSession) {
    const mediaInfo = new chrome.cast.media.MediaInfo(video.url, 'video/mp4');
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = title;
    mediaInfo.streamType = chrome.cast.media.StreamType.BUFFERED;
    try {
      await castSession.loadMedia(new chrome.cast.media.LoadRequest(mediaInfo));
      mainVideo.removeAttribute('src');
    } catch (e) {
      console.error('[Cast] loadMedia error:', e);
      mainVideo.src = video.url;
      mainVideo.play().catch(() => {});
    }
  } else {
    mainVideo.src = video.url;
    mainVideo.play().catch(() => {});
  }
}

// ─── Screencast ───────────────────────────────────────────────────────────────
btnScreencast.addEventListener('click', async () => {
  try {
    // getDisplayMedia captura a tela do usuário
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30, displaySurface: 'monitor' },
      audio: true,
    });

    recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = finishRecording;

    // Para quando o usuário encerra o compartilhamento pelo browser
    stream.getVideoTracks()[0].addEventListener('ended', stopScreencast);

    mediaRecorder.start(1000);

    btnScreencast.setAttribute('hidden', '');
    btnStopCast.removeAttribute('hidden');
    castStatus.textContent = '● Gravando tela…';
    castPreviewW.setAttribute('hidden', '');

  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      castStatus.textContent = 'Erro ao iniciar captura: ' + err.message;
    }
  }
});

btnStopCast.addEventListener('click', stopScreencast);

function stopScreencast() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  btnStopCast.setAttribute('hidden', '');
  btnScreencast.removeAttribute('hidden');
  castStatus.textContent = '';
}

function finishRecording() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url  = URL.createObjectURL(blob);

  castPreview.src = url;
  castDownload.href = url;
  castPreviewW.removeAttribute('hidden');
  castStatus.textContent = '';
}

// ─── PIX Modal ────────────────────────────────────────────────────────────────
btnUpgradeN.addEventListener('click', openPixModal);
modalClose.addEventListener('click',  closePixModal);
modalPix.addEventListener('click', e => { if (e.target === modalPix) closePixModal(); });
btnCloseSucc.addEventListener('click', () => { closePixModal(); refreshAfterPremium(); });

async function openPixModal() {
  showPixStep('loading');
  modalPix.removeAttribute('hidden');

  try {
    const token = await getToken();
    const res   = await fetch('/api/payment/pix/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Erro ao criar cobrança');

    activeCorrelID        = data.correlationID;
    pixQrImg.src          = data.qrCodeImage;
    pixBrcode.value       = data.brCode || '';
    document.getElementById('pix-price').textContent =
      Number(data.valueBRL).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    showPixStep('qr');
  } catch (err) {
    console.error('[PIX]', err);
    showPixStep('error');
  }
}

function closePixModal() {
  modalPix.setAttribute('hidden', '');
  clearInterval(pollInterval);
  pollInterval = null;
}

function showPixStep(step) {
  stepLoading.setAttribute('hidden', '');
  stepQr.setAttribute('hidden', '');
  stepSuccess.setAttribute('hidden', '');
  stepError.setAttribute('hidden', '');
  document.getElementById(`pix-step-${step}`).removeAttribute('hidden');
}

btnCopyPix.addEventListener('click', () => {
  navigator.clipboard.writeText(pixBrcode.value).then(() => {
    btnCopyPix.textContent = '✓ Copiado';
    setTimeout(() => (btnCopyPix.textContent = 'Copiar'), 2000);
  });
});

btnCheckPix.addEventListener('click',   checkPixStatus);
btnRetryCheck.addEventListener('click', checkPixStatus);

async function checkPixStatus() {
  if (!activeCorrelID) return;
  btnCheckPix.disabled = true;
  btnCheckPix.textContent = 'Verificando…';

  try {
    const token = await getToken();
    const res   = await fetch(`/api/payment/pix/status/${activeCorrelID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data  = await res.json();

    if (data.premium) {
      isPremium = true;
      showPixStep('success');
    } else {
      showPixStep('error');
    }
  } catch {
    showPixStep('error');
  } finally {
    btnCheckPix.disabled = false;
    btnCheckPix.textContent = '✓ Já paguei, verificar';
  }
}

async function refreshAfterPremium() {
  // Força refresh do token para pegar o custom claim premium=true
  if (currentUser) {
    const result = await getIdTokenResult(currentUser, true);
    isPremium = result.claims.premium === true;
    idToken   = result.token;
    updatePremiumUI();
    await loadVideos();
  }
}

// ─── Chromecast ───────────────────────────────────────────────────────────────
function initCast() {
  castAvailable = true;
  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy:        chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });

  cast.framework.CastContext.getInstance().addEventListener(
    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
    ({ castState }) => {
      const connected = castState === cast.framework.CastState.CONNECTED;
      castChromeStatus.textContent = connected ? '📺 Transmitindo para TV' : '';
    }
  );
}

// Called by __onGCastApiAvailable (defined in index.html before cast_sender.js)
window._castInit = initCast;
if (window._castAvailable) initCast();
