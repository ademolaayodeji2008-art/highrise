# QR Staff Attendance System

Staff check in for the day by scanning a static QR code displayed at the office entrance. Built with Node.js, Express, and MongoDB.

See [Build-Plan.md](Build-Plan.md) for the full design and feature breakdown.

## How it works

1. The office display (`admin.html`) shows a static QR code. It encodes a link to the check-in page.
2. Staff scan it with their phone's camera — no need to open an app first.
3. If they're not logged in, they're sent to log in (or sign up), then bounced straight back to finish checking in.
4. The check-in page grabs the phone's GPS location and submits it along with the scanned code.
5. The server verifies: the staff's own login, that the QR code is still the current one (not an old screenshot), and that the phone is within range of the office — then records the attendance.

## Features

- Static QR check-in with geolocation verification (screenshot-proof: an old code stops working once regenerated, and check-ins are rejected if too far from the office)
- Staff self-registration, held for admin approval before the account can log in
- Login by email or phone
- Admin screen: live QR + regenerate button, pending-approval queue, today's attendance
- Attendance history (date-range filter + CSV export) and a present/late/absent summary report
- Checkout flow, offline check-in queue (retries automatically once back online)
- Rate-limited login/signup endpoints

## Setup

```bash
npm install
cp .env.example .env   # fill in your own values, see below
npm run seed:admin     # creates the first admin account, from SEED_ADMIN_* in .env
npm run dev            # starts the server with nodemon
```

### Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `PORT` | Port the server listens on |
| `MONGO_URI` | MongoDB connection string (e.g. from MongoDB Atlas) |
| `JWT_SECRET` | Signs staff login tokens |
| `QR_SECRET` | Signs the QR check-in token (keep separate from `JWT_SECRET`) |
| `LOCATION_ID` | Label embedded in the QR token (useful for multi-branch setups) |
| `LATE_CUTOFF` | 24h `HH:mm` — check-ins after this are marked `late` |
| `OFFICE_LAT` / `OFFICE_LNG` | Office coordinates — right-click the location on Google Maps to get these |
| `MAX_DISTANCE_METERS` | How far (meters) a check-in is allowed to be from the office |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_PHONE` / `SEED_ADMIN_NAME` | Used only by `npm run seed:admin` to create the first admin account |

Never commit `.env` — it's already gitignored.

## Deployment

Any Node host works; the app needs HTTPS in production (camera and geolocation access require it). Render is a simple option — connect this repo, set the build command to `npm install` and the start command to `node server.js`, then add the same environment variables as above in its dashboard.

MongoDB Atlas needs the deploying host's outbound IP allowed under Network Access.
