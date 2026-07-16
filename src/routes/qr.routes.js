const express = require('express');
const QRCode = require('qrcode');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getCurrentToken, regenerateToken } = require('../utils/qrToken');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// The QR encodes a URL (not a bare token) so any phone's native camera app
// can scan it and land straight on the check-in page.
function checkinUrl(req, token) {
  return `${req.protocol}://${req.get('host')}/checkin.html?token=${encodeURIComponent(token)}`;
}

// Static QR: admin screen loads this once (no polling needed) and re-fetches
// only if the admin explicitly regenerates the code.
router.get('/current', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const token = await getCurrentToken();
  const url = checkinUrl(req, token);
  const qrImageUrl = await QRCode.toDataURL(url);
  res.json({ qrImageUrl, url });
}));

// Invalidate the current QR (e.g. a screenshot leaked) and issue a new one.
router.post('/regenerate', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const token = await regenerateToken();
  const url = checkinUrl(req, token);
  const qrImageUrl = await QRCode.toDataURL(url);
  res.json({ qrImageUrl, url });
}));

module.exports = router;
