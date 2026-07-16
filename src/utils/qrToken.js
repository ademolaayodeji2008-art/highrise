const jwt = require('jsonwebtoken');

// The QR code is static: we generate one token and keep serving the same
// one until an admin explicitly regenerates it (e.g. after a leaked screenshot).
let currentToken = null;

function generateToken() {
  currentToken = jwt.sign(
    { locationId: process.env.LOCATION_ID || 'default', issuedAt: Date.now() },
    process.env.QR_SECRET
  );
  return currentToken;
}

function getCurrentToken() {
  if (!currentToken) generateToken();
  return currentToken;
}

function regenerateToken() {
  return generateToken();
}

// Signature validity alone isn't enough: since tokens never expire, a
// signature-only check would let old screenshots keep working forever,
// even after an admin regenerates the QR. It must also match the live token.
function verifyQrToken(token) {
  jwt.verify(token, process.env.QR_SECRET);
  if (token !== getCurrentToken()) {
    throw new Error('QR token has been superseded');
  }
}

module.exports = { getCurrentToken, regenerateToken, verifyQrToken };
