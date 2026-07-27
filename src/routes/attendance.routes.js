const express = require('express');
const Attendance = require('../models/Attendance');
const Staff = require('../models/Staff');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { verifyQrToken } = require('../utils/qrToken');
const { todayString, isAfterCutoff, workingDaysBetween } = require('../utils/date');
const { isWithinOfficeRadius } = require('../utils/geo');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/checkin', requireAuth, asyncHandler(async (req, res) => {
  const { qrToken, lat, lng } = req.body;
  if (!qrToken) {
    return res.status(400).json({ message: 'Missing QR token' });
  }

  try {
    await verifyQrToken(qrToken, 'checkin');
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Invalid QR code' });
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ message: 'Location is required to check in — please allow location access' });
  }

  try {
    const { withinRadius, distance, maxDistance } = isWithinOfficeRadius(lat, lng);
    if (!withinRadius) {
      return res.status(403).json({
        message: `You're too far from the office to check in (${Math.round(distance)}m away, must be within ${maxDistance}m)`
      });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Office location is not configured' });
  }

  const now = new Date();
  const date = todayString(now);

  const existing = await Attendance.findOne({ staffId: req.staff._id, date });
  if (existing) {
    return res.status(200).json({
      message: `Already checked in at ${existing.checkInTime.toLocaleTimeString()}`,
      attendance: existing
    });
  }

  const cutoff = process.env.LATE_CUTOFF || '09:00';
  const status = isAfterCutoff(now, cutoff) ? 'late' : 'present';

  try {
    const attendance = await Attendance.create({
      staffId: req.staff._id,
      date,
      checkInTime: now,
      status,
      method: 'qr'
    });
    return res.status(201).json({
      message: `Checked in at ${now.toLocaleTimeString()}`,
      attendance
    });
  } catch (err) {
    // Unique index race: someone else's request created the record first
    if (err.code === 11000) {
      const record = await Attendance.findOne({ staffId: req.staff._id, date });
      return res.status(200).json({
        message: `Already checked in at ${record.checkInTime.toLocaleTimeString()}`,
        attendance: record
      });
    }
    throw err;
  }
}));

router.post('/checkout', requireAuth, asyncHandler(async (req, res) => {
  const { qrToken, lat, lng } = req.body;
  if (!qrToken) {
    return res.status(400).json({ message: 'Missing QR token' });
  }

  try {
    await verifyQrToken(qrToken, 'checkout');
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Invalid QR code' });
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ message: 'Location is required to check out — please allow location access' });
  }

  try {
    const { withinRadius, distance, maxDistance } = isWithinOfficeRadius(lat, lng);
    if (!withinRadius) {
      return res.status(403).json({
        message: `You're too far from the office to check out (${Math.round(distance)}m away, must be within ${maxDistance}m)`
      });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Office location is not configured' });
  }

  const date = todayString();
  const record = await Attendance.findOne({ staffId: req.staff._id, date });
  if (!record) {
    return res.status(400).json({ message: 'No check-in found for today' });
  }
  if (record.checkOutTime) {
    return res.status(200).json({
      message: `Already checked out at ${record.checkOutTime.toLocaleTimeString()}`,
      attendance: record
    });
  }
  record.checkOutTime = new Date();
  await record.save();
  res.json({ message: `Checked out at ${record.checkOutTime.toLocaleTimeString()}`, attendance: record });
}));

// The logged-in staff's own attendance record for today, if any — lets the
// checkout button appear regardless of whether a fresh QR scan just succeeded.
router.get('/me/today', requireAuth, asyncHandler(async (req, res) => {
  const date = todayString();
  const attendance = await Attendance.findOne({ staffId: req.staff._id, date });
  res.json({ attendance });
}));

router.get('/today', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const date = todayString();
  const records = await Attendance.find({ date }).populate('staffId', 'name email role');
  res.json({ date, records });
}));

router.get('/report', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { staffId, from, to } = req.query;
  const filter = {};
  if (staffId) filter.staffId = staffId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  const records = await Attendance.find(filter)
    .populate('staffId', 'name email role')
    .sort({ date: -1 });
  res.json({ records });
}));

// Per-staff present/late/absent counts over a date range (weekdays only).
router.get('/summary', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: '"from" and "to" dates are required' });
  }
  if (from > to) {
    return res.status(400).json({ message: '"from" must not be after "to"' });
  }

  const workingDays = workingDaysBetween(from, to);
  const staffList = await Staff.find({ active: true }).select('name email');
  const staffIds = staffList.map((s) => s._id);

  const records = await Attendance.find({
    staffId: { $in: staffIds },
    date: { $gte: from, $lte: to }
  });

  const statusByStaffDate = new Map();
  for (const r of records) {
    statusByStaffDate.set(`${r.staffId}_${r.date}`, r.status);
  }

  const summary = staffList.map((staff) => {
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    for (const date of workingDays) {
      const status = statusByStaffDate.get(`${staff._id}_${date}`);
      if (status === 'late') lateCount += 1;
      else if (status === 'present') presentCount += 1;
      else absentCount += 1;
    }
    return {
      staffId: staff._id,
      name: staff.name,
      email: staff.email,
      presentCount,
      lateCount,
      absentCount
    };
  });

  res.json({ from, to, totalWorkingDays: workingDays.length, summary });
}));

module.exports = router;
