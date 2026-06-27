/**
 * header.js — Shared site chrome
 * Runs on every page: top bar, main nav, mobile drawer, search
 * overlay (with live results from flowers.json), account state,
 * cart badge, sticky-nav shadow, and the global image-fallback
 * handler that replaced every inline onerror="" attribute.
 */
document.addEventListener('DOMContentLoaded', async () => {

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
    if (api.auth.ready) await api.auth.ready;
    const user = api.auth.currentUser();
    if (user) {
      accountLink.textContent = `HI, ${user.fullName.split(' ')[0].toUpperCase()}`;
      accountLink.href = 'dashboard.html';
    } else {
      accountLink.textContent = 'ACCOUNT';
      accountLink.href = 'account.html';
    }
  }

  /* ── 7. Cart + wishlist badges ──────────────────────────────
     Both badges are driven by js/api.js (cart/wishlist live in
     localStorage, keyed to the current customer or guest id), so
     counts are accurate even after a refresh or a new page load —
     no more sessionStorage counter that resets itself.            */
  const cartBadge      = document.querySelector('.cart-badge');
  const wishlistBadge  = document.querySelector('.wishlist-badge');
  const wishlistLink   = document.querySelector('.wishlist-link');

  const bump = (el) => {
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  };

  const paintBadge = (el, count) => {
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  };

  /** Re-reads counts from api.js and repaints both badges. Exposed
   *  globally so flowers.js / flower-detail.js / home.js / cart.js
   *  can call it right after they change the cart or wishlist.    */
  window.refreshHeaderBadges = ({ animateCart = false, animateWishlist = false } = {}) => {
    if (!window.api) return;
    paintBadge(cartBadge, api.cart.count());
    paintBadge(wishlistBadge, api.wishlist.count());
    if (animateCart) bump(cartBadge);
    if (animateWishlist) bump(wishlistBadge);
  };

  if (wishlistLink) wishlistLink.href = 'wishlist.html';
  window.refreshHeaderBadges();

  /* ── 7b. Like buttons — any element with [data-like-id] ────
     Works on shop cards, the home grid, and the detail page alike.
     Markup is injected by each page's own JS (flowers.js, home.js,
     flower-detail.js); this single delegated listener handles all
     of them so the click logic only has to exist once.            */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-like-id]');
    if (!btn || !window.api) return;
    e.preventDefault();
    e.stopPropagation();

    const { liked, count } = api.wishlist.toggle(btn.dataset.likeId);
    btn.classList.toggle('liked', liked);
    btn.setAttribute('aria-pressed', String(liked));
    window.refreshHeaderBadges({ animateWishlist: true });
    if (window.Toast) {
      liked ? Toast.success('Added to wishlist') : Toast.info('Removed from wishlist');
    }
    // On the wishlist page itself, unliking an item removes its card immediately.
    if (!liked && document.getElementById('wishlistGrid')) {
      const card = btn.closest('[data-wishlist-card]');
      card?.remove();
      if (count === 0) {
        document.getElementById('wishlistGrid').style.display = 'none';
        document.getElementById('wishlistEmpty').style.display = 'block';
      }
    }
  });

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
