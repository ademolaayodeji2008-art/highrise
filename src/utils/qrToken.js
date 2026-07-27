const jwt = require('jsonwebtoken');
const QrToken = require('../models/QrToken');

// In-memory read cache in front of the DB — checkin/checkout are the hottest
// paths in the app and shouldn't hit MongoDB on every scan just to re-verify
// the token. The DB row is the source of truth so tokens survive restarts.
// Keyed by type ('checkin' | 'checkout') since each has its own live token.
const cachedTokens = {};

function signToken(type) {
  return jwt.sign(
    { type, locationId: process.env.LOCATION_ID || 'default', issuedAt: Date.now() },
    process.env.QR_SECRET
  );
}

async function getCurrentToken(type) {
  if (cachedTokens[type]) return cachedTokens[type];

  let doc = await QrToken.findById(type);
  if (!doc) {
    doc = await QrToken.findByIdAndUpdate(
      type,
      { $setOnInsert: { token: signToken(type) } },
      { upsert: true, new: true }
    );
  }
  cachedTokens[type] = doc.token;
  return cachedTokens[type];
}

async function regenerateToken(type) {
  const token = signToken(type);
  await QrToken.findByIdAndUpdate(type, { token }, { upsert: true });
  cachedTokens[type] = token;
  return token;
}

// Signature validity alone isn't enough: since tokens never expire, a
// signature-only check would let old screenshots keep working forever,
// even after an admin regenerates the QR. It must also match the live token.
// The `type` claim stops a check-in QR from being replayed at the checkout
// endpoint (or vice versa) even if someone edits the URL by hand.
async function verifyQrToken(token, expectedType) {
  const payload = jwt.verify(token, process.env.QR_SECRET);
  if (payload.type !== expectedType) {
    throw new Error(`This QR code is for ${payload.type === 'checkin' ? 'checking in' : 'checking out'}`);
  }
  const current = await getCurrentToken(expectedType);
  if (token !== current) {
    throw new Error('QR token has been superseded');
  }
}

module.exports = { getCurrentToken, regenerateToken, verifyQrToken };
