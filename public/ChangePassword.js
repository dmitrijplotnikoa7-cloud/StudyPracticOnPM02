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

document.getElementById('request-form').onsubmit = async (e) => {
  e.preventDefault();
  const err = document.getElementById('req-error');
  const ok  = document.getElementById('req-ok');
  err.textContent = ''; ok.textContent = '';

  try {
    const data = await post('/newPass', {
      email: document.getElementById('req-email').value.trim()
    });
    ok.textContent = data.message || 'Письмо отправлено';
    document.getElementById('ch-email').value = document.getElementById('req-email').value.trim();
  } catch (ex) {
    err.textContent = ex.message;
  }
};

document.getElementById('change-form').onsubmit = async (e) => {
  e.preventDefault();
  const err = document.getElementById('ch-error');
  const ok  = document.getElementById('ch-ok');
  err.textContent = ''; ok.textContent = '';

  const newPass    = document.getElementById('ch-new').value;
  const newConfirm = document.getElementById('ch-confirm').value;
  if (newPass !== newConfirm) { err.textContent = 'Пароли не совпадают'; return; }

  try {
    const data = await post('/changeNewPass', {
      email:          document.getElementById('ch-email').value.trim(),
      tempPass:       document.getElementById('ch-temp').value.trim(),
      newPass,
      newPassConfirm: newConfirm
    });
    ok.textContent = data.message || 'Пароль изменён';
    setTimeout(() => { location.href = '/login.html'; }, 1200);
  } catch (ex) {
    err.textContent = ex.message;
  }
};