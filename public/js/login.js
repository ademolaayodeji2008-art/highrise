const form = document.getElementById('login-form');
const messageEl = document.getElementById('message');
const submitBtn = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = '';
  messageEl.className = 'message';

  const identifier = document.getElementById('identifier').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in…';

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    Auth.saveSession(data);
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next || (data.staff.role === 'admin' ? 'admin.html' : 'scan.html');
  } catch (err) {
    if (err.status === 404) {
      messageEl.textContent = 'No account found — redirecting you to sign up…';
      messageEl.className = 'message info';
      const params = new URLSearchParams();
      if (identifier.includes('@')) params.set('email', identifier);
      else params.set('phone', identifier);
      const next = new URLSearchParams(window.location.search).get('next');
      if (next) params.set('next', next);
      setTimeout(() => {
        window.location.href = `signup.html?${params.toString()}`;
      }, 1200);
      return;
    }
    messageEl.textContent = err.message;
    messageEl.className = 'message error';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
  }
});
