/**
 * wishlist.js — Renders every flower the current customer/guest
 * has liked, by cross-referencing api.wishlist.list() (an array
 * of flower ids) against data/flowers.json.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const grid  = document.getElementById('wishlistGrid');
  const empty = document.getElementById('wishlistEmpty');
  if (!grid || !window.api) return;

  if (api.auth.ready) await api.auth.ready;

  const likedIds = api.wishlist.list();

  if (!likedIds.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  let flowers = [];
  try {
    const res = await fetch('data/flowers.json');
    const json = await res.json();
    flowers = json.flowers || [];
  } catch (err) {
    console.error('Could not load flowers.json', err);
    grid.innerHTML = '<p style="color:var(--muted)">Could not load your wishlist. Please refresh.</p>';
    return;
  }

  const liked = likedIds.map((id) => flowers.find((f) => f.id === id)).filter(Boolean);

  if (!liked.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.innerHTML = '';
  liked.forEach((flower) => grid.appendChild(buildWishlistCard(flower)));
});

function buildWishlistCard(flower) {
  const article = document.createElement('article');
  article.className = 'fcard';
  article.setAttribute('data-wishlist-card', '');

  article.innerHTML = `
    <a href="flower-detail.html?id=${encodeURIComponent(flower.id)}" class="fcard-link">
      <div class="fcard-img-wrap" data-img-wrap>
        <img src="${flower.image}" alt="${escapeHtml(flower.name)}" class="fcard-img" />
        <div class="fcard-overlay"><span>View Details</span></div>
        <button type="button" class="like-btn liked" data-like-id="${flower.id}" aria-pressed="true" aria-label="Unlike ${escapeHtml(flower.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21C12 21 3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 13-9 13z"/></svg>
        </button>
      </div>
      <p class="fcard-name">${escapeHtml(flower.name)}</p>
      <p class="fcard-price">$${flower.priceMin.toFixed(2)} – $${flower.priceMax.toFixed(2)}</p>
    </a>
    <button type="button" class="fcard-add" data-add-cart-id="${flower.id}">Add to Cart</button>`;

  article.querySelector('img').addEventListener('error', () => {
    article.querySelector('[data-img-wrap]')?.classList.add('no-img');
  }, { once: true });

  article.querySelector('[data-add-cart-id]').addEventListener('click', (e) => {
    e.preventDefault();
    api.cart.add(flower, 1);
    window.refreshHeaderBadges?.({ animateCart: true });
    Toast?.success('Added to cart', `${flower.name} is in your cart.`);
  });

  return article;
}
