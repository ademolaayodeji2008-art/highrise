const TOKEN_KEY = 'qr_attendance_token';
const ROLE_KEY = 'qr_attendance_role';
const NAME_KEY = 'qr_attendance_name';

const Auth = {
  saveSession({ token, staff }) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, staff.role);
    localStorage.setItem(NAME_KEY, staff.name);
  },
  token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  role() {
    return localStorage.getItem(ROLE_KEY);
  },
  name() {
    return localStorage.getItem(NAME_KEY);
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(NAME_KEY);
  },
  requireRole(role, redirectTo = 'login.html') {
    if (!Auth.token() || Auth.role() !== role) {
      window.location.href = redirectTo;
    }
  }
};

async function apiFetch(path, options = {}) {
  const headers = Object.assign({}, options.headers, {
    'Content-Type': 'application/json'
  });
  const token = Auth.token();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 401 on a request that carried a token means the session itself is
    // stale (expired/invalid JWT) rather than a one-off error to display
    // inline — send the user back to log in instead of leaving error text
    // scattered across the page.
    if (res.status === 401 && token) {
      Auth.logout();
      const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
      window.location.href = `login.html?next=${next}`;
    }
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}
