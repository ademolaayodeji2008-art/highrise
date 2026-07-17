Auth.requireRole('admin');

document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.logout();
  window.location.href = 'login.html';
});

const staffBody = document.getElementById('staff-body');

async function loadStaff() {
  staffBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  try {
    const data = await apiFetch('/auth/staff');
    if (!data.staff.length) {
      staffBody.innerHTML = '<tr><td colspan="5">No active staff yet.</td></tr>';
      return;
    }
    staffBody.innerHTML = data.staff
      .map(
        (s) => `<tr>
          <td data-label="Name">${s.name}</td>
          <td data-label="Email">${s.email}</td>
          <td data-label="Phone">${s.phone}</td>
          <td data-label="Role">${s.role}</td>
          <td data-label="Action">
            <button data-reset="${s._id}" data-name="${s.name}" style="width: auto; margin: 0; padding: 6px 12px; background: #334155;">Reset Password</button>
          </td>
        </tr>`
      )
      .join('');
  } catch (err) {
    staffBody.innerHTML = `<tr><td colspan="5">${err.message}</td></tr>`;
  }
}

staffBody.addEventListener('click', async (e) => {
  const id = e.target.getAttribute('data-reset');
  if (!id) return;

  const name = e.target.getAttribute('data-name');
  if (!confirm(`Reset ${name}'s password? Their current password will stop working immediately.`)) {
    return;
  }

  e.target.disabled = true;
  try {
    const data = await apiFetch(`/auth/${id}/reset-password`, { method: 'POST' });
    alert(
      `New temporary password for ${name}:\n\n${data.temporaryPassword}\n\nShare this with them directly — it won't be shown again.`
    );
  } catch (err) {
    alert(err.message);
  } finally {
    e.target.disabled = false;
  }
});

loadStaff();
