const headingEl = document.getElementById('heading');
const messageEl = document.getElementById('message');
const checkoutBtn = document.getElementById('checkout-btn');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

const QUEUE_KEY = 'qr_attendance_pending_checkins';

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function queueCheckin(entry) {
  const queue = loadQueue();
  queue.push({ ...entry, queuedAt: Date.now() });
  saveQueue(queue);
}

// Retries queued check-ins that failed to reach the server due to no connection.
// A queued item is dropped (not retried forever) if the server responds with a
// real rejection (e.g. the QR was regenerated meanwhile) — only network failure keeps it queued.
async function flushQueue() {
  const queue = loadQueue();
  if (!queue.length || !Auth.token()) return;

  let successCount = 0;
  let i = 0;
  for (; i < queue.length; i++) {
    const entry = queue[i];
    try {
      await apiFetch('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ qrToken: entry.qrToken, lat: entry.lat, lng: entry.lng })
      });
      successCount += 1;
    } catch (err) {
      if (err.status === undefined) {
        break; // still offline — keep this item and the rest for later
      }
      // permanent failure — drop this one, keep going
    }
  }
  saveQueue(queue.slice(i));
  if (successCount > 0) {
    showMessage(`${successCount} queued check-in(s) submitted successfully.`, 'success');
  }
}

const params = new URLSearchParams(window.location.search);
const qrToken = params.get('token');

if (Auth.token()) {
  flushQueue();
}
window.addEventListener('online', flushQueue);

if (!qrToken) {
  headingEl.textContent = 'Invalid link';
  showMessage('This link is missing a check-in code. Ask the office to reshow the QR code.', 'error');
} else if (!Auth.token()) {
  // Not logged in — send to login, then bounce straight back here with the same token.
  const returnTo = encodeURIComponent(`checkin.html?token=${qrToken}`);
  window.location.href = `login.html?next=${returnTo}`;
} else {
  runCheckin();
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => reject(new Error('Location access denied — please allow location and try again')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function runCheckin() {
  let coords;
  try {
    showMessage('Getting your location…', 'info');
    coords = await getPosition();
  } catch (err) {
    headingEl.textContent = 'Check-in failed';
    showMessage(err.message, 'error');
    return;
  }

  try {
    const data = await apiFetch('/attendance/checkin', {
      method: 'POST',
      body: JSON.stringify({ qrToken, lat: coords.latitude, lng: coords.longitude })
    });
    headingEl.textContent = 'You\'re checked in';
    showMessage(data.message, 'success');
    if (!data.attendance.checkOutTime) {
      checkoutBtn.style.display = 'block';
    }
  } catch (err) {
    if (err.status === undefined) {
      queueCheckin({ qrToken, lat: coords.latitude, lng: coords.longitude });
      headingEl.textContent = "You're offline";
      showMessage("No connection right now — we'll check you in automatically once you're back online.", 'info');
    } else {
      headingEl.textContent = 'Check-in failed';
      showMessage(err.message, 'error');
    }
  }
}

checkoutBtn.addEventListener('click', async () => {
  checkoutBtn.disabled = true;
  try {
    const data = await apiFetch('/attendance/checkout', { method: 'POST' });
    headingEl.textContent = 'You\'re checked out';
    showMessage(data.message, 'success');
    checkoutBtn.style.display = 'none';
  } catch (err) {
    showMessage(err.message, 'error');
    checkoutBtn.disabled = false;
  }
});
