/**
 * flower-detail.js — Renders one flower's full detail page.
 * Reads ?id=<flower-id> from the URL, looks it up in
 * data/flowers.json, and fills in the page. No flower data
 * is hardcoded in flower-detail.html — it is 100% JSON-driven.
 */
document.addEventListener('DOMContentLoaded', async () => {

  const root = document.getElementById('detailRoot');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (window.api?.auth?.ready) await api.auth.ready;

  const COLOR_HEX = {
    white: '#ffffff', red: '#A62B1F', pale_pink: '#D9B8B8', deep_pink: '#D16B5F' ,purple: '#D4B8E0',
    green: '#176e1d', yellow: '#D9A05B', orange: '#BF4226', baby_blue:'#99CDF2',blue: '#3F6CA6', navy:'#141A40',dark: '#2C2C2C',
  };

  /* ── Load data ────────────────────────────────────────── */
  let flowers = [];
  try {
    const res = await fetch('data/flowers.json');
    const json = await res.json();
    flowers = json.flowers || [];
  } catch (err) {
    console.error('Could not load flowers.json', err);
    root.innerHTML = '<p style="color:var(--muted)">Could not load flower data. Please refresh.</p>';
    return;
  }

  const flower = flowers.find((f) => f.id === id);

  if (!flower) {
    root.innerHTML = `
      <div style="text-align:center;padding:60px 0;">
        <h1 style="font-family:var(--display);font-size:28px;margin-bottom:10px;">Flower not found</h1>
        <p style="color:var(--muted);margin-bottom:20px;">We couldn't find that item — it may have been removed.</p>
        <a href="flowers.html" class="btn btn-outline">Back to Flowers</a>
      </div>`;
    return;
  }

  document.title = `${flower.name} — More Than Fl0wers`;

  /* ── Build colour dots ──────────────────────────────────── */
  const colorDots = flower.colors.map((c) => {
    const hex = COLOR_HEX[c] || '#ccc';
    const border = (c === 'white') ? 'border:1.5px solid var(--border);' : '';
    return `<span class="detail-color-dot" style="background:${hex};${border}" title="${escapeHtml(cap(c))}"></span>`;
  }).join('');

  root.innerHTML = `
    <nav class="detail-breadcrumb">
      <a href="index.html">Home</a> <span>/</span>
      <a href="flowers.html">Flowers</a> <span>/</span>
      <span aria-current="page">${escapeHtml(flower.name)}</span>
    </nav>

    <div class="detail-grid">
      <div class="detail-img-wrap" data-img-wrap>
        <img src="${flower.image}" alt="${escapeHtml(flower.name)}" class="detail-img" />
      </div>

      <div class="detail-info">
        <h1 class="detail-name">${escapeHtml(flower.name)}</h1>
        <p class="detail-price">$${flower.priceMin.toFixed(2)} – $${flower.priceMax.toFixed(2)}</p>
        <p class="detail-desc">${escapeHtml(flower.description)}</p>

        <div class="detail-meta">
          <div class="detail-meta-row"><strong>Category</strong><span>${cap(flower.category)}</span></div>
          <div class="detail-meta-row"><strong>Availability</strong><span>${flower.stock > 0 ? `${flower.stock} in stock` : 'Made to order'}</span></div>
          <div class="detail-meta-row"><strong>Colors</strong><span class="detail-colors">${colorDots}</span></div>
        </div>

        <div class="detail-meaning"><strong>Symbolism —</strong> ${escapeHtml(flower.meaning)}</div>

        <div class="detail-actions">
          <button class="btn btn-solid" id="addToCartBtn">Add to Cart</button>
          <button type="button" class="like-btn inline" data-like-id="${flower.id}" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21C12 21 3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 13-9 13z"/></svg>
            <span id="likeBtnLabel">Save</span>
          </button>
          <a href="booking.html" class="btn btn-outline">Book a Custom Bouquet</a>
        </div>
      </div>
    </div>

    <section class="detail-related">
      <h2 class="detail-related-title">You Might Also Like</h2>
      <div class="detail-related-grid" id="relatedGrid"></div>
    </section>`;

  root.querySelector('img').addEventListener('error', () => {
    root.querySelector('[data-img-wrap]')?.classList.add('no-img');
  }, { once: true });

  /* ── Add to cart ────────────────────────────────────────── */
  document.getElementById('addToCartBtn')?.addEventListener('click', () => {
    if (window.api) {
      api.cart.add(flower, 1);
      window.refreshHeaderBadges?.({ animateCart: true });
    }
    if (window.Toast) Toast.success('Added to cart', `${flower.name} is in your cart.`);
  });

  /* ── Like button — set its initial state, then header.js's
     delegated listener handles the actual click/toggle.       */
  const likeBtn = root.querySelector('.like-btn');
  if (likeBtn && window.api) {
    const liked = api.wishlist.has(flower.id);
    likeBtn.classList.toggle('liked', liked);
    likeBtn.setAttribute('aria-pressed', String(liked));
    document.getElementById('likeBtnLabel').textContent = liked ? 'Saved' : 'Save';
    likeBtn.addEventListener('click', () => {
      // Run after header.js's listener has flipped the class.
      setTimeout(() => {
        document.getElementById('likeBtnLabel').textContent = likeBtn.classList.contains('liked') ? 'Saved' : 'Save';
      }, 0);
    });
  }

  /* ── Related flowers (same category, excluding self) ────── */
  const relatedGrid = document.getElementById('relatedGrid');
  const related = flowers.filter((f) => f.category === flower.category && f.id !== flower.id).slice(0, 4);

  if (!related.length) {
    relatedGrid.closest('.detail-related').style.display = 'none';
  } else {
    related.forEach((f) => {
      const a = document.createElement('a');
      a.href = `flower-detail.html?id=${encodeURIComponent(f.id)}`;
      a.className = 'fcard-link';
      a.innerHTML = `
        <div class="fcard-img-wrap" data-img-wrap style="margin-bottom:10px;">
          <img src="${f.image}" alt="${escapeHtml(f.name)}" class="fcard-img" />
        </div>
        <p class="fcard-name" style="font-size:14px;">${escapeHtml(f.name)}</p>
        <p class="fcard-price">$${f.priceMin.toFixed(2)} – $${f.priceMax.toFixed(2)}</p>`;
      a.querySelector('img').addEventListener('error', () => {
        a.querySelector('[data-img-wrap]')?.classList.add('no-img');
      }, { once: true });
      relatedGrid.appendChild(a);
    });
  }
});

function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }
