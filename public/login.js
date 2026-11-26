document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('register-form').classList.toggle('hidden', isLogin);
  };
});

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || data.message || 'Ошибка запроса');
  return data;
}

document.getElementById('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const err = document.getElementById('login-error');
  err.textContent = '';
  try {
    await post('/api/login', {
      name:     document.getElementById('login-name').value.trim(),
      password: document.getElementById('login-pass').value,
      remember: document.getElementById('login-remember').checked
    });
    location.href = '/';
  } catch (ex) {
    err.textContent = ex.message;
  }
};

document.getElementById('register-form').onsubmit = async (e) => {
  e.preventDefault();
  const err = document.getElementById('reg-error');
  err.textContent = '';

  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-pass').value;
  const pass2    = document.getElementById('reg-pass2').value;

  if (password !== pass2) { err.textContent = 'Пароли не совпадают'; return; }

  try {
    await post('/api/register', { name, email, password, remember: true });
    location.href = '/';
  } catch (ex) {
    err.textContent = ex.message;
  }
};