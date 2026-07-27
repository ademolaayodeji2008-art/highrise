const mongoose = require('mongoose');

// One document per QR type ('checkin' / 'checkout') holding its currently-live
// token, so tokens survive restarts instead of resetting every time the process does.
const qrTokenSchema = new mongoose.Schema({
  _id: { type: String }, // 'checkin' or 'checkout'
  token: { type: String, required: true }
});

module.exports = mongoose.model('QrToken', qrTokenSchema);
