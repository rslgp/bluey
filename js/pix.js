// public/js/pix.js — PIX payment modal
import { getToken } from './auth.js';
import { PIX_API_BASE } from './app.js';

const modalPix      = document.getElementById('modal-pix');
const modalClose    = document.getElementById('modal-close');
const pixQrImg      = document.getElementById('pix-qr-img');
const pixBrcode     = document.getElementById('pix-brcode');
const btnCopyPix    = document.getElementById('btn-copy-pix');
const btnCheckPix   = document.getElementById('btn-check-pix');
const btnRetryCheck = document.getElementById('btn-retry-check');
const btnCloseSucc  = document.getElementById('btn-close-success');

const steps = {
  loading: document.getElementById('pix-step-loading'),
  qr:      document.getElementById('pix-step-qr'),
  success: document.getElementById('pix-step-success'),
  error:   document.getElementById('pix-step-error'),
};

let _activeCorrelID = null;
let _pollInterval   = null;
let _onSuccess;

export function initPix({ onSuccess }) {
  _onSuccess = onSuccess;
  modalClose.addEventListener('click',  _closeModal);
  modalPix.addEventListener('click', e => { if (e.target === modalPix) _closeModal(); });
  btnCloseSucc.addEventListener('click', () => { _closeModal(); _onSuccess(); });
  btnCopyPix.addEventListener('click',   _copyBrCode);
  btnCheckPix.addEventListener('click',   _checkStatus);
  btnRetryCheck.addEventListener('click', _checkStatus);
}

export async function openPixModal() {
  _showStep('loading');
  modalPix.removeAttribute('hidden');
  try {
    const token = await getToken();
    const res   = await fetch(`${PIX_API_BASE}/pix/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar cobrança');

    _activeCorrelID = data.correlationID;
    pixQrImg.src    = data.qrCodeImage;
    pixBrcode.value = data.brCode || '';
    document.getElementById('pix-price').textContent =
      Number(data.valueBRL).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    _showStep('qr');
  } catch (err) {
    console.error('[PIX]', err);
    _showStep('error');
  }
}

function _closeModal() {
  modalPix.setAttribute('hidden', '');
  clearInterval(_pollInterval);
  _pollInterval = null;
}

function _showStep(name) {
  Object.values(steps).forEach(el => el.setAttribute('hidden', ''));
  steps[name].removeAttribute('hidden');
}

function _copyBrCode() {
  navigator.clipboard.writeText(pixBrcode.value).then(() => {
    btnCopyPix.textContent = '✓ Copiado';
    setTimeout(() => (btnCopyPix.textContent = 'Copiar'), 2000);
  });
}

async function _checkStatus() {
  if (!_activeCorrelID) return;
  btnCheckPix.disabled    = true;
  btnCheckPix.textContent = 'Verificando…';
  try {
    const token   = await getToken();
    const { premium } = await fetch(`${PIX_API_BASE}/pix/status/${_activeCorrelID}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    _showStep(premium ? 'success' : 'error');
  } catch {
    _showStep('error');
  } finally {
    btnCheckPix.disabled    = false;
    btnCheckPix.textContent = '✓ Já paguei, verificar';
  }
}
