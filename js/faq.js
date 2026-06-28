/**
 * faq.js — Renders data/faq.json into an accordion and filters
 * it live as the visitor types in the search box.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const root   = document.getElementById('faqRoot');
  const search = document.getElementById('faqSearch');
  const emptyEl = document.getElementById('faqEmpty');
  if (!root) return;

  let data = null;
  try {
    const res = await fetch('data/faq.json');
    data = await res.json();
  } catch (err) {
    console.error('Could not load faq.json', err);
    root.innerHTML = '<p style="color:var(--muted);text-align:center;">FAQ could not be loaded right now.</p>';
    return;
  }

  /** Build one <button> + answer panel. Toggling is handled by the shared accordion listener below. */
  const buildItem = (item) => {
    const wrap = document.createElement('div');
    wrap.className = 'faq-item';
    wrap.dataset.q = item.q.toLowerCase();
    wrap.dataset.a = item.a.toLowerCase();
    wrap.innerHTML = `
      <button type="button" class="faq-q" aria-expanded="false">
        <span>${escapeHtml(item.q)}</span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a"><p class="faq-a-inner">${escapeHtml(item.a)}</p></div>`;
    return wrap;
  };

  /** Render the full FAQ, grouped by category. */
  const renderAll = () => {
    root.innerHTML = '';
    data.categories.forEach((cat) => {
      const section = document.createElement('div');
      section.className = 'faq-category';
      section.innerHTML = `<p class="faq-category-title">${escapeHtml(cat.title)}</p>`;
      cat.items.forEach((item) => section.appendChild(buildItem(item)));
      root.appendChild(section);
    });
  };
  renderAll();

  /* ── Accordion (single delegated listener — works for every item) ── */
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.faq-q');
    if (!btn) return;
    const panel = btn.nextElementSibling;
    const isOpen = btn.getAttribute('aria-expanded') === 'true';

    // Close any other open item so the list stays scannable.
    root.querySelectorAll('.faq-q[aria-expanded="true"]').forEach((other) => {
      if (other !== btn) {
        other.setAttribute('aria-expanded', 'false');
        other.nextElementSibling.style.maxHeight = '0px';
      }
    });

    btn.setAttribute('aria-expanded', String(!isOpen));
    panel.style.maxHeight = isOpen ? '0px' : `${panel.scrollHeight}px`;
  });

  /* ── Live search across question + answer text ─────────────── */
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let visibleCount = 0;

    root.querySelectorAll('.faq-category').forEach((cat) => {
      let anyVisibleInCat = false;
      cat.querySelectorAll('.faq-item').forEach((item) => {
        const matches = !q || item.dataset.q.includes(q) || item.dataset.a.includes(q);
        item.style.display = matches ? '' : 'none';
        if (matches) { anyVisibleInCat = true; visibleCount++; }
      });
      cat.style.display = anyVisibleInCat ? '' : 'none';
    });

    if (emptyEl) emptyEl.style.display = visibleCount === 0 ? 'block' : 'none';
  });
});
