// middleware/authMiddleware.js
const { getFirebaseAdmin } = require('./firebase');

/**
 * Verifica o Firebase ID Token no header Authorization: Bearer <token>
 * Adiciona req.user com uid, email e claims (incluindo premium)
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  const token = header.split('Bearer ')[1];
  try {
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      premium: decoded.premium === true,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

/**
 * Exige conta premium (custom claim: premium === true)
 */
function requirePremium(req, res, next) {
  if (!req.user?.premium) {
    return res.status(403).json({
      error: 'Conteúdo exclusivo para assinantes Premium.',
      upgrade: true,
    });
  }
  next();
}

module.exports = { requireAuth, requirePremium };
