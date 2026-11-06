const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Staff = require('../models/Staff');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { loginLimiter, signupLimiter } = require('../middleware/rateLimit');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

function signStaffToken(staff) {
  return jwt.sign({ id: staff._id, role: staff.role }, process.env.JWT_SECRET, {
    expiresIn: '12h'
  });
}

function findByIdentifier(identifier) {
  const value = identifier.trim();
  return Staff.findOne({ $or: [{ email: value.toLowerCase() }, { phone: value }] });
}

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email/phone and password are required' });
  }

  const staff = await findByIdentifier(identifier);
  if (!staff) {
    return res.status(404).json({ message: 'No account found for that email or phone', code: 'NOT_FOUND' });
  }
  if (!(await staff.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (!staff.active) {
    return res.status(403).json({ message: 'Your account is pending admin approval' });
  }

  const token = signStaffToken(staff);
  res.json({ token, staff: staff.toSafeObject() });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ staff: req.staff.toSafeObject() });
});

// Public: staff self-register. Account is inactive until an admin approves it.
router.post('/signup', signupLimiter, asyncHandler(async (req, res) => {
  const { name, email, phone, password, staffType } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'Name, email, phone and password are required' });
  }

  const existing = await Staff.findOne({
    $or: [{ email: email.toLowerCase().trim() }, { phone: phone.trim() }]
  });
  if (existing) {
    return res.status(409).json({ message: 'An account with this email or phone already exists' });
  }

  const validType = staffType === 'support' ? 'support' : 'professional';
  await Staff.create({ name, email, phone, password, role: 'staff', staffType: validType, active: false });
  res.status(201).json({ message: 'Account created — waiting for admin approval before you can log in' });
}));

// Admin-only: create a staff account directly (active immediately, no approval needed).
router.post('/register', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, staffType } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'Name, email, phone and password are required' });
  }

  const existing = await Staff.findOne({
    $or: [{ email: email.toLowerCase().trim() }, { phone: phone.trim() }]
  });
  if (existing) {
    return res.status(409).json({ message: 'An account with this email or phone already exists' });
  }

  const validType = staffType === 'support' ? 'support' : 'professional';
  const staff = await Staff.create({
    name,
    email,
    phone,
    password,
    role: role === 'admin' ? 'admin' : 'staff',
    staffType: validType,
    active: true
  });

  res.status(201).json({ staff: staff.toSafeObject() });
}));

// Admin-only: update a staff member's staff type (support ↔ professional).
router.patch('/:id/staff-type', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { staffType } = req.body;
  if (!['support', 'professional'].includes(staffType)) {
    return res.status(400).json({ message: 'staffType must be "support" or "professional"' });
  }
  const staff = await Staff.findByIdAndUpdate(req.params.id, { staffType }, { new: true });
  if (!staff) {
    return res.status(404).json({ message: 'Staff account not found' });
  }
  res.json({ staff: staff.toSafeObject() });
}));

// Admin-only: list all active staff (for the "manage staff" screen).
router.get('/staff', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const staff = await Staff.find({ active: true }).select('-password').sort({ name: 1 });
  res.json({ staff });
}));

// Admin-only: reset a staff member's password to a random temporary one.
// There's no self-service reset flow (no email/SMS service configured) — the
// admin relays this temporary password to the staff member directly.
router.post('/:id/reset-password', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) {
    return res.status(404).json({ message: 'Staff account not found' });
  }

  const temporaryPassword = crypto.randomBytes(6).toString('base64url');
  staff.password = temporaryPassword;
  await staff.save();

  res.json({ message: 'Password reset', temporaryPassword, staff: staff.toSafeObject() });
}));

// Admin-only: list accounts awaiting approval.
router.get('/pending', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const staff = await Staff.find({ active: false }).select('-password');
  res.json({ staff });
}));

// Admin-only: approve a pending account.
router.post('/:id/approve', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const staff = await Staff.findByIdAndUpdate(req.params.id, { active: true }, { new: true });
  if (!staff) {
    return res.status(404).json({ message: 'Staff account not found' });
  }
  res.json({ staff: staff.toSafeObject() });
}));

// Admin-only: reject a pending account (or remove any staff account).
router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const staff = await Staff.findByIdAndDelete(req.params.id);
  if (!staff) {
    return res.status(404).json({ message: 'Staff account not found' });
  }
  res.json({ message: 'Account removed' });
}));

module.exports = router;
