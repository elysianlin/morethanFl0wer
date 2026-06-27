-- ═══════════════════════════════════════════════════════════
-- More Than Fl0wers — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- ── 1. PROFILES ──────────────────────────────────────────────
-- Supabase Auth already has its own internal users table
-- (auth.users) for email + password. We can't add phone/address
-- columns to it, so we keep a "profiles" table with one row per
-- user, linked 1-to-1 by id.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text default '',
  address     text default '',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are editable by their owner"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Profiles are insertable by their owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Automatically create a profile row whenever someone signs up,
-- using the full_name/phone passed in at signUp() time (see
-- js/api.supabase.js → auth.register).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Customer'),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. ORDERS ────────────────────────────────────────────────
-- One row per order placed in booking.html or cart.html.
-- customer_id is null for guest checkouts.
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  status      text not null default 'received',
  payload     jsonb not null,   -- everything booking.js / cart.js builds: items, delivery, payment, total…
  total       numeric(10,2) not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Customers can view their own orders"
  on public.orders for select
  using (auth.uid() = customer_id);

create policy "Customers can insert their own orders"
  on public.orders for insert
  with check (auth.uid() = customer_id or customer_id is null);

-- NOTE: guest orders (customer_id is null) are NOT selectable by
-- anyone through this policy — by design, guests have no account
-- to check a history against. If you want a guest to look an order
-- up by order id + email, add a separate policy/RPC for that.


-- ── 3. WISHLIST ──────────────────────────────────────────────
create table if not exists public.wishlist (
  customer_id uuid not null references auth.users(id) on delete cascade,
  flower_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (customer_id, flower_id)
);

alter table public.wishlist enable row level security;

create policy "Customers manage their own wishlist"
  on public.wishlist for all
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);


-- ── 4. CART ──────────────────────────────────────────────────
-- Optional: only needed if you want a signed-in shopper's cart to
-- follow them across devices. Guests keep using localStorage —
-- see js/api.supabase.js for how the two are merged on login.
create table if not exists public.cart_items (
  customer_id uuid not null references auth.users(id) on delete cascade,
  flower_id   text not null,
  name        text not null,
  price       numeric(10,2) not null,
  image       text,
  qty         integer not null default 1,
  primary key (customer_id, flower_id)
);

alter table public.cart_items enable row level security;

create policy "Customers manage their own cart"
  on public.cart_items for all
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);
