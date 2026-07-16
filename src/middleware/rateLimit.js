const rateLimit = require('express-rate-limit');

// Brute-force protection: limits by IP, not by account, since the account
// may not exist yet (signup) or shouldn't be revealed via a per-account counter (login).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in a few minutes.' }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many signup attempts from this network. Please try again later.' }
});

module.exports = { loginLimiter, signupLimiter };
