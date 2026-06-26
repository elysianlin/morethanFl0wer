# More Than Fl0wers — Rebuild Notes

This is the same site, restructured. Open `index.html` in a browser (or
right-click → "Open with Live Server" / double-click the file) — no build
step, no install needed.

## What changed, and where to find it

| # | Ask | Where it lives |
|---|---|---|
| 1 | "API" that stores everything | `js/api.js` — a localStorage-backed stand-in for a real backend. See note below. |
| 2 | Split CSS | `css/variables.css`, `base.css`, `header.css`, `footer.css`, `toast.css`, `home.css`, `flowers.css`, `flower-detail.css`, `booking.css`, `account.css`, all pulled together by `css/main.css` |
| 3 | More JS functions for showing flowers | `js/flowers.js`, `js/home.js`, `js/flower-detail.js` — small single-purpose functions (`buildCard`, `buildProductCard`, `renderFeaturedFlowers`, etc.) instead of one big block |
| 4 | Backup of customer/order info | Every order placed in `booking.html` is saved via `api.orders.create()` → `localStorage["mtf_orders"]`, linked to the logged-in customer if there is one |
| 5 | Flower detail page | `flower-detail.html` + `js/flower-detail.js` (try `flower-detail.html?id=velvet-rose`) |
| 6 | Accounts (login/register, store customer info) | `account.html` (login/register) + `dashboard.html` (profile + order history) + `js/account.js` |
| 7 | All flower data in JSON | `data/flowers.json` (shop products) and `data/booking-items.json` (build-your-own-bouquet components) |
| 8 | No JS in HTML | Every `onerror="…"` is gone. A single listener in `js/header.js` handles broken images site-wide |
| 9 | Toast messages | `js/toast.js` (`Toast.success(...)`, `Toast.error(...)`, `Toast.info(...)`) — used for filters, booking limits, sign-in, and order confirmation |
| 10 | Faster-loading images | Every image is a URL (`picsum.photos/seed/...`) instead of a local file path that may or may not exist |

## About the "API" (important)

This is a static site with no server, so there's nowhere to run a real
database. `js/api.js` fakes one using `localStorage` in your browser:

- `mtf_customers` — every account that registers
- `mtf_orders` — every order, linked to whoever was logged in when they booked
- `mtf_session` — who's currently signed in

Every function (`api.auth.login`, `api.orders.create`, …) is `async` and
returns a Promise on purpose, so if you ever add a real backend (Node,
Firebase, Supabase…) you only need to change what happens *inside* those
functions — every page that calls them (`booking.js`, `account.js`,
`header.js`) stays exactly the same.

**This data lives only in the browser you used.** Clearing site data/cookies
or opening the site in a different browser starts fresh. To peek at what's
stored, open DevTools → Application → Local Storage.

## About the placeholder photos

Every `image` field in the JSON files is a `picsum.photos/seed/<name>/...`
URL — a real, fast-loading photo service, used here as a stand-in. To swap
in real product photos later: upload them anywhere public (your own host,
Imgur, Cloudinary, etc.) and paste that URL into the matching `image` field
in `data/flowers.json` or `data/booking-items.json`. Nothing else needs to
change.

## File map

```
index.html             Home
flowers.html            Shop grid (filters + sort + pagination)
flower-detail.html      One flower's full detail page (?id=...)
booking.html            4-step build-a-bouquet wizard
account.html            Sign in / create account
dashboard.html          Profile + order history (requires sign-in)

css/main.css             ← link this one file from every page
css/*.css                the individual pieces main.css imports

js/api.js               localStorage "backend" (auth + orders)
js/toast.js             toast notifications
js/header.js            shared nav/search/account-state/cart (every page)
js/home.js               index.html only
js/flowers.js            flowers.html only
js/flower-detail.js      flower-detail.html only
js/booking.js            booking.html only
js/account.js            account.html + dashboard.html

data/flowers.json        shop products (name, price, colors, image, meaning…)
data/booking-items.json  build-your-own-bouquet components (stems, templates…)
```
