document.addEventListener('DOMContentLoaded', async () => {
  let user;
  try {
    const r = await fetch('/api/me');
    if (!r.ok) return;
    ({ user } = await r.json());
  } catch { return; }

  const nav = document.querySelector('.nav-container');
  if (!nav) return;

  const box = document.createElement('div');
  box.className = 'user-box';
  box.innerHTML = `
    <span class="user-name">👤 ${escapeHtml(user.name)}</span>
    <button class="logout-btn" type="button">Выйти</button>
  `;
  nav.appendChild(box);

  box.querySelector('.logout-btn').onclick = async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch {}
    location.href = '/login.html';
  };
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}