/**
 * account.js — Login / Register (account.html) and
 * Dashboard profile + order history (dashboard.html).
 * All persistence goes through window.api (js/api.js).
 */
document.addEventListener('DOMContentLoaded', async () => {

  if (window.api?.auth?.ready) await api.auth.ready;

  /* ════════════════════════════════════════════════════════
     LOGIN / REGISTER PAGE
  ════════════════════════════════════════════════════════ */
  const loginForm    = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm || registerForm) {
    const tabs = document.querySelectorAll('.auth-tab');

    const setActiveTab = (which) => {
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === which));
      loginForm?.classList.toggle('hidden', which !== 'login');
      registerForm?.classList.toggle('hidden', which !== 'register');
      document.getElementById('authSwitchLogin')?.classList.toggle('hidden', which !== 'login');
      document.getElementById('authSwitchRegister')?.classList.toggle('hidden', which !== 'register');
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => setActiveTab(tab.dataset.tab)));
    document.querySelectorAll('[data-switch-tab]').forEach((btn) =>
      btn.addEventListener('click', () => setActiveTab(btn.dataset.switchTab))
    );

    const redirectAfterAuth = () => {
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('redirect') || 'dashboard.html';
    };

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('loginError');
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const submitBtn = loginForm.querySelector('.auth-submit');

      errEl.textContent = '';
      submitBtn.disabled = true; submitBtn.textContent = 'Signing in…';

      const { ok, error } = await api.auth.login({ email, password });
      submitBtn.disabled = false; submitBtn.textContent = 'Sign In';

      if (!ok) {
        errEl.textContent = error;
        Toast?.error('Sign in failed', error);
        return;
      }
      Toast?.success('Welcome back!', "You're now signed in.");
      redirectAfterAuth();
    });

    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('registerError');
      const fullName = document.getElementById('registerName').value;
      const email    = document.getElementById('registerEmail').value;
      const phone    = document.getElementById('registerPhone').value;
      const password = document.getElementById('registerPassword').value;
      const submitBtn = registerForm.querySelector('.auth-submit');

      errEl.textContent = '';
      submitBtn.disabled = true; submitBtn.textContent = 'Creating account…';

      const { ok, error } = await api.auth.register({ fullName, email, phone, password });
      submitBtn.disabled = false; submitBtn.textContent = 'Create Account';

      if (!ok) {
        errEl.textContent = error;
        Toast?.error('Could not create account', error);
        return;
      }
      Toast?.success('Account created!', `Welcome, ${fullName.split(' ')[0]}.`);
      redirectAfterAuth();
    });

    // If already logged in, no reason to see the login page.
    if (window.api && api.auth.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  }

  /* ════════════════════════════════════════════════════════
     DASHBOARD PAGE
  ════════════════════════════════════════════════════════ */
  const dashRoot = document.getElementById('dashRoot');
  if (dashRoot) {
    const user = window.api ? api.auth.currentUser() : null;

    if (!user) {
      window.location.href = 'account.html?redirect=dashboard.html';
      return;
    }

    document.getElementById('dashGreetName').textContent = user.fullName.split(' ')[0];

    document.getElementById('profName').value    = user.fullName || '';
    document.getElementById('profEmail').value   = user.email || '';
    document.getElementById('profPhone').value   = user.phone || '';
    document.getElementById('profAddress').value = user.address || '';

    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const patch = {
        fullName: document.getElementById('profName').value,
        phone: document.getElementById('profPhone').value,
        address: document.getElementById('profAddress').value,
      };
      const { ok, error } = await api.customers.update(user.id, patch);
      if (ok) {
        Toast?.success('Profile updated');
        document.getElementById('dashGreetName').textContent = patch.fullName.split(' ')[0];
      } else {
        Toast?.error('Could not save profile', error);
      }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await api.auth.logout();
      Toast?.info('Signed out', 'See you again soon!');
      setTimeout(() => { window.location.href = 'index.html'; }, 500);
    });

    renderOrderHistory(user.id);
  }
});

/** Pulls every order tied to this customer out of the "API" and renders it. */
async function renderOrderHistory(customerId) {
  const list = document.getElementById('orderList');
  if (!list) return;

  const orders = await api.orders.listByCustomer(customerId);

  if (!orders.length) {
    list.innerHTML = `<p class="dash-empty">No orders yet. <a href="booking.html" style="text-decoration:underline;">Book your first bouquet →</a></p>`;
    return;
  }

  list.innerHTML = '';
  const typeLabel = { custom: 'Fully Customized', template: 'Template Bouquet', surprise: 'Surprise Bouquet' };

  orders.forEach((order) => {
    const div = document.createElement('div');
    div.className = 'order-item';
    const date = new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    div.innerHTML = `
      <div class="order-item-top">
        <span class="order-item-id">#${order.id.slice(-6).toUpperCase()}</span>
        <span class="order-item-date">${date}</span>
      </div>
      <p class="order-item-title">${typeLabel[order.orderType] || 'Bouquet'}</p>
      <p class="order-item-detail">Delivery: ${escapeHtml(order.delivery?.method || 'standard')}${order.delivery?.date ? ' · ' + escapeHtml(order.delivery.date) : ''}</p>
      <div class="order-item-bottom">
        <span class="order-item-total">$${(order.total || 0).toFixed(2)}</span>
        <span class="order-status">${escapeHtml(order.status || 'received')}</span>
      </div>`;
    list.appendChild(div);
  });
}
