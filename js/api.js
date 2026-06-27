/**
 * api.js — Simulated backend ("API") for More Than Fl0wers
 * ───────────────────────────────────────────────────────────
 * This is a static site with no server, so there is nowhere to
 * run a real database. Every function below behaves like a real
 * REST API would — it's async, it returns Promises, it validates
 * input, and it can fail — but it persists data in the browser's
 * localStorage instead of over the network.
 *
 * WHY THIS SHAPE?
 * If this project ever grows a real backend (Node/Express, Firebase,
 * Supabase…) every call site (account.js, booking.js, header.js)
 * can stay exactly the same. Only the bodies of the functions below
 * would change from "read/write localStorage" to "fetch('/api/…')".
 *
 * STORAGE KEYS
 *   mtf_customers      → array of customer records (the "users" table)
 *   mtf_orders         → array of order records     (the "orders" table)
 *   mtf_session        → { customerId } of whoever is currently logged in
 *   mtf_guest_id       → a persistent anonymous id for this browser, used
 *                        so a guest's cart/wishlist survive a page refresh
 *   mtf_wishlist_<id>  → array of flower ids liked by that customer/guest
 *   mtf_cart_<id>      → array of { flowerId, name, price, image, qty }
 *
 * SECURITY NOTE
 *   Passwords are hashed with a tiny non-cryptographic hash purely so
 *   plain-text passwords never sit in localStorage. This is NOT secure
 *   and is not meant to be — a real product would hash on a server
 *   with something like bcrypt. Good enough for a class demo only.
 */

(function (global) {
  'use strict';

  const KEYS = {
    customers: 'mtf_customers',
    orders:    'mtf_orders',
    session:   'mtf_session',
    guestId:   'mtf_guest_id',
    wishlist:  (ownerId) => `mtf_wishlist_${ownerId}`,
    cart:      (ownerId) => `mtf_cart_${ownerId}`,
  };

  /* ── tiny local "DB" read/write helpers ────────────────── */
  const readTable = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error(`[api] Failed to read ${key}`, err);
      return [];
    }
  };
  const writeTable = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[api] Failed to write ${key}`, err);
      return false;
    }
  };

  /* ── fake network latency so UI loading states feel real ── */
  const wait = (ms = 220) => new Promise((res) => setTimeout(res, ms));

  /* ── simple demo-only password hash (NOT cryptographically secure) ── */
  const hashPassword = (plain) => {
    let h = 0;
    const str = `mtf::${plain}`;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return `h${h}`;
  };

  const makeId = (prefix) =>
    `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

  const sanitizeCustomer = (c) => {
    if (!c) return null;
    const { passwordHash, ...safe } = c;
    return safe;
  };

  /**
   * Cart and wishlist need *some* owner key even for a signed-out
   * shopper, so guests get a stable random id stored once per browser.
   * Once they sign in, ownerId() switches to their real customer id.
   */
  const getGuestId = () => {
    let id = localStorage.getItem(KEYS.guestId);
    if (!id) {
      id = makeId('guest');
      localStorage.setItem(KEYS.guestId, id);
    }
    return id;
  };

  const ownerId = () => {
    const user = auth.currentUser();
    return user ? user.id : getGuestId();
  };

  /** When a guest signs in/registers, fold their guest cart + wishlist into their account. */
  const mergeGuestDataInto = (customerId) => {
    const guestId = localStorage.getItem(KEYS.guestId);
    if (!guestId || guestId === customerId) return;

    const guestCart = readTable(KEYS.cart(guestId));
    if (guestCart.length) {
      const userCart = readTable(KEYS.cart(customerId));
      guestCart.forEach((item) => {
        const existing = userCart.find((i) => i.flowerId === item.flowerId);
        if (existing) existing.qty += item.qty;
        else userCart.push(item);
      });
      writeTable(KEYS.cart(customerId), userCart);
      writeTable(KEYS.cart(guestId), []);
    }

    const guestWishlist = readTable(KEYS.wishlist(guestId));
    if (guestWishlist.length) {
      const userWishlist = readTable(KEYS.wishlist(customerId));
      const merged = Array.from(new Set([...userWishlist, ...guestWishlist]));
      writeTable(KEYS.wishlist(customerId), merged);
      writeTable(KEYS.wishlist(guestId), []);
    }
  };

  /* ════════════════════════════════════════════════════════
     AUTH
  ════════════════════════════════════════════════════════ */
  const auth = {
    /** Create a new account. Returns { ok, customer, error } */
    async register({ fullName, email, phone, password, address }) {
      await wait();
      if (!fullName || !email || !password) {
        return { ok: false, error: 'Full name, email and password are required.' };
      }
      if (!isValidEmail(email)) {
        return { ok: false, error: 'Please enter a valid email address.' };
      }
      if (password.length < 6) {
        return { ok: false, error: 'Password must be at least 6 characters.' };
      }

      const customers = readTable(KEYS.customers);
      const exists = customers.some((c) => c.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        return { ok: false, error: 'An account with that email already exists.' };
      }

      const customer = {
        id: makeId('cust'),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: (phone || '').trim(),
        address: (address || '').trim(),
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      customers.push(customer);
      writeTable(KEYS.customers, customers);
      writeTable(KEYS.session, { customerId: customer.id });
      mergeGuestDataInto(customer.id);

      return { ok: true, customer: sanitizeCustomer(customer) };
    },

    /** Validate credentials and start a session. */
    async login({ email, password }) {
      await wait();
      const customers = readTable(KEYS.customers);
      const customer = customers.find(
        (c) => c.email.toLowerCase() === (email || '').trim().toLowerCase()
      );
      if (!customer || customer.passwordHash !== hashPassword(password || '')) {
        return { ok: false, error: 'Email or password is incorrect.' };
      }
      writeTable(KEYS.session, { customerId: customer.id });
      mergeGuestDataInto(customer.id);
      return { ok: true, customer: sanitizeCustomer(customer) };
    },

    async logout() {
      await wait(80);
      writeTable(KEYS.session, null);
      return { ok: true };
    },

    /** Returns the logged-in customer (no password hash) or null. Sync — used a lot by UI. */
    currentUser() {
      const session = readTable(KEYS.session) || null;
      if (!session || !session.customerId) return null;
      const customers = readTable(KEYS.customers);
      const customer = customers.find((c) => c.id === session.customerId);
      return sanitizeCustomer(customer) || null;
    },

    isLoggedIn() {
      return !!auth.currentUser();
    },

    /**
     * Resolves once we know who (if anyone) is signed in.
     * For this localStorage backend that's instant. It exists so
     * call sites can write `await api.auth.ready;` once and work
     * unmodified against the Supabase version too, where the very
     * first session check is a real network round trip.
     */
    ready: Promise.resolve(),
  };

  /* ════════════════════════════════════════════════════════
     CUSTOMERS
  ════════════════════════════════════════════════════════ */
  const customers = {
    async get(id) {
      await wait(80);
      const all = readTable(KEYS.customers);
      return sanitizeCustomer(all.find((c) => c.id === id));
    },

    /** Update profile fields (name / phone / address). Email & password not editable here. */
    async update(id, patch) {
      await wait();
      const all = readTable(KEYS.customers);
      const idx = all.findIndex((c) => c.id === id);
      if (idx === -1) return { ok: false, error: 'Account not found.' };

      all[idx] = {
        ...all[idx],
        fullName: patch.fullName?.trim() || all[idx].fullName,
        phone: patch.phone?.trim() ?? all[idx].phone,
        address: patch.address?.trim() ?? all[idx].address,
      };
      writeTable(KEYS.customers, all);
      return { ok: true, customer: sanitizeCustomer(all[idx]) };
    },
  };

  /* ════════════════════════════════════════════════════════
     ORDERS — this is the "backup setting" that captures every
     booking so the business can retrieve customer + order info.
  ════════════════════════════════════════════════════════ */
  const orders = {
    /**
     * Create an order. If the shopper is logged in, the order is
     * automatically linked to their account (customerId). Guests
     * still get an order saved, just without a customerId.
     */
    async create(payload) {
      await wait(300);
      const current = auth.currentUser();
      const order = {
        id: makeId('order'),
        customerId: current ? current.id : null,
        status: 'received',
        createdAt: new Date().toISOString(),
        ...payload,
      };
      const all = readTable(KEYS.orders);
      all.unshift(order); // newest first
      writeTable(KEYS.orders, all);
      return { ok: true, order };
    },

    async listByCustomer(customerId) {
      await wait(120);
      return readTable(KEYS.orders).filter((o) => o.customerId === customerId);
    },

    /** Every order ever placed in this browser — useful for a future admin view. */
    async listAll() {
      await wait(120);
      return readTable(KEYS.orders);
    },
  };

  /* ════════════════════════════════════════════════════════
     WISHLIST ("Like") — keyed by logged-in customer, or a
     stable per-browser guest id if no one is signed in.
  ════════════════════════════════════════════════════════ */
  const wishlist = {
    /** Sync — safe to call on every page load to paint heart icons. */
    list() {
      return readTable(KEYS.wishlist(ownerId()));
    },

    has(flowerId) {
      return wishlist.list().includes(flowerId);
    },

    /** Sync — total liked items, for the header badge. */
    count() {
      return wishlist.list().length;
    },

    /** Toggle like on/off. Returns the new state synchronously (no network, no need to await). */
    toggle(flowerId) {
      const key = KEYS.wishlist(ownerId());
      const current = readTable(key);
      const liked = current.includes(flowerId);
      const next = liked ? current.filter((id) => id !== flowerId) : [...current, flowerId];
      writeTable(key, next);
      return { liked: !liked, count: next.length };
    },

    remove(flowerId) {
      const key = KEYS.wishlist(ownerId());
      const next = readTable(key).filter((id) => id !== flowerId);
      writeTable(key, next);
      return next;
    },
  };

  /* ════════════════════════════════════════════════════════
     CART — same owner-key pattern as wishlist. Holds enough
     of each flower's info to render the cart page without a
     second fetch of flowers.json.
  ════════════════════════════════════════════════════════ */
  const cart = {
    list() {
      return readTable(KEYS.cart(ownerId()));
    },

    /** Sync — total quantity across all line items, for the header badge. */
    count() {
      return cart.list().reduce((sum, item) => sum + item.qty, 0);
    },

    subtotal() {
      return cart.list().reduce((sum, item) => sum + item.price * item.qty, 0);
    },

    /** Add a flower to the cart, merging quantity if it's already in there. */
    add(flower, qty = 1) {
      const key = KEYS.cart(ownerId());
      const items = readTable(key);
      const existing = items.find((i) => i.flowerId === flower.id);
      if (existing) {
        existing.qty += qty;
      } else {
        items.push({ flowerId: flower.id, name: flower.name, price: flower.priceMin, image: flower.image, qty });
      }
      writeTable(key, items);
      return { items, count: cart.count() };
    },

    setQty(flowerId, qty) {
      const key = KEYS.cart(ownerId());
      const items = readTable(key);
      const item = items.find((i) => i.flowerId === flowerId);
      if (!item) return items;
      item.qty = Math.max(1, Math.min(20, qty));
      writeTable(key, items);
      return items;
    },

    remove(flowerId) {
      const key = KEYS.cart(ownerId());
      const items = readTable(key).filter((i) => i.flowerId !== flowerId);
      writeTable(key, items);
      return items;
    },

    clear() {
      writeTable(KEYS.cart(ownerId()), []);
    },
  };

  /* ════════════════════════════════════════════════════════
     EXPORT — single global `api` object used by every page
  ════════════════════════════════════════════════════════ */
  global.api = { auth, customers, orders, wishlist, cart };
})(window);
