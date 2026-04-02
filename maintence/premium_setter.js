// scripts/set-premium.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// Equivalentes ESM de __dirname e require
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Carrega o JSON do service account
const certPath = path.resolve(__dirname, '..', 'bluey-cast-firebase-adminsdk.json');
const serviceAccount = require(certPath);

const app = initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);

const uid = 'eQTDB5j45WXz4w2sp9kQumO0jXd2';

try {
  const user = await auth.getUser(uid);
  console.log('UID:', user.uid);
  console.log('Custom Claims:', user.customClaims || {});
} catch (err) {
  console.error('Error fetching user:', err);
}

// await auth.setCustomUserClaims(uid, { premium: false });
//  await auth.setCustomUserClaims(uid, { premiumUntil: Date.now() + 60 * 1000 });

console.log(`Claims atualizadas para uid ${uid}`);
process.exit(0);
