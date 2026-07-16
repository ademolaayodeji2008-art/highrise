const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Missing auth token' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const staff = await Staff.findById(payload.id);
    if (!staff || !staff.active) {
      return res.status(401).json({ message: 'Invalid or inactive account' });
    }

    req.staff = staff;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.staff || req.staff.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
