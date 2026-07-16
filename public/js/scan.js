if (!Auth.token()) {
  window.location.href = 'login.html';
}

document.getElementById('greeting').textContent = `Hi, ${Auth.name() || 'there'}`;
document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.logout();
  window.location.href = 'login.html';
});

const messageEl = document.getElementById('message');
let isSubmitting = false;

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
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

async function checkIn(qrToken) {
  if (isSubmitting) return;
  isSubmitting = true;
  try {
    showMessage('Getting your location…', 'info');
    const coords = await getPosition();
    const data = await apiFetch('/attendance/checkin', {
      method: 'POST',
      body: JSON.stringify({ qrToken, lat: coords.latitude, lng: coords.longitude })
    });
    showMessage(data.message, 'success');
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    setTimeout(() => {
      isSubmitting = false;
    }, 3000);
  }
}

// Camera-based scanning (requires HTTPS or localhost)
if (window.Html5Qrcode) {
  const scanner = new Html5Qrcode('reader');
  Html5Qrcode.getCameras()
    .then((cameras) => {
      if (!cameras.length) throw new Error('No camera found');
      const cameraId = cameras[0].id;
      scanner.start(
        cameraId,
        { fps: 10, qrbox: 220 },
        (decodedText) => checkIn(decodedText)
      );
    })
    .catch(() => {
      showMessage('Camera unavailable — use manual entry below.', 'info');
    });
}

document.getElementById('manual-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const value = document.getElementById('manual-token').value.trim();
  if (value) checkIn(value);
});
