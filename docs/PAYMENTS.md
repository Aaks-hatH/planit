# PlanIt Payments (Bitcoin)

Replaces Stripe for: donations (support page), feature requests, the $299 white-label setup fee,
and white-label monthly subscriptions. Your server derives a unique address per order from a
watch-only xpub (it can never spend), watches the chain, and fulfils each paid invoice exactly once.

---------------------------------------------------------------------------------------------
## 1. Environment variables — set on the ROUTER only

Render → your **router** service → Environment. Backends receive these at boot via `/mesh/config`.
Do not set them on backends. After changing any value, **restart the backends** (they sync on startup).

### Required (3)
| Variable | Value | Notes |
|---|---|---|
| `BTC_XPUB` | the `wpkh([…]xpub…/0/*)#…` descriptor (or bare xpub) exported from Proton Wallet | Watch-only: can't spend. Anyone holding it can *see* your payments, so keep it out of git and chat. |
| `BTC_NETWORK` | `signet` while testing → `mainnet` to take real money | A mainnet xpub is rejected on a test network and vice versa. |
| `PAYMENTS_ENC_KEY` | 64 hex characters you generate once | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — back it up in a password manager. If lost, stored buyer emails can't be decrypted. Production refuses to start payments without it. |

### Strongly recommended (1)
| Variable | Value | Why |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | your Discord channel webhook | It's the only place you're alerted to: new payments, payments needing review (late/partial), failed fulfilment, and renewals due/overdue. If it's already set on backends, move it to the router. |

### Leave unset (defaults already match PlanIt's pricing)
| Variable | Default | What it does |
|---|---|---|
| `WL_PRICE_BASIC_CENTS` / `_PRO_` / `_ENTERPRISE_` | 4900 / 9999 / 14999 | Fallback monthly price when a client has no amount set. Matches the public $49 / $99.99 / $149.99. Set only if you change public pricing. |
| `BTC_CONF_SMALL` / `_MEDIUM` / `_LARGE` | 0 / 1 / 2 | Confirmations required: under $20 / under $100 / $100+. So donations (≥$3) are instant, Basic ($49) and Pro ($99.99) wait ~10 min, Enterprise ($149.99) and the $299 setup fee wait ~20 min. Raise `BTC_CONF_SMALL` to 1 if you ever see abuse on donations. |
| `BTC_QUOTE_MIN_SUPPORT` / `BTC_QUOTE_MIN_WL` | 20 / 60 | Minutes the BTC price stays locked. |
| `BTC_TOLERANCE_BPS` | 100 | Underpay tolerance (1%) to absorb rounding. |
| `BTC_MAX_USD_CENTS` | 500000 | Per-invoice cap ($5,000). |
| `BTC_API_BASE`, `BTC_TEST_RATE_USD` | — | Only for a self-hosted node / fixed test-network rate. |

### Already on your services (unchanged, still required)
- Every backend: `ROUTER_URL` (use the **https://** URL) and `MESH_SECRET`.
- Router: `FRONTEND_URL` — payment links sent to clients are built from it.
- Frontend: `VITE_API_URL` and `VITE_WS_URL` (the pay page uses the same ones as the rest of the app).

### Your real numbers (for reference)
Setup fee $299 · Basic $49/mo · Pro $99.99/mo · Enterprise $149.99/mo · donations from $3 · feature requests from $5.
> Heads up: `Admin.jsx` has quick-presets of Basic $99 / Pro $99 / Enterprise $149 that don't match the public
> $49 / $99.99 / $149.99. The admin amount overrides the fallback, so double-check the amount when you set up a client.

---------------------------------------------------------------------------------------------
## 2. Test before real money
Full step-by-step guide: **`docs/PAYMENT_TESTING.md`** (self-test → local signet run → router/staging → $3 mainnet).
Quick version: `cd backend && node scripts/payments-selftest.js` (no setup needed) → signet with a test wallet → mainnet $3 donation.

## 3. How it works
1. `routes/support.js` / `routes/whitelabel.js` validate the request and call `payments.createInvoice()` with a USD amount decided by the **server** (the browser never sends a BTC amount or address).
2. A BTC/USD quote is locked, a never-used address is derived from your xpub, and an `Invoice` is stored (email/name encrypted with AES-256-GCM).
3. The buyer lands on `/pay/:id` — QR code, "open in wallet", countdown, live status (Socket.IO + polling).
4. `jobs/paymentWatcher.js` (every backend, lease-coordinated) reads mempool.space and moves `pending → detected → confirmed`.
5. On `confirmed`, `services/payments/fulfillment.js` runs **exactly once**; buyer PII is wiped from the invoice afterwards.

Late or partial payments go to `review` and ping Discord. Resolve with `POST /api/payments/admin/:id/resolve` `{ "action": "accept" | "reject", "note": "…" }` (admin login required).

## 4. Security model
| Threat | Defence |
|---|---|
| Server hack steals funds | Server holds only an xpub — it cannot spend. |
| Buyer tampers with price/address | Amounts computed server-side from USD cents; invoice fields immutable. |
| Double-credit / replay | Atomic status transitions + exactly-once fulfilment lease; idempotent upserts. |
| Odd payments auto-accepted | Late/partial payments go to `review`, never auto-fulfilled. |
| Address reuse | Each address checked never-used on-chain before issue. |
| Wallet can't "see" payments (gap limit) | Never-used addresses are recycled so issued indexes stay contiguous. |
| Invoice spam | Per-IP creation limits, per-IP and global open-invoice caps, quote expiry. |
| PII exposure | AES-256-GCM (bound to invoice id), wiped after fulfilment; IPs stored only as keyed hashes. |
| Config divergence between instances | Wallet key, network, and PII key are force-synced from the router. |
| Secrets in transit | Router→backend over HTTPS + HMAC mesh auth (warns if `ROUTER_URL` isn't https). |
| Discord injection | Mentions disabled, user text sanitised. |
| Hostile chain/price data | Shape-checked responses, price sanity bounds, fallback providers, HTTPS only. |
| Invoice enumeration | 128-bit random ids, `no-store`, no PII in public view. |

## 5. Limits (by design)
- No automatic recurring charges — Bitcoin can't be pulled. A daily job posts "renewal due/overdue" in Discord; use **Admin → White Label → client → Create Payment Link** to send the monthly invoice.
- Refunds are manual (Bitcoin is irreversible). No emails to buyers; the receipt is the pay page.
- Quote windows are 20 min (support) / 60 min (white label); price moves inside that window are on you.
- Real revenue (the $299 fee, subscriptions) can carry tax/reporting obligations — go over it with your parents.
