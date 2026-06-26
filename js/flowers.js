/**
 * flowers.js — Flower shop: fetch → render → filter → sort → paginate
 * ───────────────────────────────────────────────────────────────────
 * Every product now lives in data/flowers.json (point #7 of the
 * rebuild). This file's only job is to turn that JSON into cards,
 * then run the same filter/sort/pagination engine as before.
 *
 * Design notes carried over from the previous version:
 *  1. Cards carry data-cat / data-color, built fresh from JSON —
 *     no markup duplication between this file and the HTML.
 *  2. Visibility = style.display only. No "hidden" class tricks.
 *  3. buildCounts() never mutates state — it runs read-only passes.
 */
document.addEventListener('DOMContentLoaded', async () => {

  /* ── Config ───────────────────────────────────────────── */
  const PER_PAGE = 6;

  /* ── State ────────────────────────────────────────────── */
  const S = {
    price:    [],
    category: [],
    color:    [],
    sort:     'default',
    page:     1,
  };

  /* ── DOM refs ─────────────────────────────────────────── */
  const grid     = document.getElementById('flowersGrid');
  const countEl  = document.getElementById('resultCount');
  const chipsRow = document.getElementById('chipsRow');
  const emptyEl  = document.getElementById('emptyState');
  const pagNav   = document.getElementById('pagination');
  const nextBtn  = document.getElementById('pageNext');
  const sortEl   = document.getElementById('sortSelect');

  if (!grid) return;

  /* ════════════════════════════════════════════════════════
     1. LOAD DATA
  ════════════════════════════════════════════════════════ */
  let ALL_FLOWERS = [];
  try {
    const res = await fetch('data/flowers.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    ALL_FLOWERS = json.flowers || [];
  } catch (err) {
    console.error('Could not load flowers.json', err);
    grid.innerHTML = '<p style="grid-column:1/-1;color:var(--muted);">Sorry — flowers could not be loaded. Please refresh.</p>';
    if (window.Toast) Toast.error('Could not load flowers', 'Check your connection and refresh the page.');
    return;
  }

  /* ════════════════════════════════════════════════════════
     2. BUILD CARD DOM — one function, reused for every flower
  ════════════════════════════════════════════════════════ */
  const buildCard = (flower) => {
    const article = document.createElement('article');
    article.className = 'fcard';
    article.dataset.price = flower.priceMin;
    article.dataset.cat   = flower.category;
    article.dataset.color = flower.colors.join(' ');
    article.dataset.id    = flower.id;

    article.innerHTML = `
      <a href="flower-detail.html?id=${encodeURIComponent(flower.id)}" class="fcard-link">
        <div class="fcard-img-wrap" data-img-wrap>
          <img src="${flower.image}" alt="${escapeHtml(flower.name)}" class="fcard-img" />
          <div class="fcard-overlay"><span>View Details</span></div>
        </div>
        <p class="fcard-name">${escapeHtml(flower.name)}</p>
        <p class="fcard-price">$${flower.priceMin.toFixed(2)} – $${flower.priceMax.toFixed(2)}</p>
      </a>`;

    article.querySelector('img').addEventListener('error', () => {
      article.querySelector('[data-img-wrap]')?.classList.add('no-img');
    }, { once: true });

    return article;
  };

  /** Render the full (unfiltered) set of cards into the grid once. */
  const renderAllCards = () => {
    grid.innerHTML = '';
    ALL_FLOWERS.forEach((f) => grid.appendChild(buildCard(f)));
  };
  renderAllCards();

  const ALL = Array.from(grid.querySelectorAll('.fcard'));

  /* ── Helpers to read card data ─────────────────────────── */
  const price  = (c) => parseFloat(c.dataset.price || 0);
  const cat    = (c) => (c.dataset.cat   || '').toLowerCase().trim();
  const colors = (c) => (c.dataset.color || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const name   = (c) => (c.querySelector('.fcard-name')?.textContent || '').trim();

  /* ── Filter predicate ──────────────────────────────────── */
  const passes = (card, { skipPrice = false, skipCat = false, skipColor = false } = {}) => {
    if (!skipPrice && S.price.length) {
      const p = price(card);
      if (!S.price.some(({ min, max }) => p >= min && p <= max)) return false;
    }
    if (!skipCat && S.category.length) {
      if (!S.category.includes(cat(card))) return false;
    }
    if (!skipColor && S.color.length) {
      if (!S.color.some((col) => colors(card).includes(col))) return false;
    }
    return true;
  };

  /* ── Sort ──────────────────────────────────────────────── */
  const sortCards = (arr) => {
    const a = [...arr];
    if (S.sort === 'price-asc')  return a.sort((x, y) => price(x) - price(y));
    if (S.sort === 'price-desc') return a.sort((x, y) => price(y) - price(x));
    if (S.sort === 'name-asc')   return a.sort((x, y) => name(x).localeCompare(name(y)));
    return a;
  };

  /* ════════════════════════════════════════════════════════
     3. RENDER (filter + sort + paginate + chips + counts)
  ════════════════════════════════════════════════════════ */
  const render = () => {
    const matched   = sortCards(ALL.filter((c) => passes(c)));
    const total     = matched.length;
    const pageStart = (S.page - 1) * PER_PAGE;
    const pageEnd   = Math.min(pageStart + PER_PAGE, total);
    const visible   = new Set(matched.slice(pageStart, pageEnd));

    ALL.forEach((c) => { c.style.display = visible.has(c) ? '' : 'none'; });

    countEl.textContent = total === 0
      ? 'No results'
      : `Showing ${pageStart + 1}–${pageEnd} of ${total} results`;

    emptyEl.style.display = total === 0 ? 'block' : 'none';
    pagNav.style.display  = total === 0 ? 'none'  : 'flex';

    buildPages(total);
    buildChips();
    buildCounts();
  };

  /* ── Pagination ────────────────────────────────────────── */
  const buildPages = (total) => {
    const pages = Math.max(Math.ceil(total / PER_PAGE), 1);
    pagNav.querySelectorAll('.page-btn:not(.page-next)').forEach((b) => b.remove());

    for (let i = 1; i <= pages; i++) {
      const btn = document.createElement('button');
      btn.className   = 'page-btn' + (i === S.page ? ' active' : '');
      btn.textContent = i;
      if (i === S.page) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', () => { S.page = i; render(); });
      pagNav.insertBefore(btn, nextBtn);
    }
    nextBtn.disabled = S.page >= pages;
    nextBtn.onclick  = () => { if (S.page < pages) { S.page++; render(); } };
  };

  /* ── Chips ─────────────────────────────────────────────── */
  const cap    = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plabel = ({ min, max }) => max >= 999 ? `$${min}+` : `$${min}–$${max}`;

  const buildChips = () => {
    chipsRow.innerHTML = '';
    const addChip = (label, onRemove) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.innerHTML = `${escapeHtml(label)} <span class="chip-x" aria-hidden="true">×</span>`;
      b.addEventListener('click', () => { onRemove(); S.page = 1; render(); });
      chipsRow.appendChild(b);
    };

    S.price.forEach(({ min, max }) =>
      addChip(plabel({ min, max }), () => {
        S.price = S.price.filter((r) => !(r.min === min && r.max === max));
        document.querySelectorAll('input[name="price"]').forEach((cb) => {
          if (+cb.dataset.min === min && +cb.dataset.max === max) cb.checked = false;
        });
      })
    );
    S.category.forEach((v) =>
      addChip(cap(v), () => {
        S.category = S.category.filter((x) => x !== v);
        const cb = document.querySelector(`input[name="category"][value="${v}"]`);
        if (cb) cb.checked = false;
      })
    );
    S.color.forEach((col) =>
      addChip(cap(col), () => {
        S.color = S.color.filter((x) => x !== col);
        const row = document.querySelector(`.color-row[data-color="${col}"]`);
        if (row) row.classList.remove('selected');
      })
    );
  };

  /* ── Count badges ──────────────────────────────────────── */
  const buildCounts = () => {
    document.querySelectorAll('.fcount[data-cat]').forEach((badge) => {
      const target = badge.dataset.cat;
      const n = ALL.filter((c) => passes(c, { skipCat: true }) && cat(c) === target).length;
      badge.textContent   = n;
      badge.style.opacity = n === 0 ? '0.3' : '1';
    });
    document.querySelectorAll('.fcount[data-col]').forEach((badge) => {
      const target = badge.dataset.col;
      const n = ALL.filter((c) => passes(c, { skipColor: true }) && colors(c).includes(target)).length;
      badge.textContent   = n;
      badge.style.opacity = n === 0 ? '0.3' : '1';
    });
  };

  /* ════════════════════════════════════════════════════════
     4. UI WIRING (accordion, checkboxes, color rows, sort, clear)
  ════════════════════════════════════════════════════════ */
  document.querySelectorAll('.filter-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      const body = document.getElementById(btn.getAttribute('aria-controls'));
      if (body) body.classList.toggle('closed', isOpen);
    });
  });

  document.querySelectorAll('input[name="price"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const min = +cb.dataset.min, max = +cb.dataset.max;
      if (cb.checked) S.price.push({ min, max });
      else S.price = S.price.filter((r) => !(r.min === min && r.max === max));
      S.page = 1;
      render();
    });
  });

  document.querySelectorAll('input[name="category"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) { if (!S.category.includes(cb.value)) S.category.push(cb.value); }
      else S.category = S.category.filter((v) => v !== cb.value);
      S.page = 1;
      render();
    });
  });

  document.querySelectorAll('.color-row').forEach((row) => {
    row.addEventListener('click', () => {
      const col = row.dataset.color;
      const isSelected = row.classList.toggle('selected');
      if (isSelected) { if (!S.color.includes(col)) S.color.push(col); }
      else S.color = S.color.filter((v) => v !== col);
      S.page = 1;
      render();
    });
  });

  sortEl?.addEventListener('change', () => {
    S.sort = sortEl.value;
    S.page = 1;
    render();
  });

  const clearAll = () => {
    S.price = []; S.category = []; S.color = []; S.sort = 'default'; S.page = 1;
    document.querySelectorAll('input[name="price"], input[name="category"]').forEach((cb) => cb.checked = false);
    document.querySelectorAll('.color-row').forEach((r) => r.classList.remove('selected'));
    if (sortEl) sortEl.value = 'default';
    render();
    if (window.Toast) Toast.info('Filters cleared');
  };
  document.getElementById('filterClear')?.addEventListener('click', clearAll);
  document.getElementById('emptyStateClear')?.addEventListener('click', clearAll);

  /* ── Mobile drawer ─────────────────────────────────────── */
  const sidebar   = document.getElementById('sidebar');
  const mobileBtn = document.getElementById('mobileFilterBtn');
  const overlay   = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  const openSidebar  = () => { sidebar?.classList.add('open');    overlay.classList.add('visible');    document.body.style.overflow = 'hidden'; };
  const closeSidebar = () => { sidebar?.classList.remove('open'); overlay.classList.remove('visible'); document.body.style.overflow = '';       };

  mobileBtn?.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });

  /* ── Boot ──────────────────────────────────────────────── */
  render();
});
