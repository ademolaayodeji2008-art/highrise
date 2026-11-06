Auth.requireRole('admin');

document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.logout();
  window.location.href = 'login.html';
});

const staffBody = document.getElementById('staff-body');

function staffTypeLabel(type) {
  return type === 'support' ? 'Support' : 'Professional';
}

async function loadStaff() {
  staffBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
  try {
    const data = await apiFetch('/auth/staff');
    if (!data.staff.length) {
      staffBody.innerHTML = '<tr><td colspan="6">No active staff yet.</td></tr>';
      return;
    }
    staffBody.innerHTML = data.staff
      .map(
        (s) => `<tr>
          <td data-label="Name">${s.name}</td>
          <td data-label="Email">${s.email}</td>
          <td data-label="Phone">${s.phone}</td>
          <td data-label="Role">${s.role}</td>
          <td data-label="Staff Type">
            <select data-type="${s._id}" style="width: auto; margin: 0; padding: 4px 8px; font-size: 0.85rem;">
              <option value="professional" ${s.staffType === 'professional' ? 'selected' : ''}>Professional</option>
              <option value="support" ${s.staffType === 'support' ? 'selected' : ''}>Support</option>
            </select>
          </td>
          <td data-label="Action">
            <button data-reset="${s._id}" data-name="${s.name}" style="width: auto; margin: 0; padding: 6px 12px; background: #334155;">Reset Password</button>
          </td>
        </tr>`
      )
      .join('');
  } catch (err) {
    staffBody.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
  }
}

// Handle staff type changes
staffBody.addEventListener('change', async (e) => {
  const id = e.target.getAttribute('data-type');
  if (!id) return;

  const newType = e.target.value;
  try {
    await apiFetch(`/auth/${id}/staff-type`, {
      method: 'PATCH',
      body: JSON.stringify({ staffType: newType })
    });
  } catch (err) {
    alert(err.message);
    loadStaff();
  }
});

// Handle password reset
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

// Create staff form
const createForm = document.getElementById('create-form');
const createMessage = document.getElementById('create-message');

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  createMessage.style.display = 'none';

  const name = document.getElementById('c-name').value.trim();
  const email = document.getElementById('c-email').value.trim();
  const phone = document.getElementById('c-phone').value.trim();
  const password = document.getElementById('c-password').value;
  const staffType = document.getElementById('c-staffType').value;

  if (!name || !email || !phone || !password) {
    createMessage.textContent = 'All fields are required';
    createMessage.className = 'message error';
    createMessage.style.display = 'block';
    return;
  }

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password, staffType })
    });
    createMessage.textContent = `${name} added successfully.`;
    createMessage.className = 'message success';
    createMessage.style.display = 'block';
    createForm.reset();
    loadStaff();
  } catch (err) {
    createMessage.textContent = err.message;
    createMessage.className = 'message error';
    createMessage.style.display = 'block';
  }
});

loadStaff();
