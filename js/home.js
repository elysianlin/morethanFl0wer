/**
 * home.js — Home page only
 * Scroll-reveal animation, best-seller tab switcher, hero parallax.
 * (Top bar / nav / search / account state all live in header.js,
 * which is loaded on every page including this one.)
 */
/**
 * Build one product card's markup from a flower record.
 * Pulled out as its own function (point #3 — more, smaller
 * functions instead of one giant inline block) so the detail
 * page and the shop grid can reuse the same shape of data.
 */
function buildProductCard(flower, delayClass = '') {
  const article = document.createElement('article');
  article.className = `product-card reveal ${delayClass}`.trim();
  const liked = window.api ? api.wishlist.has(flower.id) : false;
  article.innerHTML = `
    <a href="flower-detail.html?id=${encodeURIComponent(flower.id)}" class="product-link">
      <div class="product-img-wrap" data-img-wrap>
        <img src="${flower.image}" alt="${escapeHtml(flower.name)}" class="product-img" />
        <div class="product-placeholder" aria-hidden="true"></div>
        <button type="button" class="like-btn${liked ? ' liked' : ''}" data-like-id="${flower.id}" aria-pressed="${liked}" aria-label="Like ${escapeHtml(flower.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21C12 21 3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 13-9 13z"/></svg>
        </button>
      </div>
      <p class="product-name">${escapeHtml(flower.name)}</p>
      <p class="product-price">$${flower.priceMin.toFixed(2)} – $${flower.priceMax.toFixed(2)}</p>
    </a>`;
  return article;
}

/** Fetch flowers.json and render the "featured" ones into the home grid. */
async function renderFeaturedFlowers() {
  const grid = document.getElementById('bestSellingGrid');
  if (!grid) return;

  if (window.api?.auth?.ready) await api.auth.ready;

  try {
    const res = await fetch('data/flowers.json');
    const { flowers } = await res.json();
    const featured = flowers.filter((f) => f.featured);

    grid.innerHTML = '';
    featured.forEach((flower, i) => {
      const delay = i === 1 ? 'reveal-delay-1' : i >= 2 ? 'reveal-delay-2' : '';
      const card = buildProductCard(flower, delay);
      grid.appendChild(card);
      // Newly-injected .reveal elements need the image-fallback
      // listener too (header.js already ran for the static DOM).
      card.querySelectorAll('img').forEach((img) => {
        img.addEventListener('error', () => {
          img.closest('[data-img-wrap]')?.classList.add('no-img');
        }, { once: true });
      });
    });

    // Re-observe the freshly added .reveal cards.
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
    );
    grid.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } catch (err) {
    console.error('Failed to load featured flowers', err);
    grid.innerHTML = '<p style="color:var(--muted);font-size:13px;">Flowers could not be loaded right now.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {

  renderFeaturedFlowers();

  /* ── Scroll reveal ──────────────────────────────────────── */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ── Tab switcher (Best Selling Flowers) ───────────────── */
  const tabBar = document.querySelector('.tab-bar');
  if (tabBar) {
    const tabs   = tabBar.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        panels.forEach((panel) => {
          const match = panel.id === `panel-${tab.dataset.tab}`;
          panel.classList.toggle('active', match);
          match ? panel.removeAttribute('hidden') : panel.setAttribute('hidden', '');
          if (match) {
            panel.querySelectorAll('.reveal:not(.visible)').forEach((el) => el.classList.add('visible'));
          }
        });
      });
    });
  }

  /* ── Subtle hero parallax ──────────────────────────────── */
  const heroImg = document.querySelector('.hero-img');
  if (heroImg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', () => {
      heroImg.style.transform = `translateY(${window.scrollY * 0.1}px)`;
    }, { passive: true });
  }
});
