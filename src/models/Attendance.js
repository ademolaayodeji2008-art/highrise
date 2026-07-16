const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    checkInTime: Date,
    checkOutTime: Date,
    status: { type: String, enum: ['present', 'late', 'absent'], default: 'present' },
    method: { type: String, default: 'qr' }
  },
  { timestamps: true }
);

// Prevents duplicate check-ins for the same staff/day
attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
