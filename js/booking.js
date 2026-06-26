/**
 * booking.js — Live-price booking wizard (JSON-driven rebuild)
 * ───────────────────────────────────────────────────────────────
 * Everything that used to be hardcoded <div class="apick"> markup
 * in booking.html is now built from data/booking-items.json by the
 * functions in section 2 below. booking.html only contains empty
 * grid containers (e.g. #mainFlowersGrid) for this script to fill.
 *
 * On "Place Order" the full selection is saved through window.api
 * (js/api.js) — a localStorage-backed stand-in for a real backend —
 * so every order (and the customer info that came with it) can be
 * retrieved later from the account dashboard.
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
    mainFlowers: {},
    fillers:     {},
    foliage:     {},
    addons:      {},
    delivery:    0,
    templateBase: 0,
    orderType:   null,
    purpose:     null,
    budget:      null,
    greetingMessage: '',
  };

  /* ── Price badge ──────────────────────────────────────── */
  const badge    = $('priceBadge');
  const badgeAmt = $('priceBadgeAmt');

  const calcTotal = () => {
    let t = 0;
    if (SEL.orderType === 'template') {
      t += SEL.templateBase;
    } else if (SEL.orderType === 'surprise') {
      t += 45;
    } else {
      Object.values(SEL.mainFlowers).forEach(({ price, qty }) => t += price * qty);
      Object.values(SEL.fillers).forEach(({ price, qty }) => t += price * qty);
      Object.values(SEL.foliage).forEach(({ price, qty }) => t += price * qty);
    }
    Object.values(SEL.addons).forEach((p) => t += p);
    t += SEL.delivery;
    return t;
  };

  const refreshBadge = () => {
    const total = calcTotal();
    badgeAmt.textContent = `$${total.toFixed(2)}`;
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
    setTimeout(() => badge.classList.remove('bump'), 250);
  };

  /* ════════════════════════════════════════════════════════
     2. BUILDERS — turn JSON rows into clickable cards
  ════════════════════════════════════════════════════════ */

  /** One "apick" card: image + label + price + (on select) colour dots & qty stepper. */
  const buildApickCard = (item, type, store) => {
    const card = document.createElement('div');
    card.className = 'apick';
    card.dataset.value = item.value;

    card.innerHTML = `
      <div class="apick-img" data-img-wrap><img src="${item.image}" alt="${escapeHtml(item.label)}" /><div class="apick-placeholder"></div></div>
      <span class="apick-label">${escapeHtml(item.label)}</span>
      <span class="apick-price">$${item.price.toFixed(2)} / ${type === 'foliage' ? 'sprig' : 'stem'}</span>`;

    card.querySelector('img').addEventListener('error', () => {
      card.querySelector('[data-img-wrap]')?.classList.add('no-img');
    }, { once: true });

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'apick-options';

    const colorsDiv = document.createElement('div');
    colorsDiv.className = 'apick-colors';
    item.colors.forEach(([name, hex], i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'apick-col' + (i === 0 ? ' chosen' : '');
      dot.dataset.c = name;
      dot.style.background = hex;
      if (hex.toLowerCase() === '#ffffff') dot.style.border = '1.5px solid #D8D4CC';
      dot.title = name;
      dot.setAttribute('aria-label', name);
      colorsDiv.appendChild(dot);
    });
    optionsDiv.appendChild(colorsDiv);

    const qtyDiv = document.createElement('div');
    qtyDiv.className = 'apick-qty';
    qtyDiv.innerHTML = `
      <button class="qty-btn" data-dir="-1" type="button">−</button>
      <span class="qty-val">1</span>
      <button class="qty-btn" data-dir="1" type="button">+</button>
      <span class="qty-unit">${type === 'foliage' ? 'sprigs' : 'stems'}</span>`;
    optionsDiv.appendChild(qtyDiv);

    const subEl = document.createElement('div');
    subEl.className = 'apick-subtotal';
    optionsDiv.appendChild(subEl);
    card.appendChild(optionsDiv);

    const getState = () => {
      const chosen = card.querySelector('.apick-col.chosen');
      const qty = parseInt(card.querySelector('.qty-val').textContent) || 1;
      return { price: item.price, qty, color: chosen ? chosen.dataset.c : item.colors[0][0], label: item.label };
    };
    const updateSub = () => {
      const s = getState();
      subEl.textContent = `${s.qty} × $${item.price.toFixed(2)} = $${(s.qty * item.price).toFixed(2)}`;
    };
    const writeSel = (selected) => {
      if (selected) store[item.value] = getState();
      else delete store[item.value];
      refreshBadge();
    };

    card.addEventListener('click', (e) => {
      if (e.target.closest('.apick-col') || e.target.closest('.qty-btn')) return;

      if (type === 'main' && !card.classList.contains('selected')) {
        if (Object.keys(SEL.mainFlowers).length >= 3) {
          Toast?.info('Limit reached', 'You can choose up to 3 main flowers.');
          return;
        }
      }
      const isSelected = card.classList.toggle('selected');
      writeSel(isSelected);
      updateSub();
    });

    colorsDiv.querySelectorAll('.apick-col').forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        colorsDiv.querySelectorAll('.apick-col').forEach((d) => d.classList.remove('chosen'));
        dot.classList.add('chosen');
        if (card.classList.contains('selected')) writeSel(true);
      });
    });

    qtyDiv.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const valEl = card.querySelector('.qty-val');
        let cur = parseInt(valEl.textContent) || 1;
        cur = Math.max(1, Math.min(20, cur + parseInt(btn.dataset.dir)));
        valEl.textContent = cur;
        if (card.classList.contains('selected')) writeSel(true);
        updateSub();
      });
    });

    updateSub();
    return card;
  };

  const renderApickGroup = (containerId, items, type, store) => {
    const container = $(containerId);
    if (!container) return;
    items.forEach((item) => container.appendChild(buildApickCard(item, type, store)));
  };

  renderApickGroup('mainFlowersGrid',  ITEMS.mainFlowers, 'main',    SEL.mainFlowers);
  renderApickGroup('fillerFlowersGrid', ITEMS.fillers,     'filler',  SEL.fillers);
  renderApickGroup('foliageGrid',       ITEMS.foliage,      'foliage', SEL.foliage);

  /** Template cards (Step 2B) */
  const templateGrid = $('templateGrid');
  if (templateGrid) {
    ITEMS.templates.forEach((t) => {
      const label = document.createElement('label');
      label.className = 'tcard';
      label.dataset.price = t.price;
      label.innerHTML = `
        <input type="radio" name="template" value="${t.value}" hidden />
        <div class="tcard-img" data-img-wrap><img src="${t.image}" alt="${escapeHtml(t.label)}" /><div class="tcard-placeholder"></div></div>
        <p class="tcard-name">${escapeHtml(t.label)}</p>
        <p class="tcard-sub">${escapeHtml(t.sub)}</p>
        <p class="tcard-price-tag">from $${t.price}</p>`;
      label.querySelector('img').addEventListener('error', () => {
        label.querySelector('[data-img-wrap]')?.classList.add('no-img');
      }, { once: true });
      label.querySelector('input').addEventListener('change', () => {
        SEL.templateBase = t.price;
        refreshBadge();
      });
      templateGrid.appendChild(label);
    });
  }

  /** Colour theme pills (Step 2B) */
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

  /** Purpose cards — used by both Step 2A (radio list) and Step 2C (pcard grid) */
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

  /** Budget buttons (Step 2C) */
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

  /** Extra add-on checkboxes (vase / chocolates / teddy bear) — greeting card stays in HTML (has its own panel). */
  const addonExtras = $('addonExtras');
  if (addonExtras) {
    ITEMS.addons.filter((a) => a.value !== 'greeting-card').forEach((a) => {
      const label = document.createElement('label');
      label.className = 'bcheck';
      label.innerHTML = `<input type="checkbox" name="addon" value="${a.value}" data-price="${a.price}" /> <span>${escapeHtml(a.label)} <em>+$${a.price}</em></span>`;
      addonExtras.appendChild(label);
    });
  }

  /* Add-on change listener (delegated — covers both static + JS-built checkboxes) */
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
      if (btn.dataset.next === 'step4') buildCheckoutSummary();
      showStep(btn.dataset.next);
    });
  });
  QA('[data-back]').forEach((btn) => btn.addEventListener('click', () => showStep(btn.dataset.back)));
  $('step3Back')?.addEventListener('click', () => {
    showStep(SEL.orderType === 'custom' ? '2custom' : SEL.orderType === 'template' ? '2template' : '2surprise');
  });

  /* ── Greeting card panel ─────────────────────────────────── */
  const cbGreeting    = $('cbGreeting');
  const greetingPanel = $('greetingPanel');
  const greetingText  = $('greetingText');
  const greetingCount = $('greetingCount');

  cbGreeting?.addEventListener('change', () => {
    if (cbGreeting.checked) {
      greetingPanel.classList.add('open');
      setTimeout(() => greetingText?.focus(), 50);
    } else {
      greetingPanel.classList.remove('open');
    }
  });
  greetingText?.addEventListener('input', () => {
    const len = greetingText.value.length;
    if (greetingCount) {
      greetingCount.textContent = len;
      greetingCount.parentElement.classList.toggle('warn', len > 180);
    }
    SEL.greetingMessage = greetingText.value;
  });

  /* ── Delivery & payment ──────────────────────────────────── */
  QA('input[name="delivery"]').forEach((r) => {
    r.addEventListener('change', () => {
      SEL.delivery = r.value === 'express' ? 9.99 : 0;
      refreshBadge();
      buildCheckoutSummary();
    });
  });
  QA('input[name="payment"]').forEach((r) => {
    r.addEventListener('change', () => {
      const cf = $('cardFields');
      if (cf) cf.style.display = r.value === 'credit' ? '' : 'none';
    });
  });

  /* ════════════════════════════════════════════════════════
     4. CHECKOUT SUMMARY
  ════════════════════════════════════════════════════════ */
  const buildCheckoutSummary = () => {
    const titleEl = $('osSummaryTitle'), detailEl = $('osSummaryDetail'), linesEl = $('osPriceLines'), totalEl = $('osTotal');

    if (titleEl) {
      const t = { custom: 'Fully Customized Bouquet', template: 'Template Bouquet', surprise: 'Surprise Bouquet' };
      titleEl.textContent = t[SEL.orderType] || 'Your Bouquet';
    }
    if (detailEl) {
      const parts = [];
      Object.entries(SEL.mainFlowers).forEach(([k, v]) => parts.push(`${cap(k)} (${v.color})`));
      Object.entries(SEL.fillers).forEach(([k]) => parts.push(cap(k)));
      Object.entries(SEL.foliage).forEach(([k]) => parts.push(cap(k)));
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

  /* ── Prefill checkout form if logged in ─────────────────── */
  const currentUser = window.api ? api.auth.currentUser() : null;
  if (currentUser) {
    const fullNameEl = document.querySelector('input[name="fullName"]');
    const emailEl    = document.querySelector('input[name="email"]');
    const phoneEl    = document.querySelector('input[name="phone"]');
    const streetEl   = document.querySelector('input[name="street"]');
    if (fullNameEl) fullNameEl.value = currentUser.fullName || '';
    if (emailEl)    emailEl.value    = currentUser.email || '';
    if (phoneEl)    phoneEl.value    = currentUser.phone || '';
    if (streetEl)   streetEl.value   = currentUser.address || '';
  }

  /* ════════════════════════════════════════════════════════
     5. PLACE ORDER → saved through the localStorage "API"
  ════════════════════════════════════════════════════════ */
  $('placeOrderBtn')?.addEventListener('click', async () => {
    const fullName = document.querySelector('input[name="fullName"]')?.value.trim();
    const email    = document.querySelector('input[name="email"]')?.value.trim();
    const phone    = document.querySelector('input[name="phone"]')?.value.trim();
    const delivery = document.querySelector('input[name="delivery"]:checked')?.value || 'standard';
    const delivDate = document.querySelector('input[name="delivDate"]')?.value.trim();
    const delivTime = document.querySelector('select[name="delivTime"]')?.value;
    const street = document.querySelector('input[name="street"]')?.value.trim();
    const cityzip = document.querySelector('input[name="cityzip"]')?.value.trim();
    const payment = document.querySelector('input[name="payment"]:checked')?.value || 'credit';
    const cardMessage = document.querySelector('textarea[name="cardMessage"]')?.value.trim();

    if (!fullName || !email) {
      Toast?.error('Missing information', 'Please fill in your name and email to continue.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Toast?.error('Invalid email', 'Please double-check your email address.');
      return;
    }

    const placeBtn = $('placeOrderBtn');
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order…';

    const orderPayload = {
      customer: { fullName, email, phone },
      orderType: SEL.orderType,
      selections: {
        mainFlowers: SEL.mainFlowers, fillers: SEL.fillers, foliage: SEL.foliage,
        templateBase: SEL.templateBase, purpose: SEL.purpose, budget: SEL.budget,
      },
      addons: SEL.addons,
      greetingMessage: SEL.greetingMessage,
      cardMessage,
      delivery: { method: delivery, date: delivDate, time: delivTime, street, cityzip },
      payment: { method: payment },
      total: calcTotal(),
    };

    try {
      const { ok, order, error } = await api.orders.create(orderPayload);
      if (!ok) throw new Error(error || 'Could not save order.');
      Toast?.success('Order placed!', `Confirmation #${order.id.slice(-6).toUpperCase()} saved to your account.`);
      showStep('success');
    } catch (err) {
      console.error(err);
      Toast?.error('Order failed', 'Something went wrong saving your order. Please try again.');
      placeBtn.disabled = false;
      placeBtn.textContent = 'Place Order';
    }
  });

  /* ── Boot ─────────────────────────────────────────────────── */
  showStep('step1');
  refreshBadge();
});
