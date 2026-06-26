/**
 * header.js — Shared site chrome
 * Runs on every page: top bar, main nav, mobile drawer, search
 * overlay (with live results from flowers.json), account state,
 * cart badge, sticky-nav shadow, and the global image-fallback
 * handler that replaced every inline onerror="" attribute.
 */
document.addEventListener('DOMContentLoaded', () => {

  /* ── 1. Mark page as JS-loaded (enables reveal hiding) ── */
  document.documentElement.classList.add('js-loaded');
  document.body.classList.add('js-loaded');

  /* ── 2. Global image-fallback handler ──────────────────
     Replaces every inline onerror="this.style.display='none'"
     / onerror="this.parentElement.classList.add('no-img')".
     Any <img> wrapped in an element with [data-img-wrap] gets
     the "no-img" class added to that wrapper on load failure;
     any other <img> just hides itself.                      */
  document.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      const wrap = img.closest('[data-img-wrap]');
      if (wrap) wrap.classList.add('no-img');
      else img.style.display = 'none';
    }, { once: true });
  });

  /* ── 3. Sticky nav shadow on scroll ─────────────────────── */
  const header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 8
        ? '0 2px 16px rgba(44,44,44,0.07)'
        : 'none';
    }, { passive: true });
  }

  /* ── 4. Mobile hamburger ────────────────────────────────── */
  const burger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  if (burger && mobileNav) {
    const closeNav = () => {
      mobileNav.classList.remove('open');
      burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      mobileNav.setAttribute('aria-hidden', 'true');
    };
    burger.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      burger.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
      mobileNav.setAttribute('aria-hidden', String(!isOpen));
    });
    mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeNav));
    document.addEventListener('click', (e) => {
      if (mobileNav.classList.contains('open') &&
          !mobileNav.contains(e.target) &&
          !burger.contains(e.target)) closeNav();
    });
  }

  /* ── 5. Search overlay + live search ───────────────────── */
  const searchToggle  = document.getElementById('searchToggle');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchClose    = document.getElementById('searchClose');
  const searchInput    = searchOverlay?.querySelector('.search-input');
  const searchResults   = searchOverlay?.querySelector('.search-results');

  if (searchToggle && searchOverlay) {
    const openSearch = () => {
      searchOverlay.classList.add('open');
      searchOverlay.setAttribute('aria-hidden', 'false');
      setTimeout(() => searchInput?.focus(), 50);
    };
    const closeSearch = () => {
      searchOverlay.classList.remove('open');
      searchOverlay.setAttribute('aria-hidden', 'true');
    };

    searchToggle.addEventListener('click', openSearch);
    searchClose?.addEventListener('click', closeSearch);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchOverlay.classList.contains('open')) closeSearch();
    });
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) closeSearch();
    });

    /* Live search against data/flowers.json */
    if (searchInput && searchResults) {
      let flowerIndex = null;
      const loadIndex = async () => {
        if (flowerIndex) return flowerIndex;
        try {
          const res = await fetch('data/flowers.json');
          const json = await res.json();
          flowerIndex = json.flowers || [];
        } catch (err) {
          console.error('Search index failed to load', err);
          flowerIndex = [];
        }
        return flowerIndex;
      };

      const renderResults = (matches, query) => {
        searchResults.innerHTML = '';
        if (!query) return;
        if (!matches.length) {
          searchResults.innerHTML = `<p class="search-empty">No flowers match "${escapeHtml(query)}".</p>`;
          return;
        }
        matches.slice(0, 8).forEach((f) => {
          const a = document.createElement('a');
          a.className = 'search-result-item';
          a.href = `flower-detail.html?id=${encodeURIComponent(f.id)}`;
          a.innerHTML = `<span>${escapeHtml(f.name)}</span><span>$${f.priceMin.toFixed(2)}+</span>`;
          searchResults.appendChild(a);
        });
      };

      searchInput.addEventListener('input', async () => {
        const q = searchInput.value.trim().toLowerCase();
        const index = await loadIndex();
        const matches = q
          ? index.filter((f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
          : [];
        renderResults(matches, q);
      });
    }
  }

  /* ── 6. Account state (logged-in name vs. login link) ──── */
  const accountLink = document.getElementById('accountLink');
  if (accountLink && window.api) {
    const user = api.auth.currentUser();
    if (user) {
      accountLink.textContent = `HI, ${user.fullName.split(' ')[0].toUpperCase()}`;
      accountLink.href = 'dashboard.html';
    } else {
      accountLink.textContent = 'ACCOUNT';
      accountLink.href = 'account.html';
    }
  }

  /* ── 7. Cart badge ──────────────────────────────────────── */
  const badge = document.querySelector('.cart-badge');
  if (badge) {
    let count = parseInt(sessionStorage.getItem('cartCount') || '0', 10);
    const update = () => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    };
    update();

    window.addToCart = (qty = 1) => {
      count += qty;
      sessionStorage.setItem('cartCount', count);
      update();
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    };
  }

  /* ── 8. Hero slide counter (home page only) ────────────── */
  const countEl = document.querySelector('.hero-count');
  if (countEl) {
    let current = 1;
    const total = 7;
    setInterval(() => {
      current = current < total ? current + 1 : 1;
      countEl.textContent = `${current} / ${total}`;
    }, 4000);
  }
});

/** Shared escape helper — used by header.js, flowers.js, account.js */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
