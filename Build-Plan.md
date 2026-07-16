# QR Staff Attendance System — Build Plan

## 1. Overview

A system where staff scan a QR code (displayed at the office entrance) to automatically mark their attendance for the day. Built on Node.js/Express/MongoDB.

**Core decision:** A **static QR code** (does not rotate) that encodes a check-in link. Screenshot abuse is prevented by a **geolocation check** — staff must be within a configured radius of the office when they check in — plus requiring staff to be logged into their own account. An admin can manually **regenerate** the QR (invalidating the old one) if a screenshot leaks.

---

## 2. Tech Stack

- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas + Mongoose
- **Auth:** JWT (staff login), separate signed JWT for the QR check-in token
- **QR generation:** `qrcode` npm package
- **QR scanning (in-app fallback):** `html5-qrcode` (camera) on `scan.html`
- **Frontend:** Plain HTML/CSS/JS pages served statically by Express, dark-themed, mobile-responsive
- **Admin display screen:** A tablet/monitor at the entrance showing the static QR (`admin.html`)

---

## 3. High-Level Flow

1. Admin screen (`admin.html`) displays a **static QR code**. It encodes a URL: `.../checkin.html?token=<signed token>`.
2. Staff scans it with their **phone's native camera app** (no need to open the app first) — this opens `checkin.html` directly in their browser.
3. If not logged in, `checkin.html` bounces to `login.html?next=...` and returns automatically after login.
4. Once logged in, `checkin.html` automatically requests the phone's GPS location and submits the check-in.
5. Backend validates:
   - Staff JWT is valid and the account is active
   - QR token signature is valid **and** matches the currently-live token (not a stale/regenerated one)
   - GPS coordinates are within `MAX_DISTANCE_METERS` of `OFFICE_LAT`/`OFFICE_LNG`
   - Staff hasn't already checked in today (unique index on `staffId + date`)
6. Backend creates the attendance record, marking `status: 'late'` if past `LATE_CUTOFF`.
7. Staff sees a success message ("Checked in at 8:42 AM") or a specific error (too far away, already checked in, pending approval, etc).

A manual in-app scanner (`scan.html`, camera-based via `html5-qrcode`, with a manual code-paste fallback) remains available as a secondary option.

---

## 4. Data Models

### Staff
```js
const staffSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: String, // hashed with bcrypt
  role: { type: String, enum: ['staff', 'admin'], default: 'staff' },
  active: { type: Boolean, default: true } // false = pending admin approval
});
```
Login accepts **either email or phone** as the identifier.

### Attendance
```js
const attendanceSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true }, // "YYYY-MM-DD"
  checkInTime: Date,
  checkOutTime: Date,
  status: { type: String, enum: ['present', 'late', 'absent'], default: 'present' },
  method: { type: String, default: 'qr' }
});

// Prevents duplicate check-ins for the same staff/day
attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });
```

---

## 5. Account Creation & Approval

There's no manual account-creation step required — staff self-register:

1. Staff fill out `signup.html` (name, email, phone, password) → account is created with `active: false`.
2. Logging in while inactive returns a clear "pending admin approval" message instead of failing silently.
3. Admin sees pending accounts in a table on `admin.html`, with **Approve** / **Reject** buttons.
4. Approving flips `active: true`; rejecting deletes the account.
5. Admins can also be created directly (`POST /api/auth/register`, admin-only) — those are active immediately, no approval needed.
6. Logging in with an email/phone that has no matching account returns a 404, and the login page redirects the user to `signup.html` (prefilled) after a short message.

---

## 6. Backend Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/signup` | POST | Public self-registration (inactive until approved) |
| `/api/auth/login` | POST | Login by email or phone, returns JWT |
| `/api/auth/me` | GET | Current staff profile |
| `/api/auth/register` | POST | Admin creates a staff/admin account directly (active immediately) |
| `/api/auth/pending` | GET | Admin — list accounts awaiting approval |
| `/api/auth/:id/approve` | POST | Admin — activate a pending account |
| `/api/auth/:id` | DELETE | Admin — reject/remove a staff account |
| `/api/qr/current` | GET | Admin — current static QR image + raw check-in URL |
| `/api/qr/regenerate` | POST | Admin — invalidate the current QR and issue a new one |
| `/api/attendance/checkin` | POST | Staff — submit `{ qrToken, lat, lng }` + their JWT → marks attendance |
| `/api/attendance/checkout` | POST | Optional end-of-day checkout |
| `/api/attendance/today` | GET | Admin — who has checked in today |
| `/api/attendance/report` | GET | Admin — attendance history, filterable by `staffId`/`from`/`to` (powers `history.html`) |
| `/api/attendance/summary` | GET | Admin — present/late/absent counts per active staff over `from`/`to` (weekdays only, powers `summary.html`) |

---

## 7. QR Token Logic

- One token is generated per server start (or on-demand regenerate) and kept in memory — it does **not** expire on a timer.
- `verifyQrToken` checks both the JWT signature **and** that the token matches the currently-live one, so regenerating truly invalidates old copies/screenshots.
- The QR image encodes a full URL (`/checkin.html?token=...`), not just the bare token, so any phone's native camera can open it directly.
- `GET /api/qr/current` returns both the QR image (data URL) and the raw link, the latter shown as text under the QR on `admin.html` for easy copy/paste (e.g. to share via chat as a fallback).

---

## 8. Geolocation Check

- `.env` defines `OFFICE_LAT`, `OFFICE_LNG`, `MAX_DISTANCE_METERS` (default 150).
- `checkin.html`/`scan.html` request the phone's GPS via `navigator.geolocation` before submitting.
- Backend computes Haversine distance from the office coordinates and rejects (`403`) check-ins outside the radius.
- Coordinates are looked up once via Google Maps (right-click the office location → copy the lat/lng shown).

---

## 9. Check-in Validation Logic (`POST /api/attendance/checkin`)

1. Verify the staff's own JWT (`requireAuth`) — must be an active account.
2. Verify the QR token: signature valid **and** matches the current live token.
3. Require `lat`/`lng` in the body; reject if missing.
4. Compute distance from the office; reject if outside `MAX_DISTANCE_METERS`.
5. Check today's date — has this `staffId` already got a record for today?
   - If yes → return "Already checked in at [time]" (also backstopped by the DB's unique index in case of a race).
   - If no → create the record.
6. Compare check-in time to `LATE_CUTOFF` (default 09:00) → set `status: 'late'` if applicable.
7. Return a success/error message to the staff's page.

---

## 10. Frontend Pages

| Page | Purpose |
|---|---|
| `login.html` | Login by email or phone; show/hide password toggle; links to signup; redirects to `?next=` after login |
| `signup.html` | Self-registration; prefilled from a failed login attempt if redirected here |
| `admin.html` | Static QR + link, regenerate button, pending-approvals table, today's attendance table |
| `history.html` | Admin — date-range attendance history (defaults to last 7 days), with CSV export |
| `summary.html` | Admin — present/late/absent counts per staff over a date range (defaults to current month) |
| `checkin.html` | Primary check-in landing page — auto geolocation + submit once logged in, offline queue + retry, checkout button once checked in |
| `scan.html` | Secondary in-app camera scanner + manual code entry fallback |

All pages are mobile-responsive (tables scroll horizontally inside their own container rather than the page, QR image scales down, forms use a single-column card layout). A shared SVG favicon (`favicon.svg`) is wired into every page.

---

## 11. Extra Features

- [x] **CSV export** — "Export CSV" button on `history.html`, generates the file client-side from the currently-filtered records
- [x] **Late/absent auto-summary** — `GET /api/attendance/summary?from=&to=` (admin-only) computes present/late/absent counts per active staff member over a date range, counting only weekdays (Mon-Fri) up to today. Surfaced on `summary.html`, defaulting to the current calendar month, linked from `admin.html` and `history.html`.
- [x] **Checkout flow UI** — `checkin.html` shows a "Check out" button once checked in for the day; calls the existing `/api/attendance/checkout` route.
- [x] **Offline queue** — if `checkin.html`'s check-in request fails due to no network connection (not a server rejection), it's queued in `localStorage` and retried automatically on the next page load or when the `online` browser event fires. A queued item is dropped (not retried forever) only if the server actively rejects it once reachable (e.g. the QR was regenerated in the meantime) — pure network failures keep it queued.
- [ ] **Push notification** (FCM) — deliberately skipped. Staff already get an instant on-screen confirmation the moment they check in, and FCM requires a Firebase project + service account credentials that only the site owner can create. Revisit if a real use case comes up (e.g. nudging staff who haven't checked in by a certain time).

---

## 12. Notes

- Keep `QR_SECRET`, `JWT_SECRET`, and Atlas credentials in `.env`, never commit it (already gitignored).
- `date` is stored as a string (`YYYY-MM-DD`) in the DB — simpler than Date-range queries for "today's attendance".
- Async Express route handlers are wrapped in a small `asyncHandler` util — otherwise an unhandled rejection in an async handler crashes the whole Node process instead of returning a 500.
- MongoDB Atlas Network Access must allow the deploying host's IP (or `0.0.0.0/0` for simplicity, at the cost of opening the DB to any IP — auth is still required).
- If deploying, Render works fine — it provides HTTPS automatically, which is required for camera and geolocation access in the browser.
