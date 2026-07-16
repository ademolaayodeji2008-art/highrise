const form = document.getElementById('signup-form');
const messageEl = document.getElementById('message');

const params = new URLSearchParams(window.location.search);
if (params.get('email')) document.getElementById('email').value = params.get('email');
if (params.get('phone')) document.getElementById('phone').value = params.get('phone');

const next = params.get('next');
if (next) {
  const loginLink = document.getElementById('login-link');
  loginLink.href = `login.html?next=${encodeURIComponent(next)}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = '';
  messageEl.className = 'message';

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password })
    });
    messageEl.textContent = data.message;
    messageEl.className = 'message success';
    form.reset();
  } catch (err) {
    messageEl.textContent = err.message;
    messageEl.className = 'message error';
  }
});
