/**
 * booking.js — Live-price booking wizard (JSON-driven rebuild)
 *
 * Step 2A "Fully Customized" new flow:
 *   ① Color Palette  →  pick one mood/palette (mandatory)
 *   ② Main Flowers   →  up to 3 TYPES, unlimited stems each
 *   ③ Filler Flowers →  unlimited types & stems
 *   ④ Foliage        →  unlimited types & stems
 *   ⑤ Purpose        →  occasion radio
 */
document.addEventListener('DOMContentLoaded', async () => {

  const $  = (id) => document.getElementById(id);
  const QA = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const cap = (s) => (s || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  /* ════════════════════════════════════════════════════════
     1. LOAD DATA
  ════════════════════════════════════════════════════════ */
  let ITEMS = null;
  try {
    const res = await fetch('data/booking-items.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ITEMS = await res.json();
  } catch (err) {
    console.error('Could not load booking-items.json', err);
    Toast?.error('Could not load booking options', 'Please refresh the page.');
    return;
  }

  /* ── State ────────────────────────────────────────────── */
  const SEL = {
    palette:      null,   // { value, label }
    mainFlowers:  {},     // { [value]: { price, qty, label } } — max 3 types
    fillers:      {},
    foliage:      {},
    addons:       {},
    delivery:     0,
    templateBase: 0,
    orderType:    null,
    purpose:      null,
    budget:       null,
    greetingMessage: '',
  };

  /* ── Price badge ──────────────────────────────────────── */
  const badge    = $('priceBadge');
  const badgeAmt = $('priceBadgeAmt');

  const calcTotal = () => {
    let t = 0;
    if (SEL.orderType === 'template')      t += SEL.templateBase;
    else if (SEL.orderType === 'surprise') t += 45;
    else {
      Object.values(SEL.mainFlowers).forEach(({ price, qty }) => t += price * qty);
      Object.values(SEL.fillers).forEach(({ price, qty }) => t += price * qty);
      Object.values(SEL.foliage).forEach(({ price, qty }) => t += price * qty);
    }
    Object.values(SEL.addons).forEach((p) => t += p);
    t += SEL.delivery;
    return t;
  };

  const refreshBadge = () => {
    if (!badge) return;
    badgeAmt.textContent = `$${calcTotal().toFixed(2)}`;
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
    setTimeout(() => badge.classList.remove('bump'), 250);
  };

  /* ════════════════════════════════════════════════════════
     2A. PALETTE CARDS  — Step 2A ①
  ════════════════════════════════════════════════════════ */
  const renderPaletteGrid = () => {
    const grid = $('paletteGrid');
    if (!grid || !ITEMS.customColorPalettes) return;

    ITEMS.customColorPalettes.forEach((palette) => {
      const card = document.createElement('div');
      card.className = 'palette-card';
      card.dataset.value = palette.value;

      const swatchHTML = palette.swatches.map((hex) => {
        const border = (hex === '#ffffff') ? 'border:1.5px solid #D8D4CC;' : '';
        return `<span class="palette-swatch" style="background:${hex};${border}"></span>`;
      }).join('');

      card.innerHTML = `
        <div class="palette-swatches">${swatchHTML}</div>
        <p class="palette-name">${escapeHtml(palette.label)}</p>
        <p class="palette-desc">${escapeHtml(palette.desc)}</p>
        <span class="palette-check" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>`;

      card.addEventListener('click', () => {
        QA('.palette-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        SEL.palette = { value: palette.value, label: palette.label };
        Toast?.info(`Palette: ${palette.label}`);
      });

      grid.appendChild(card);
    });
  };
  renderPaletteGrid();

  /* ════════════════════════════════════════════════════════
     2B. APICK CARDS  — main flowers / fillers / foliage
         No per-card colour picker — palette handles colour globally.
  ════════════════════════════════════════════════════════ */

  /** Keep the "X / 3 types" counter next to the ② heading in sync. */
  const updateMainFlowerCount = () => {
    const counter = $('mainFlowerCount');
    if (!counter) return;
    const count = Object.keys(SEL.mainFlowers).length;
    counter.textContent = `${count} / 3 types`;
    counter.classList.toggle('at-limit', count >= 3);
  };

  const buildApickCard = (item, type, store, limit = null) => {
    const card = document.createElement('div');
    card.className = 'apick';
    card.dataset.value = item.value;

    card.innerHTML = `
      <div class="apick-img" data-img-wrap>
        <img src="${item.image}" alt="${escapeHtml(item.label)}" />
        <div class="apick-placeholder"></div>
      </div>
      <span class="apick-label">${escapeHtml(item.label)}</span>
      <span class="apick-price">$${item.price.toFixed(2)} / ${type === 'foliage' ? 'sprig' : 'stem'}</span>
      <div class="apick-options">
        <div class="apick-qty">
          <button class="qty-btn" data-dir="-1" type="button">−</button>
          <span class="qty-val">1</span>
          <button class="qty-btn" data-dir="1" type="button">+</button>
          <span class="qty-unit">${type === 'foliage' ? 'sprigs' : 'stems'}</span>
        </div>
        <div class="apick-subtotal"></div>
      </div>`;

    card.querySelector('img').addEventListener('error', () => {
      card.querySelector('[data-img-wrap]')?.classList.add('no-img');
    }, { once: true });

    const subEl    = card.querySelector('.apick-subtotal');
    const qtyValEl = card.querySelector('.qty-val');
    const getQty   = () => parseInt(qtyValEl.textContent) || 1;

    const updateSub = () => {
      const qty = getQty();
      subEl.textContent = `${qty} × $${item.price.toFixed(2)} = $${(qty * item.price).toFixed(2)}`;
    };

    const writeSel = (selected) => {
      if (selected) store[item.value] = { price: item.price, qty: getQty(), label: item.label };
      else delete store[item.value];
      refreshBadge();
      if (type === 'main') updateMainFlowerCount();
    };

    card.addEventListener('click', (e) => {
      if (e.target.closest('.qty-btn')) return;
      if (!card.classList.contains('selected')) {
        if (limit !== null && Object.keys(store).length >= limit) {
          Toast?.info('Limit reached', `You can choose up to ${limit} main flower types.`);
          return;
        }
      }
      const isSelected = card.classList.toggle('selected');
      writeSel(isSelected);
      updateSub();
    });

    card.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        let cur = getQty();
        cur = Math.max(1, Math.min(99, cur + parseInt(btn.dataset.dir)));
        qtyValEl.textContent = cur;
        if (card.classList.contains('selected')) writeSel(true);
        updateSub();
      });
    });

    updateSub();
    return card;
  };

  const renderApickGroup = (containerId, items, type, store, limit = null) => {
    const container = $(containerId);
    if (!container) return;
    items.forEach((item) => container.appendChild(buildApickCard(item, type, store, limit)));
  };

  renderApickGroup('mainFlowersGrid',   ITEMS.mainFlowers, 'main',    SEL.mainFlowers, 3);
  renderApickGroup('fillerFlowersGrid', ITEMS.fillers,     'filler',  SEL.fillers);
  renderApickGroup('foliageGrid',       ITEMS.foliage,     'foliage', SEL.foliage);
  updateMainFlowerCount();

  /* ════════════════════════════════════════════════════════
     2C. TEMPLATE GRID + COLOR THEME (Step 2B — unchanged)
  ════════════════════════════════════════════════════════ */
  const templateGrid = $('templateGrid');
  if (templateGrid) {
    ITEMS.templates.forEach((t) => {
      const label = document.createElement('label');
      label.className = 'tcard';
      label.dataset.price = t.price;
      label.innerHTML = `
        <input type="radio" name="template" value="${t.value}" hidden />
        <div class="tcard-img" data-img-wrap>
          <img src="${t.image}" alt="${escapeHtml(t.label)}" /><div class="tcard-placeholder"></div>
        </div>
        <p class="tcard-name">${escapeHtml(t.label)}</p>
        <p class="tcard-sub">${escapeHtml(t.sub)}</p>
        <p class="tcard-price-tag">from $${t.price}</p>`;
      label.querySelector('img').addEventListener('error', () => {
        label.querySelector('[data-img-wrap]')?.classList.add('no-img');
      }, { once: true });
      label.querySelector('input').addEventListener('change', () => {
        SEL.templateBase = t.price; refreshBadge();
      });
      templateGrid.appendChild(label);
    });
  }

  const colorThemeRow = $('colorThemeRow');
  if (colorThemeRow) {
    ITEMS.colorThemes.forEach((c) => {
      const label = document.createElement('label');
      label.className = 'theme-pill';
      label.style.setProperty('--tc', c.swatch);
      label.style.setProperty('--ttc', c.textColor);
      label.innerHTML = `<input type="radio" name="colorTheme" value="${c.value}" hidden /><span>${escapeHtml(c.label)}</span>`;
      colorThemeRow.appendChild(label);
    });
  }

  /* Purpose — Step 2A ⑤ */
  const radioGrid = $('purposeGrid');
  if (radioGrid) {
    ITEMS.purposes.forEach((p) => {
      const label = document.createElement('label');
      label.className = 'bradio';
      label.innerHTML = `<input type="radio" name="purpose" value="${p.value}" /><span>${escapeHtml(p.label)}</span>`;
      label.querySelector('input').addEventListener('change', () => { SEL.purpose = p.value; });
      radioGrid.appendChild(label);
    });
  }

  /* Purpose — Step 2C */
  const purposeSGrid = $('purposeSGrid');
  if (purposeSGrid) {
    ITEMS.purposes.forEach((p) => {
      const label = document.createElement('label');
      label.className = 'pcard';
      label.innerHTML = `
        <input type="radio" name="purposeS" value="${p.value}" hidden />
        <div class="pcard-inner"><strong>${escapeHtml(p.label)}</strong><span>${escapeHtml(p.sub)}</span></div>`;
      label.querySelector('input').addEventListener('change', () => { SEL.purpose = p.value; });
      purposeSGrid.appendChild(label);
    });
  }

  /* Budget — Step 2C */
  const budgetRow = $('budgetRow');
  if (budgetRow) {
    ITEMS.budgets.forEach((b) => {
      const label = document.createElement('label');
      label.className = 'budget-btn';
      label.innerHTML = `<input type="radio" name="budget" value="${b.value}" hidden /><span>${escapeHtml(b.label)}</span>`;
      label.querySelector('input').addEventListener('change', () => { SEL.budget = b.value; });
      budgetRow.appendChild(label);
    });
  }

  /* Add-ons */
  const addonExtras = $('addonExtras');
  if (addonExtras) {
    ITEMS.addons.filter((a) => a.value !== 'greeting-card').forEach((a) => {
      const label = document.createElement('label');
      label.className = 'bcheck';
      label.innerHTML = `<input type="checkbox" name="addon" value="${a.value}" data-price="${a.price}" /> <span>${escapeHtml(a.label)} <em>+$${a.price}</em></span>`;
      addonExtras.appendChild(label);
    });
  }

  document.addEventListener('change', (e) => {
    if (e.target.matches('input[name="addon"]')) {
      const cb = e.target;
      const price = parseFloat(cb.dataset.price) || 0;
      if (cb.checked) SEL.addons[cb.value] = price;
      else delete SEL.addons[cb.value];
      refreshBadge();
    }
  });

  /* ════════════════════════════════════════════════════════
     3. STEP NAVIGATION
  ════════════════════════════════════════════════════════ */
  const STEPS = {
    'step1': $('step1'), '2custom': $('step2custom'), '2template': $('step2template'),
    '2surprise': $('step2surprise'), 'step3': $('step3'), 'step4': $('step4'), 'success': $('stepSuccess'),
  };
  let currentKey = 'step1';

  const showStep = (key) => {
    Object.values(STEPS).forEach((el) => { if (el) el.style.display = 'none'; });
    const el = STEPS[key];
    if (el) { el.style.display = ''; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    currentKey = String(key);
    updateProgress();
  };

  const updateProgress = () => {
    const map = { 'step1':1, '2custom':2, '2template':2, '2surprise':2, 'step3':3, 'step4':4, 'success':4 };
    const cur = map[currentKey] || 1;
    QA('.prog-step').forEach((btn) => {
      const n = +btn.dataset.step;
      btn.classList.toggle('active', n === cur);
      btn.classList.toggle('done', n < cur);
    });
  };

  QA('.ot-card').forEach((card) => {
    card.addEventListener('click', () => {
      QA('.ot-card').forEach((c) => c.querySelector('input').checked = false);
      card.querySelector('input').checked = true;
      SEL.orderType = card.dataset.value;
      refreshBadge();
    });
  });

  $('step1Next')?.addEventListener('click', () => {
    if (!SEL.orderType) { Toast?.info('Pick an order type', 'Choose Custom, Template, or Surprise Me to continue.'); return; }
    showStep(SEL.orderType === 'custom' ? '2custom' : SEL.orderType === 'template' ? '2template' : '2surprise');
  });

  QA('[data-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.closest('#step2custom')) {
        if (!SEL.palette) { Toast?.info('Choose a color palette', 'Pick a palette in ① before moving on.'); return; }
        if (Object.keys(SEL.mainFlowers).length === 0) { Toast?.info('Choose a main flower', 'Select at least one flower type in ②.'); return; }
      }
      if (btn.dataset.next === 'step4') buildCheckoutSummary();
      showStep(btn.dataset.next);
    });
  });

  QA('[data-back]').forEach((btn) => btn.addEventListener('click', () => showStep(btn.dataset.back)));
  $('step3Back')?.addEventListener('click', () => {
    showStep(SEL.orderType === 'custom' ? '2custom' : SEL.orderType === 'template' ? '2template' : '2surprise');
  });

  /* ── Greeting card ─────────────────────────────────────── */
  const cbGreeting    = $('cbGreeting');
  const greetingPanel = $('greetingPanel');
  const greetingText  = $('greetingText');
  const greetingCount = $('greetingCount');

  cbGreeting?.addEventListener('change', () => {
    if (cbGreeting.checked) { greetingPanel.classList.add('open'); setTimeout(() => greetingText?.focus(), 50); }
    else greetingPanel.classList.remove('open');
  });
  greetingText?.addEventListener('input', () => {
    const len = greetingText.value.length;
    if (greetingCount) { greetingCount.textContent = len; greetingCount.parentElement.classList.toggle('warn', len > 180); }
    SEL.greetingMessage = greetingText.value;
  });

  /* ── Delivery & payment ─────────────────────────────────── */
  QA('input[name="delivery"]').forEach((r) => {
    r.addEventListener('change', () => { SEL.delivery = r.value === 'express' ? 9.99 : 0; refreshBadge(); buildCheckoutSummary(); });
  });
  QA('input[name="payment"]').forEach((r) => {
    r.addEventListener('change', () => { const cf = $('cardFields'); if (cf) cf.style.display = r.value === 'credit' ? '' : 'none'; });
  });

  /* ════════════════════════════════════════════════════════
     4. CHECKOUT SUMMARY
  ════════════════════════════════════════════════════════ */
  const buildCheckoutSummary = () => {
    const titleEl  = $('osSummaryTitle');
    const detailEl = $('osSummaryDetail');
    const linesEl  = $('osPriceLines');
    const totalEl  = $('osTotal');

    if (titleEl) {
      const t = { custom: 'Fully Customized Bouquet', template: 'Template Bouquet', surprise: 'Surprise Bouquet' };
      titleEl.textContent = t[SEL.orderType] || 'Your Bouquet';
    }
    if (detailEl) {
      const parts = [];
      if (SEL.palette) parts.push(`Palette: ${SEL.palette.label}`);
      Object.entries(SEL.mainFlowers).forEach(([k, v]) => parts.push(`${cap(k)} ×${v.qty}`));
      Object.entries(SEL.fillers).forEach(([k, v]) => parts.push(`${cap(k)} ×${v.qty}`));
      Object.entries(SEL.foliage).forEach(([k, v]) => parts.push(`${cap(k)} ×${v.qty}`));
      detailEl.textContent = parts.join(' · ') || 'Your selections';
    }
    if (linesEl) {
      linesEl.innerHTML = '';
      const line = (label, amt) => {
        const div = document.createElement('div');
        div.className = 'os-line';
        div.innerHTML = `<span>${escapeHtml(label)}</span><span>$${amt.toFixed(2)}</span>`;
        linesEl.appendChild(div);
      };
      if (SEL.orderType === 'template' && SEL.templateBase) line('Template bouquet', SEL.templateBase);
      else if (SEL.orderType === 'surprise') line('Surprise bouquet', 45);
      else {
        Object.entries(SEL.mainFlowers).forEach(([k, v]) => line(`${cap(k)} × ${v.qty}`, v.price * v.qty));
        Object.entries(SEL.fillers).forEach(([k, v]) => line(`${cap(k)} × ${v.qty}`, v.price * v.qty));
        Object.entries(SEL.foliage).forEach(([k, v]) => line(`${cap(k)} × ${v.qty}`, v.price * v.qty));
      }
      Object.entries(SEL.addons).forEach(([k, p]) => line(cap(k === 'greeting-card' ? 'Greeting Card ✉' : k), p));
      if (SEL.delivery > 0) line('Express delivery', SEL.delivery);
      if (SEL.addons['greeting-card'] && SEL.greetingMessage) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'os-line os-greeting-msg';
        msgDiv.innerHTML = `<span style="font-style:italic;color:var(--muted);font-size:11px;">"${escapeHtml(SEL.greetingMessage)}"</span>`;
        linesEl.appendChild(msgDiv);
      }
    }
    if (totalEl) totalEl.textContent = `$${calcTotal().toFixed(2)}`;
  };

  /* ── Prefill checkout form ─────────────────────────────── */
  if (window.api?.auth?.ready) await api.auth.ready;
  const currentUser = window.api ? api.auth.currentUser() : null;
  if (currentUser) {
    const setVal = (name, val) => { const el = document.querySelector(`input[name="${name}"]`); if (el) el.value = val || ''; };
    setVal('fullName', currentUser.fullName);
    setVal('email',    currentUser.email);
    setVal('phone',    currentUser.phone);
    const streetEl = document.querySelector('input[name="street"]');
    if (streetEl) streetEl.value = currentUser.address || '';
  }

  /* ════════════════════════════════════════════════════════
     5. PLACE ORDER
  ════════════════════════════════════════════════════════ */
  $('placeOrderBtn')?.addEventListener('click', async () => {
    const fullName  = document.querySelector('input[name="fullName"]')?.value.trim();
    const email     = document.querySelector('input[name="email"]')?.value.trim();
    const phone     = document.querySelector('input[name="phone"]')?.value.trim();
    const delivery  = document.querySelector('input[name="delivery"]:checked')?.value || 'standard';
    const delivDate = document.querySelector('input[name="delivDate"]')?.value.trim();
    const delivTime = document.querySelector('select[name="delivTime"]')?.value;
    const street    = document.querySelector('input[name="street"]')?.value.trim();
    const cityzip   = document.querySelector('input[name="cityzip"]')?.value.trim();
    const payment   = document.querySelector('input[name="payment"]:checked')?.value || 'credit';
    const cardMsg   = document.querySelector('textarea[name="cardMessage"]')?.value.trim();

    if (!fullName || !email) { Toast?.error('Missing information', 'Please fill in your name and email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { Toast?.error('Invalid email', 'Please double-check your email address.'); return; }

    const placeBtn = $('placeOrderBtn');
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order…';

    const orderPayload = {
      customer:  { fullName, email, phone },
      orderType: SEL.orderType,
      selections: {
        palette:      SEL.palette,
        mainFlowers:  SEL.mainFlowers,
        fillers:      SEL.fillers,
        foliage:      SEL.foliage,
        templateBase: SEL.templateBase,
        purpose:      SEL.purpose,
        budget:       SEL.budget,
      },
      addons:          SEL.addons,
      greetingMessage: SEL.greetingMessage,
      cardMessage:     cardMsg,
      delivery: { method: delivery, date: delivDate, time: delivTime, street, cityzip },
      payment:  { method: payment },
      total:    calcTotal(),
    };

    try {
      const { ok, order, error } = await api.orders.create(orderPayload);
      if (!ok) throw new Error(error || 'Could not save order.');
      Toast?.success('Order placed!', `Confirmation #${order.id.slice(-6).toUpperCase()} saved.`);
      showStep('success');
    } catch (err) {
      console.error(err);
      Toast?.error('Order failed', 'Something went wrong. Please try again.');
      placeBtn.disabled = false;
      placeBtn.textContent = 'Place Order';
    }
  });

  /* ── Boot ──────────────────────────────────────────────── */
  showStep('step1');
  refreshBadge();
});
