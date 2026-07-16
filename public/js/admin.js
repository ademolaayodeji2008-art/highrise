Auth.requireRole('admin');

document.getElementById('greeting').textContent = `Welcome, ${Auth.name() || 'Admin'}`;
document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.logout();
  window.location.href = 'login.html';
});

const qrImage = document.getElementById('qr-image');
const qrStatusEl = document.getElementById('qr-status');
const qrLinkEl = document.getElementById('qr-link');
const attendanceBody = document.getElementById('attendance-body');
const regenerateBtn = document.getElementById('regenerate-btn');

async function loadQr() {
  try {
    const data = await apiFetch('/qr/current');
    qrImage.src = data.qrImageUrl;
    qrLinkEl.textContent = data.url;
    qrStatusEl.textContent = 'Static QR — stays the same until regenerated';
  } catch (err) {
    qrStatusEl.textContent = err.message;
  }
}

regenerateBtn.addEventListener('click', async () => {
  regenerateBtn.disabled = true;
  try {
    const data = await apiFetch('/qr/regenerate', { method: 'POST' });
    qrImage.src = data.qrImageUrl;
    qrLinkEl.textContent = data.url;
    qrStatusEl.textContent = 'QR regenerated — old copies/screenshots no longer work';
  } catch (err) {
    qrStatusEl.textContent = err.message;
  } finally {
    regenerateBtn.disabled = false;
  }
});

const pendingBody = document.getElementById('pending-body');

async function refreshPending() {
  try {
    const data = await apiFetch('/auth/pending');
    if (!data.staff.length) {
      pendingBody.innerHTML = '<tr><td colspan="4">No pending accounts.</td></tr>';
      return;
    }
    pendingBody.innerHTML = data.staff
      .map(
        (s) => `<tr>
          <td>${s.name}</td>
          <td>${s.email}</td>
          <td>${s.phone}</td>
          <td>
            <button data-approve="${s._id}" style="width: auto; margin: 0 8px 0 0; padding: 6px 12px;">Approve</button>
            <button data-reject="${s._id}" style="width: auto; margin: 0; padding: 6px 12px; background: #7f1d1d;">Reject</button>
          </td>
        </tr>`
      )
      .join('');
  } catch (err) {
    pendingBody.innerHTML = `<tr><td colspan="4">${err.message}</td></tr>`;
  }
}

pendingBody.addEventListener('click', async (e) => {
  const approveId = e.target.getAttribute('data-approve');
  const rejectId = e.target.getAttribute('data-reject');
  if (!approveId && !rejectId) return;

  e.target.disabled = true;
  try {
    if (approveId) {
      await apiFetch(`/auth/${approveId}/approve`, { method: 'POST' });
    } else {
      await apiFetch(`/auth/${rejectId}`, { method: 'DELETE' });
    }
    refreshPending();
  } catch (err) {
    alert(err.message);
    e.target.disabled = false;
  }
});

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}

async function refreshAttendance() {
  try {
    const data = await apiFetch('/attendance/today');
    if (!data.records.length) {
      attendanceBody.innerHTML = '<tr><td colspan="4">No check-ins yet today.</td></tr>';
      return;
    }
    attendanceBody.innerHTML = data.records
      .map((r) => {
        const staff = r.staffId || {};
        const time = r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '-';
        return `<tr>
          <td>${staff.name || 'Unknown'}</td>
          <td>${staff.email || '-'}</td>
          <td>${time}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>`;
      })
      .join('');
  } catch (err) {
    attendanceBody.innerHTML = `<tr><td colspan="4">${err.message}</td></tr>`;
  }
}

loadQr();
refreshAttendance();
refreshPending();
setInterval(refreshAttendance, 15000);
setInterval(refreshPending, 15000);
