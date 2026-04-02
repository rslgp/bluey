// public/js/auth.js — Firebase auth module
import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         GoogleAuthProvider, signInWithPopup,
         signOut as _signOut, onAuthStateChanged,
         getIdToken, getIdTokenResult }         from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let _auth, _provider, _currentUser;

export async function initFirebase() {
  const config = await fetch('/api/firebase-config').then(r => r.json());
  _auth        = getAuth(initializeApp(config));
  _provider    = new GoogleAuthProvider();
}

export function getToken() {
  if (!_currentUser) return null;
  return getIdToken(_currentUser, false);
}

export function getCurrentUserEmail() {
  return _currentUser?.email || '';
}

export async function refreshClaims() {
  if (!_currentUser) return { isPremium: false };
  const result = await getIdTokenResult(_currentUser, true);
  return { isPremium: _isPremiumActive(result.claims) };
}

export function signOut() { return _signOut(_auth); }

export function watchAuthState({ onLogin, onLogout }) {
  onAuthStateChanged(_auth, async (user) => {
    _currentUser = user ?? null;
    if (user) {
      const result = await getIdTokenResult(user, true);
      await onLogin({ user, isPremium: _isPremiumActive(result.claims) });
    } else {
      await onLogout();
    }
  });
}

export function initAuthForms() {
  const authError = document.getElementById('auth-error');
  const showError = msg => { authError.textContent = msg; authError.removeAttribute('hidden'); };
  const clearError = ()  => authError.setAttribute('hidden', '');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      clearError();
    });
  });

  _bindButton('btn-login', async () => {
    clearError();
    await signInWithEmailAndPassword(
      _auth,
      document.getElementById('login-email').value.trim(),
      document.getElementById('login-password').value
    );
  }, showError);

  _bindButton('btn-register', async () => {
    clearError();
    await createUserWithEmailAndPassword(
      _auth,
      document.getElementById('reg-email').value.trim(),
      document.getElementById('reg-password').value
    );
  }, showError);

  ['btn-google-login', 'btn-google-register'].forEach(id => {
    document.getElementById(id).addEventListener('click', async () => {
      clearError();
      try { await signInWithPopup(_auth, _provider); }
      catch (e) { if (e.code !== 'auth/popup-closed-by-user') showError(_friendlyError(e.code)); }
    });
  });

  document.getElementById('btn-logout').addEventListener('click', signOut);
}

function _bindButton(id, action, showError) {
  const btn = document.getElementById(id);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try   { await action(); }
    catch (e) { showError(_friendlyError(e.code)); }
    finally   { btn.disabled = false; }
  });
}

function _isPremiumActive(claims) {
  return claims.premium === true && claims.premiumUntil > Date.now();
}

function _friendlyError(code) {
  return ({
    'auth/user-not-found':       'Usuário não encontrado.',
    'auth/wrong-password':       'Senha incorreta.',
    'auth/invalid-credential':   'Email ou senha inválidos.',
    'auth/email-already-in-use': 'Email já cadastrado.',
    'auth/weak-password':        'Senha muito fraca (mín. 6 caracteres).',
    'auth/invalid-email':        'Email inválido.',
    'auth/too-many-requests':    'Muitas tentativas. Tente novamente mais tarde.',
  })[code] ?? `Erro de autenticação: ${code}`;
}
