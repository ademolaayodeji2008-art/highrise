const express = require('express');
const QRCode = require('qrcode');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getCurrentToken, regenerateToken } = require('../utils/qrToken');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const PAGE_BY_TYPE = { checkin: 'checkin.html', checkout: 'checkout.html' };

function parseType(req, res) {
  const type = req.query.type || 'checkin';
  if (!PAGE_BY_TYPE[type]) {
    res.status(400).json({ message: '"type" must be "checkin" or "checkout"' });
    return null;
  }
  return type;
}

// The QR encodes a URL (not a bare token) so any phone's native camera app
// can scan it and land straight on the check-in/check-out page.
function qrUrl(req, type, token) {
  return `${req.protocol}://${req.get('host')}/${PAGE_BY_TYPE[type]}?token=${encodeURIComponent(token)}`;
}

// Static QR: admin screen loads this once (no polling needed) and re-fetches
// only if the admin explicitly regenerates the code.
router.get('/current', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const type = parseType(req, res);
  if (!type) return;
  const token = await getCurrentToken(type);
  const url = qrUrl(req, type, token);
  const qrImageUrl = await QRCode.toDataURL(url);
  res.json({ qrImageUrl, url });
}));

// Invalidate the current QR (e.g. a screenshot leaked) and issue a new one.
router.post('/regenerate', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const type = parseType(req, res);
  if (!type) return;
  const token = await regenerateToken(type);
  const url = qrUrl(req, type, token);
  const qrImageUrl = await QRCode.toDataURL(url);
  res.json({ qrImageUrl, url });
}));

module.exports = router;
