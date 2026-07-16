const jwt = require('jsonwebtoken');
const QrToken = require('../models/QrToken');

// In-memory read cache in front of the DB — checkin is the hottest path in
// the app and shouldn't hit MongoDB on every scan just to re-verify the token.
// The DB row is the source of truth so the token survives server restarts.
let cachedToken = null;

function signToken() {
  return jwt.sign(
    { locationId: process.env.LOCATION_ID || 'default', issuedAt: Date.now() },
    process.env.QR_SECRET
  );
}

async function getCurrentToken() {
  if (cachedToken) return cachedToken;

  let doc = await QrToken.findById('singleton');
  if (!doc) {
    doc = await QrToken.findByIdAndUpdate(
      'singleton',
      { $setOnInsert: { token: signToken() } },
      { upsert: true, new: true }
    );
  }
  cachedToken = doc.token;
  return cachedToken;
}

async function regenerateToken() {
  const token = signToken();
  await QrToken.findByIdAndUpdate('singleton', { token }, { upsert: true });
  cachedToken = token;
  return token;
}

// Signature validity alone isn't enough: since tokens never expire, a
// signature-only check would let old screenshots keep working forever,
// even after an admin regenerates the QR. It must also match the live token.
async function verifyQrToken(token) {
  jwt.verify(token, process.env.QR_SECRET);
  const current = await getCurrentToken();
  if (token !== current) {
    throw new Error('QR token has been superseded');
  }
}

module.exports = { getCurrentToken, regenerateToken, verifyQrToken };
