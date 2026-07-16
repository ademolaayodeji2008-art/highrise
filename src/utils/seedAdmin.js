require('dotenv').config();
const connectDB = require('../config/db');
const Staff = require('../models/Staff');

async function run() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const phone = process.env.SEED_ADMIN_PHONE;
  const name = process.env.SEED_ADMIN_NAME || 'Admin';

  if (!email || !password || !phone) {
    console.error('Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and SEED_ADMIN_PHONE in .env before seeding');
    process.exit(1);
  }

  await connectDB();

  const existing = await Staff.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    if (!existing.phone) {
      existing.phone = phone;
      await existing.save();
      console.log(`Admin already existed, backfilled phone: ${existing.email}`);
    } else {
      console.log(`Admin already exists: ${existing.email}`);
    }
    process.exit(0);
  }

  const admin = await Staff.create({ name, email, phone, password, role: 'admin', active: true });
  console.log(`Admin created: ${admin.email}`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
