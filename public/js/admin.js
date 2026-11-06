Auth.requireRole('admin');

document.getElementById('greeting').textContent = `Welcome, ${Auth.name() || 'Admin'}`;
document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.logout();
  window.location.href = 'login.html';
});

const attendanceBody = document.getElementById('attendance-body');

function qrElements(type) {
  return {
    image: document.getElementById(`qr-image-${type}`),
    status: document.getElementById(`qr-status-${type}`),
    link: document.getElementById(`qr-link-${type}`),
    regenerateBtn: document.getElementById(`regenerate-btn-${type}`)
  };
}

async function loadQr(type) {
  const { image, status, link } = qrElements(type);
  try {
    const data = await apiFetch(`/qr/current?type=${type}`);
    image.src = data.qrImageUrl;
    link.textContent = data.url;
    status.textContent = 'Static QR — stays the same until regenerated';
  } catch (err) {
    status.textContent = err.message;
  }
}

function setupRegenerate(type) {
  const { image, status, link, regenerateBtn } = qrElements(type);
  regenerateBtn.addEventListener('click', async () => {
    regenerateBtn.disabled = true;
    try {
      const data = await apiFetch(`/qr/regenerate?type=${type}`, { method: 'POST' });
      image.src = data.qrImageUrl;
      link.textContent = data.url;
      status.textContent = 'QR regenerated — old copies/screenshots no longer work';
    } catch (err) {
      status.textContent = err.message;
    } finally {
      regenerateBtn.disabled = false;
    }
  });
}

setupRegenerate('checkin');
setupRegenerate('checkout');

const pendingBody = document.getElementById('pending-body');

async function refreshPending() {
  try {
    const data = await apiFetch('/auth/pending');
    if (!data.staff.length) {
      pendingBody.innerHTML = '<tr><td colspan="5">No pending accounts.</td></tr>';
      return;
    }
    pendingBody.innerHTML = data.staff
      .map(
        (s) => `<tr>
          <td data-label="Name">${s.name}</td>
          <td data-label="Email">${s.email}</td>
          <td data-label="Phone">${s.phone}</td>
          <td data-label="Staff Type">${s.staffType === 'support' ? 'Support' : 'Professional'}</td>
          <td data-label="Action">
            <button data-approve="${s._id}" style="width: auto; margin: 0 8px 0 0; padding: 6px 12px;">Approve</button>
            <button data-reject="${s._id}" style="width: auto; margin: 0; padding: 6px 12px; background: #7f1d1d;">Reject</button>
          </td>
        </tr>`
      )
      .join('');
  } catch (err) {
    pendingBody.innerHTML = `<tr><td colspan="5">${err.message}</td></tr>`;
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
      attendanceBody.innerHTML = '<tr><td colspan="6">No check-ins yet today.</td></tr>';
      return;
    }
    attendanceBody.innerHTML = data.records
      .map((r) => {
        const staff = r.staffId || {};
        const checkIn = r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '-';
        const checkOut = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '-';
        const typeLabel = staff.staffType === 'support' ? 'Support' : 'Professional';
        return `<tr>
          <td data-label="Name">${staff.name || 'Unknown'}</td>
          <td data-label="Email">${staff.email || '-'}</td>
          <td data-label="Type">${typeLabel}</td>
          <td data-label="Check-in">${checkIn}</td>
          <td data-label="Check-out">${checkOut}</td>
          <td data-label="Status">${statusBadge(r.status)}</td>
        </tr>`;
      })
      .join('');
  } catch (err) {
    attendanceBody.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
  }
}

// Year-clear form — lets the admin delete all attendance records for a
// previous year to free up storage. The current year is protected server-side.
const clearYearForm = document.getElementById('clear-year-form');
const clearYearMessage = document.getElementById('clear-year-message');

// Default to last year
const currentYear = new Date().getFullYear();
document.getElementById('clear-year').value = currentYear - 1;

clearYearForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearYearMessage.style.display = 'none';

  const year = document.getElementById('clear-year').value;
  if (!year) {
    clearYearMessage.textContent = 'Enter a year to clear';
    clearYearMessage.className = 'message error';
    clearYearMessage.style.display = 'block';
    return;
  }

  if (!confirm(`Delete ALL attendance records for ${year}? This cannot be undone.`)) {
    return;
  }

  try {
    const data = await apiFetch(`/attendance/year/${year}`, { method: 'DELETE' });
    clearYearMessage.textContent = data.message;
    clearYearMessage.className = 'message success';
    clearYearMessage.style.display = 'block';
    refreshAttendance();
  } catch (err) {
    clearYearMessage.textContent = err.message;
    clearYearMessage.className = 'message error';
    clearYearMessage.style.display = 'block';
  }
});

loadQr('checkin');
loadQr('checkout');
refreshAttendance();
refreshPending();
setInterval(refreshAttendance, 15000);
setInterval(refreshPending, 15000);
