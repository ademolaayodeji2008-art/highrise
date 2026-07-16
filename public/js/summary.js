Auth.requireRole('admin');

document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.logout();
  window.location.href = 'login.html';
});

const summaryBody = document.getElementById('summary-body');
const rangeInfoEl = document.getElementById('range-info');
const form = document.getElementById('filter-form');
const fromInput = document.getElementById('from');
const toInput = document.getElementById('to');

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

async function loadSummary() {
  summaryBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  rangeInfoEl.textContent = '';

  const params = new URLSearchParams({ from: fromInput.value, to: toInput.value });

  try {
    const data = await apiFetch(`/attendance/summary?${params.toString()}`);
    rangeInfoEl.textContent = `${data.totalWorkingDays} working day(s) (Mon-Fri) in this range`;

    if (!data.summary.length) {
      summaryBody.innerHTML = '<tr><td colspan="5">No active staff found.</td></tr>';
      return;
    }
    summaryBody.innerHTML = data.summary
      .map(
        (s) => `<tr>
          <td>${s.name}</td>
          <td>${s.email}</td>
          <td>${s.presentCount}</td>
          <td>${s.lateCount}</td>
          <td>${s.absentCount}</td>
        </tr>`
      )
      .join('');
  } catch (err) {
    summaryBody.innerHTML = `<tr><td colspan="5">${err.message}</td></tr>`;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  loadSummary();
});

// Default to the current calendar month
const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
toInput.value = toDateString(today);
fromInput.value = toDateString(monthStart);

loadSummary();
