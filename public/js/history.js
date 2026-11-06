Auth.requireRole('admin');

document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.logout();
  window.location.href = 'login.html';
});

const historyBody = document.getElementById('history-body');
const form = document.getElementById('filter-form');
const fromInput = document.getElementById('from');
const toInput = document.getElementById('to');
const exportBtn = document.getElementById('export-btn');

let currentRecords = [];

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}

async function loadHistory() {
  historyBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
  const params = new URLSearchParams();
  if (fromInput.value) params.set('from', fromInput.value);
  if (toInput.value) params.set('to', toInput.value);

  try {
    const data = await apiFetch(`/attendance/report?${params.toString()}`);
    currentRecords = data.records;
    if (!data.records.length) {
      historyBody.innerHTML = '<tr><td colspan="7">No records in this range.</td></tr>';
      return;
    }
    historyBody.innerHTML = data.records
      .map((r) => {
        const staff = r.staffId || {};
        const checkIn = r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '-';
        const checkOut = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '-';
        const typeLabel = staff.staffType === 'support' ? 'Support' : 'Professional';
        return `<tr>
          <td data-label="Date">${r.date}</td>
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
    currentRecords = [];
    historyBody.innerHTML = `<tr><td colspan="7">${err.message}</td></tr>`;
  }
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

exportBtn.addEventListener('click', () => {
  if (!currentRecords.length) {
    alert('No records to export for this range.');
    return;
  }
  const header = ['Date', 'Name', 'Email', 'Type', 'Check-in', 'Check-out', 'Status'];
  const rows = currentRecords.map((r) => {
    const staff = r.staffId || {};
    const checkIn = r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '';
    const checkOut = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '';
    const typeLabel = staff.staffType === 'support' ? 'Support' : 'Professional';
    return [r.date, staff.name || 'Unknown', staff.email || '', typeLabel, checkIn, checkOut, r.status];
  });
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${fromInput.value}_to_${toInput.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  loadHistory();
});

// Default to the last 7 days
const today = new Date();
const weekAgo = new Date(today);
weekAgo.setDate(weekAgo.getDate() - 6);
toInput.value = toDateString(today);
fromInput.value = toDateString(weekAgo);

loadHistory();
