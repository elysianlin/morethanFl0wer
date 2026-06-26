/**
 * toast.js — Lightweight toast notification system
 * ───────────────────────────────────────────────────────
 * Usage from anywhere on the site:
 *   Toast.success('Order placed!', 'We will email your confirmation.');
 *   Toast.error('Something went wrong', 'Please try again.');
 *   Toast.info('Heads up', 'Express delivery adds $9.99.');
 *
 * No HTML markup is required on the page — the stack container
 * is created automatically the first time a toast is shown.
 */
const Toast = (() => {
  let stack = null;

  const ensureStack = () => {
    if (stack) return stack;
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
    return stack;
  };

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12.01" y2="7.5"/></svg>',
  };

  const show = (type, title, message = '', duration = 4200) => {
    const root = ensureStack();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <div class="toast-body">
        <p class="toast-title"></p>
        ${message ? '<p class="toast-msg"></p>' : ''}
      </div>
      <button class="toast-close" aria-label="Dismiss">✕</button>`;

    el.querySelector('.toast-title').textContent = title;
    if (message) el.querySelector('.toast-msg').textContent = message;

    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));

    let timer = setTimeout(() => dismiss(el), duration);

    const dismiss = (node) => {
      clearTimeout(timer);
      node.classList.remove('show');
      node.classList.add('hide');
      setTimeout(() => node.remove(), 250);
    };

    el.querySelector('.toast-close').addEventListener('click', () => dismiss(el));
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(() => dismiss(el), 1800); });

    return el;
  };

  return {
    success: (title, message, duration) => show('success', title, message, duration),
    error:   (title, message, duration) => show('error', title, message, duration),
    info:    (title, message, duration) => show('info', title, message, duration),
  };
})();

// Explicitly attach to window (top-level `const` does not create a
// window property) so every other script can safely check
// `if (window.Toast) …` before a toast is shown.
window.Toast = Toast;
