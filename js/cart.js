/**
 * cart.js — Cart page: list items, adjust quantity, remove,
 * and a lightweight checkout that saves an order through
 * window.api (same localStorage "backend" booking.js uses).
 */
document.addEventListener('DOMContentLoaded', async () => {
  const listEl    = document.getElementById('cartList');
  const emptyEl    = document.getElementById('cartEmpty');
  const summaryEl  = document.getElementById('cartSummary');
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl    = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  const checkoutForm = document.getElementById('cartCheckoutForm');

  if (!listEl || !window.api) return;
  if (api.auth.ready) await api.auth.ready;

  /* ── Render ───────────────────────────────────────────── */
  const render = () => {
    const items = api.cart.list();

    if (!items.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      summaryEl.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    summaryEl.style.display = '';

    listEl.innerHTML = '';
    items.forEach((item) => listEl.appendChild(buildCartRow(item)));

    const subtotal = api.cart.subtotal();
    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    totalEl.textContent = `$${subtotal.toFixed(2)}`;
  };

  /** One cart row: thumbnail, name, qty stepper, subtotal, remove link. */
  const buildCartRow = (item) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-img"><img src="${item.image}" alt="${escapeHtml(item.name)}" /></div>
      <div>
        <p class="cart-item-name">${escapeHtml(item.name)}</p>
        <p class="cart-item-price">$${item.price.toFixed(2)} each</p>
        <div class="cart-item-qty">
          <button class="qty-btn" type="button" data-dir="-1">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" type="button" data-dir="1">+</button>
        </div>
      </div>
      <div class="cart-item-right">
        <span class="cart-item-subtotal">$${(item.price * item.qty).toFixed(2)}</span>
        <button class="cart-item-remove" type="button">Remove</button>
      </div>`;

    row.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const newQty = item.qty + parseInt(btn.dataset.dir, 10);
        if (newQty < 1) return;
        api.cart.setQty(item.flowerId, newQty);
        window.refreshHeaderBadges?.();
        render();
      });
    });

    row.querySelector('.cart-item-remove').addEventListener('click', () => {
      api.cart.remove(item.flowerId);
      window.refreshHeaderBadges?.();
      Toast?.info('Removed from cart', item.name);
      render();
    });

    return row;
  };

  /* ── Checkout (reveal a small form, then save the order) ── */
  checkoutBtn?.addEventListener('click', () => {
    checkoutForm.classList.add('open');
    checkoutBtn.style.display = 'none';
    const user = api.auth.currentUser();
    if (user) {
      checkoutForm.querySelector('[name="fullName"]').value = user.fullName || '';
      checkoutForm.querySelector('[name="email"]').value = user.email || '';
      checkoutForm.querySelector('[name="phone"]').value = user.phone || '';
      checkoutForm.querySelector('[name="street"]').value = user.address || '';
    }
  });

  checkoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = checkoutForm.querySelector('[name="fullName"]').value.trim();
    const email    = checkoutForm.querySelector('[name="email"]').value.trim();
    const phone    = checkoutForm.querySelector('[name="phone"]').value.trim();
    const street   = checkoutForm.querySelector('[name="street"]').value.trim();

    if (!fullName || !email) {
      Toast?.error('Missing information', 'Please fill in your name and email.');
      return;
    }

    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing order…';

    const items = api.cart.list();
    const payload = {
      customer: { fullName, email, phone },
      orderType: 'shop',
      items,
      delivery: { method: 'standard', street },
      payment: { method: 'credit' },
      total: api.cart.subtotal(),
    };

    try {
      const { ok, order, error } = await api.orders.create(payload);
      if (!ok) throw new Error(error || 'Could not save order.');
      api.cart.clear();
      window.refreshHeaderBadges?.();
      Toast?.success('Order placed!', `Confirmation #${order.id.slice(-6).toUpperCase()} saved to your account.`);
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
    } catch (err) {
      console.error(err);
      Toast?.error('Order failed', 'Something went wrong. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Place Order';
    }
  });

  render();
});
