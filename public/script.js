let cart = JSON.parse(localStorage.getItem('cart') || '[]');

function save() {
  localStorage.setItem('cart', JSON.stringify(cart));
  draw();
}

function draw() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count ? 'inline-flex' : 'none';
  });

  const box = document.querySelector('.cart-items');
  if (!box) return;

  if (!cart.length) {
    box.innerHTML = '<p class="cart-empty">Корзина пуста</p>';
    document.querySelector('.cart-footer').style.display = 'none';
    return;
  }

  document.querySelector('.cart-footer').style.display = 'block';
  box.innerHTML = cart.map(i => `
    <div class="cart-item">
      <img src="${i.img}" alt="${i.name}">
      <div class="cart-item-info">
        <h4>${i.name}</h4>
        <p class="cart-item-price">₹${i.price} × ${i.qty}</p>
        <div class="qty-control">
          <button onclick="changeQty('${i.name}', -1)">−</button>
          <span>${i.qty}</span>
          <button onclick="changeQty('${i.name}', 1)">+</button>
        </div>
      </div>
      <button class="cart-remove" onclick="removeItem('${i.name}')">✕</button>
    </div>`).join('');

  document.querySelector('.cart-total-price').textContent =
    '₹' + cart.reduce((s, i) => s + i.price * i.qty, 0);
}

function addToCart(name, price, img) {
  const item = cart.find(i => i.name === name);
  if (item) item.qty++;
  else cart.push({ name, price: +price, img, qty: 1 });
  save();
  toast(`«${name}» добавлен в корзину`);
}

function removeItem(name) {
  cart = cart.filter(i => i.name !== name);
  save();
}

function changeQty(name, delta) {
  const item = cart.find(i => i.name === name);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeItem(name);
  else save();
}

function openCart() {
  document.querySelector('.cart-overlay').classList.add('active');
}

function closeCart() {
  document.querySelector('.cart-overlay').classList.remove('active');
}

function checkout() {
  if (!cart.length) return;
  cart = [];
  save();
  closeCart();
  toast('Заказ оформлен! Спасибо 🎉');
}

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2000);
}

draw();

document.querySelectorAll('.add-btn').forEach(btn => {
  btn.onclick = () => addToCart(btn.dataset.name, btn.dataset.price, btn.dataset.img);
});

document.querySelectorAll('.cart-btn').forEach(btn => btn.onclick = openCart);
document.querySelectorAll('.cart-close').forEach(btn => btn.onclick = closeCart);
const overlay = document.querySelector('.cart-overlay');
if (overlay) overlay.onclick = e => { if (e.target === overlay) closeCart(); };

const checkoutBtn = document.querySelector('.checkout-btn');
if (checkoutBtn) checkoutBtn.onclick = checkout;