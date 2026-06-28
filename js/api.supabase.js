/**
 * api.supabase.js — Real backend, same interface as js/api.js
 * ─────────────────────────────────────────────────────────────
 * This is a drop-in replacement for js/api.js. Every other file
 * in the project (header.js, booking.js, account.js, flowers.js,
 * home.js, flower-detail.js, cart.js, wishlist.js) calls `api.*`
 * exactly the same way no matter which of the two files is loaded
 * — only the <script> tags in each .html file change. See the
 * "SWITCHING TO SUPABASE" section of README.md for the full
 * step-by-step.
 *
 * WHY MODULE SCRIPTS?
 * This file needs `import` (for supabase-js and your config), so
 * it must be loaded as <script type="module">. Module scripts are
 * deferred automatically by the browser, so they still run in the
 * same relative order as the rest of the page's <script defer>
 * tags — nothing else about load order changes.
 *
 * SYNC vs ASYNC — the one real architectural difference
 * The localStorage version can answer api.wishlist.has(id) and
 * api.cart.count() instantly because everything is already in
 * memory. A real backend can't — every read is a network call.
 * To avoid rewriting every page that calls those functions
 * synchronously, this file keeps a small in-memory cache for the
 * current user, their wishlist, and their cart, loaded once via
 * `api.auth.ready` (every page already awaits this — see header.js
 * etc.) and kept in sync by writing through the cache on every
 * change. Orders and profile updates are rare enough that they
 * stay fully async, exactly like the localStorage version.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Guest-only local storage (used only when nobody is signed in) ── */
const GUEST_WISHLIST_KEY = 'mtf_sb_guest_wishlist';
const GUEST_CART_KEY     = 'mtf_sb_guest_cart';
const readLocal  = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const writeLocal = (key, val) => localStorage.setItem(key, JSON.stringify(val));

/* ── In-memory caches, populated by refreshCaches() ──────────────── */
let _cachedUser  = null;  // { id, email, fullName, phone, address } | null
let _wishlist    = [];    // array of flower ids
let _cart        = [];    // array of { flowerId, name, price, image, qty }

let _readyResolve;
const readyPromise = new Promise((res) => { _readyResolve = res; });

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

/** Pull the latest user + wishlist + cart into memory. Called on boot and on every auth change. */
async function refreshCaches(session) {
  if (!session?.user) {
    _cachedUser = null;
    _wishlist = readLocal(GUEST_WISHLIST_KEY);
    _cart = readLocal(GUEST_CART_KEY);
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, address')
    .eq('id', session.user.id)
    .single();

  _cachedUser = {
    id: session.user.id,
    email: session.user.email,
    fullName: profile?.full_name || session.user.user_metadata?.full_name || 'Customer',
    phone: profile?.phone || '',
    address: profile?.address || '',
  };

  const [{ data: wishRows }, { data: cartRows }] = await Promise.all([
    supabase.from('wishlist').select('flower_id').eq('customer_id', session.user.id),
    supabase.from('cart_items').select('flower_id, name, price, image, qty').eq('customer_id', session.user.id),
  ]);
  _wishlist = (wishRows || []).map((r) => r.flower_id);
  _cart = (cartRows || []).map((r) => ({ flowerId: r.flower_id, name: r.name, price: r.price, image: r.image, qty: r.qty }));
}

/** Move a guest's local cart/wishlist into their account right after they sign in. */
async function mergeGuestDataInto(userId) {
  const guestWishlist = readLocal(GUEST_WISHLIST_KEY);
  const guestCart = readLocal(GUEST_CART_KEY);
  if (!guestWishlist.length && !guestCart.length) return;

  if (guestWishlist.length) {
    await supabase.from('wishlist').upsert(
      guestWishlist.map((flower_id) => ({ customer_id: userId, flower_id }))
    );
  }
  if (guestCart.length) {
    await supabase.from('cart_items').upsert(
      guestCart.map((i) => ({ customer_id: userId, flower_id: i.flowerId, name: i.name, price: i.price, image: i.image, qty: i.qty })),
      { onConflict: 'customer_id,flower_id' }
    );
  }
  writeLocal(GUEST_WISHLIST_KEY, []);
  writeLocal(GUEST_CART_KEY, []);
}

/* ── Boot: check for an existing session, then keep listening ──── */
(async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  await refreshCaches(session);
  _readyResolve();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    await refreshCaches(session);
  });
})();

/* ════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════ */
const auth = {
  async register({ fullName, email, phone, password }) {
    if (!fullName || !email || !password) {
      return { ok: false, error: 'Full name, email and password are required.' };
    }
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, phone: phone || '' } },
    });
    if (error) return { ok: false, error: error.message };

    // If your Supabase project has "Confirm email" turned on (the
    // default), data.session is null here — the account exists but
    // can't sign in until the confirmation link is clicked.
    if (!data.session) {
      return { ok: true, customer: null, needsEmailConfirmation: true };
    }

    await refreshCaches(data.session);
    await mergeGuestDataInto(data.session.user.id);
    await refreshCaches(data.session); // pick up the just-merged rows
    return { ok: true, customer: _cachedUser };
  },

  async login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    await mergeGuestDataInto(data.user.id);
    await refreshCaches(data.session);
    return { ok: true, customer: _cachedUser };
  },

  async logout() {
    await supabase.auth.signOut();
    _cachedUser = null;
    _wishlist = [];
    _cart = [];
    return { ok: true };
  },

  /** Sync, like the localStorage version — reads the cache `ready` already populated. */
  currentUser() {
    return _cachedUser;
  },

  isLoggedIn() {
    return !!_cachedUser;
  },

  /** Resolves once the initial session check (+ cache load) finishes. Every page awaits this once. */
  ready: readyPromise,
};

/* ════════════════════════════════════════════════════════
   CUSTOMERS (the "profiles" table)
════════════════════════════════════════════════════════ */
const customers = {
  async get(id) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (!data) return null;
    return { id, fullName: data.full_name, phone: data.phone, address: data.address };
  },

  async update(id, patch) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: patch.fullName, phone: patch.phone, address: patch.address })
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };

    if (_cachedUser && _cachedUser.id === id) {
      _cachedUser = { ..._cachedUser, fullName: data.full_name, phone: data.phone, address: data.address };
    }
    return { ok: true, customer: { id, fullName: data.full_name, phone: data.phone, address: data.address } };
  },
};

/* ════════════════════════════════════════════════════════
   ORDERS
════════════════════════════════════════════════════════ */
const flattenOrder = (row) => ({
  id: row.id,
  customerId: row.customer_id,
  status: row.status,
  createdAt: row.created_at,
  total: row.total,
  ...row.payload,
});

const orders = {
  async create(payload) {
    const { data, error } = await supabase
      .from('orders')
      .insert({ customer_id: _cachedUser ? _cachedUser.id : null, payload, total: payload.total || 0 })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, order: flattenOrder(data) };
  },

  async listByCustomer(customerId) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return (data || []).map(flattenOrder);
  },

  /** Row Level Security means this only ever returns the CURRENT user's
   *  own orders — there is no client-side "admin view" with the anon
   *  key. A real admin dashboard needs a server-side service_role key. */
  async listAll() {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    return (data || []).map(flattenOrder);
  },
};

/* ════════════════════════════════════════════════════════
   WISHLIST — cached in memory (see file header), persisted
   to Supabase when signed in, to localStorage as a guest.
════════════════════════════════════════════════════════ */
const wishlist = {
  list() { return [..._wishlist]; },
  has(flowerId) { return _wishlist.includes(flowerId); },
  count() { return _wishlist.length; },

  /** Sync return value (matches js/api.js) — the network write happens in the background. */
  toggle(flowerId) {
    const liked = _wishlist.includes(flowerId);
    _wishlist = liked ? _wishlist.filter((id) => id !== flowerId) : [..._wishlist, flowerId];

    if (_cachedUser) {
      const op = liked
        ? supabase.from('wishlist').delete().eq('customer_id', _cachedUser.id).eq('flower_id', flowerId)
        : supabase.from('wishlist').upsert({ customer_id: _cachedUser.id, flower_id: flowerId });
      op.then(({ error }) => { if (error) console.error('[wishlist] sync failed', error); });
    } else {
      writeLocal(GUEST_WISHLIST_KEY, _wishlist);
    }
    return { liked: !liked, count: _wishlist.length };
  },

  remove(flowerId) {
    _wishlist = _wishlist.filter((id) => id !== flowerId);
    if (_cachedUser) {
      supabase.from('wishlist').delete().eq('customer_id', _cachedUser.id).eq('flower_id', flowerId)
        .then(({ error }) => { if (error) console.error('[wishlist] remove failed', error); });
    } else {
      writeLocal(GUEST_WISHLIST_KEY, _wishlist);
    }
    return _wishlist;
  },
};

/* ════════════════════════════════════════════════════════
   CART — same cache-then-sync pattern as wishlist.
════════════════════════════════════════════════════════ */
const persistCartRow = (item) => {
  if (!_cachedUser) { writeLocal(GUEST_CART_KEY, _cart); return; }
  supabase.from('cart_items')
    .upsert({ customer_id: _cachedUser.id, flower_id: item.flowerId, name: item.name, price: item.price, image: item.image, qty: item.qty })
    .then(({ error }) => { if (error) console.error('[cart] sync failed', error); });
};
const deleteCartRow = (flowerId) => {
  if (!_cachedUser) { writeLocal(GUEST_CART_KEY, _cart); return; }
  supabase.from('cart_items').delete().eq('customer_id', _cachedUser.id).eq('flower_id', flowerId)
    .then(({ error }) => { if (error) console.error('[cart] remove failed', error); });
};

const cart = {
  list() { return [..._cart]; },
  count() { return _cart.reduce((sum, i) => sum + i.qty, 0); },
  subtotal() { return _cart.reduce((sum, i) => sum + i.price * i.qty, 0); },

  add(flower, qty = 1) {
    const existing = _cart.find((i) => i.flowerId === flower.id);
    if (existing) existing.qty += qty;
    else _cart.push({ flowerId: flower.id, name: flower.name, price: flower.priceMin, image: flower.image, qty });
    persistCartRow(_cart.find((i) => i.flowerId === flower.id));
    return { items: cart.list(), count: cart.count() };
  },

  setQty(flowerId, qty) {
    const item = _cart.find((i) => i.flowerId === flowerId);
    if (!item) return _cart;
    item.qty = Math.max(1, Math.min(20, qty));
    persistCartRow(item);
    return _cart;
  },

  remove(flowerId) {
    _cart = _cart.filter((i) => i.flowerId !== flowerId);
    deleteCartRow(flowerId);
    return _cart;
  },

  clear() {
    const ids = _cart.map((i) => i.flowerId);
    _cart = [];
    if (_cachedUser) {
      supabase.from('cart_items').delete().eq('customer_id', _cachedUser.id).in('flower_id', ids)
        .then(({ error }) => { if (error) console.error('[cart] clear failed', error); });
    } else {
      writeLocal(GUEST_CART_KEY, []);
    }
  },
};

/* ════════════════════════════════════════════════════════
   CONTACT — write-only from the browser's point of view;
   see sql/schema.sql's "messages" table + RLS policy.
════════════════════════════════════════════════════════ */
const contact = {
  async send({ name, email, subject, message }) {
    if (!name || !email || !message) {
      return { ok: false, error: 'Name, email and message are required.' };
    }
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };

    const { data, error } = await supabase
      .from('messages')
      .insert({
        customer_id: _cachedUser ? _cachedUser.id : null,
        name, email, subject: subject || '', message,
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: { id: data.id, ...data } };
  },
};

/* ════════════════════════════════════════════════════════
   EXPORT — same global `api` object every page already uses
════════════════════════════════════════════════════════ */
window.api = { auth, customers, orders, wishlist, cart, contact };
