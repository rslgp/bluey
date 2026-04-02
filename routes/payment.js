// routes/payment.js
const express = require('express');
const router  = express.Router();
const path    = require('path');
const EfiPay  = require('sdk-node-apis-efi');
const { v4: uuidv4 }       = require('uuid');
const { requireAuth }      = require('../middleware/authMiddleware');
const { getFirebaseAdmin } = require('../middleware/firebase');

const PRICE_BRL = (parseInt(process.env.PREMIUM_PRICE_CENTS || '1990', 10) / 100).toFixed(2);

// ── Guarda cobranças em memória (usar Redis/DB em produção) ───────────────────
const pendingCharges = new Map(); // txid → { uid, locId, status, createdAt }

const CERT_PATH = process.env.EFI_CERT_PATH
  ? path.resolve(process.env.EFI_CERT_PATH)
  : path.resolve(__dirname, '../certs/sandbox.p12');

function getEfi() {
  return new EfiPay({
    sandbox:       process.env.EFI_SANDBOX !== 'false', // true por padrão (homologação)
    client_id:     process.env.EFI_CLIENT_ID,
    client_secret: process.env.EFI_CLIENT_SECRET,
    certificate:   CERT_PATH,
  });
}

/**
 * POST /api/payment/pix/create
 * Cria cobrança PIX imediata via EfiBank e retorna QR code
 */
router.post('/pix/create', requireAuth, async (req, res) => {
  try {
    const efi  = getEfi();

    // txid: 26 a 35 caracteres alfanuméricos
    const txid = `SC${uuidv4().replace(/-/g, '').substring(0, 26).toUpperCase()}`;

    let cobranca;
    // 1. Cria cobrança com txid definido (PUT /v2/cob/:txid)
    try {
       cobranca = await efi.pixCreateCharge(
      { txid },
      {
        calendario:          { expiracao: 3600 },
        devedor:             { nome: req.user.email, cpf: '06891530407' }, // CPF real em produção
        valor:               { original: PRICE_BRL },
        chave:               process.env.EFI_PIX_KEY,
        solicitacaoPagador:  `StreamCast Premium`,
        infoAdicionais: [
          { nome: 'uid',   valor: req.user.uid },
          { nome: 'plano', valor: 'premium_mensal' },
        ],
      }
    );
    } catch (error) {
      console.log(error)
    }
    console.log(cobranca)
    

    const locId = cobranca.loc.id;

    // 2. Gera QR code a partir do loc.id
    const qr = await efi.pixGenerateQRCode({ id: locId });

    // Persiste para consulta posterior
    pendingCharges.set(txid, {
      uid:       req.user.uid,
      txid,
      locId,
      status:    'ATIVA',
      createdAt: Date.now(),
    });

    res.json({
      correlationID: txid,
      qrCodeImage:   qr.imagemQrcode,  // PNG base64 — mesmo campo esperado pelo frontend
      brCode:        qr.qrcode,        // copia e cola
      expiresIn:     3600,
      valueBRL:      PRICE_BRL,
    });

  } catch (err) {
    const detail = err?.response?.data ?? err?.cause ?? err.message;
    console.error('[PIX] EfiBank error:', JSON.stringify(detail, null, 2));
    res.status(502).json({ error: 'Erro ao criar cobrança PIX.', detail });
  }
});

/**
 * GET /api/payment/pix/status/:txid
 * Consulta status da cobrança. Se CONCLUIDA, promove usuário a premium.
 */
router.get('/pix/status/:correlationID', requireAuth, async (req, res) => {
  const txid  = req.params.correlationID;
  const local = pendingCharges.get(txid);

  if (!local || local.uid !== req.user.uid) {
    return res.status(404).json({ error: 'Cobrança não encontrada.' });
  }

  try {
    const efi      = getEfi();
    const cobranca = await efi.pixDetailCharge({ txid });

    // Status EfiBank: 'ATIVA' | 'CONCLUIDA' | 'REMOVIDA_PELO_USUARIO_RECEBEDOR' | 'REMOVIDA_PELO_PSP'
    const status = cobranca.status;

    if (status === 'CONCLUIDA' && local.status !== 'CONCLUIDA') {
      const admin = getFirebaseAdmin();
      const premiumUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await admin.auth().setCustomUserClaims(req.user.uid, { premium: true, premiumUntil });

      local.status = 'CONCLUIDA';
      pendingCharges.set(txid, local);

      return res.json({ status: 'COMPLETED', premium: true, message: 'Parabéns! Conta Premium ativada.' });
    }

    res.json({ status, premium: status === 'CONCLUIDA' });

  } catch (err) {
    console.error('[PIX] Status check error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao verificar pagamento.' });
  }
});

/**
 * POST /api/payment/webhook
 * Webhook EfiBank — configure em: Painel EfiBank > API > Webhook PIX
 * URL: https://seu-dominio.com/api/payment/webhook
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const pixList = req.body?.pix;
    if (!Array.isArray(pixList)) return res.sendStatus(200);

    for (const pix of pixList) {
      const txid  = pix.txid;
      const local = txid && pendingCharges.get(txid);

      if (!local || local.status === 'CONCLUIDA') continue;

      try {
        const admin = getFirebaseAdmin();
        const premiumUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
        await admin.auth().setCustomUserClaims(local.uid, { premium: true, premiumUntil });
        local.status = 'CONCLUIDA';
        pendingCharges.set(txid, local);
        console.log(`[Webhook] Premium ativado uid=${local.uid} txid=${txid}`);
      } catch (err) {
        console.error('[Webhook] Erro ao ativar premium:', err.message);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Webhook] Erro:', err.message);
    res.sendStatus(200); // sempre 200 para o EfiBank não retentar
  }
});

module.exports = router;
