const mongoose = require('mongoose');

// Single document holding the currently-live QR check-in token, so it
// survives server restarts instead of resetting every time the process does.
const qrTokenSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' },
  token: { type: String, required: true }
});

module.exports = mongoose.model('QrToken', qrTokenSchema);
