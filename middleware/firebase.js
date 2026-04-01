// middleware/firebase.js
const admin = require('firebase-admin');
const path  = require('path');

let app;

function getFirebaseAdmin() {
  if (!app) {
    const certPath = path.resolve(__dirname, '..', 'bluey-cast-firebase-adminsdk.json');
    const serviceAccount = require(certPath);

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin;
}

module.exports = { getFirebaseAdmin };
