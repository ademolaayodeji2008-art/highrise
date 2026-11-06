const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['staff', 'admin'], default: 'staff' },
    // Two staff categories with different resumption times:
    //   support      → late after 08:00 (LATE_CUTOFF_SUPPORT)
    //   professional → late after 09:00 (LATE_CUTOFF_PROFESSIONAL)
    staffType: { type: String, enum: ['support', 'professional'], default: 'professional' },
    // Self-registered accounts start inactive until an admin approves them.
    // Accounts an admin creates directly are active immediately (see auth.routes.js).
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

staffSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

staffSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

staffSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    staffType: this.staffType,
    active: this.active
  };
};

module.exports = mongoose.model('Staff', staffSchema);
