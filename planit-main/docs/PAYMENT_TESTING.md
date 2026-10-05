# Testing PlanIt Payments — step by step

Work through the stages in order. Each one catches a different kind of problem, and only the last one uses real money.

| Stage | What it proves | Money | Time |
|---|---|---|---|
| 1. Self-test | the payment logic is correct | none | 2 min |
| 2. Local run on signet | the whole flow works end to end | fake coins | 1–2 hrs (waiting on blocks) |
| 3. Staging on signet | the router → backend env sharing works | fake coins | 30 min |
| 4. Mainnet $3 | your real Proton wallet receives the money | ~$3 real | 30 min |

---------------------------------------------------------------------------------------------
## Stage 1 — Self-test (no setup, no wallet, no database)

```bash
cd backend
npm install
node scripts/payments-selftest.js
```
Expected last line: **`ALL PASSED — 32 passed, 0 failed`**.

It uses throw-away keys and a fake blockchain to check address derivation, money math, encryption, and the payment state machine (paid, partial, late, dropped transaction, exactly-once fulfilment). If anything fails, stop and send me the output.

---------------------------------------------------------------------------------------------
## Stage 2 — Full flow on your computer / Codespace, using signet (fake coins)

Signet is a test copy of Bitcoin. Its coins are free and worthless. The app talks to mempool.space's signet service, so you need internet but no Bitcoin node.

### 2a. Make two test wallets
You need a **shop wallet** (its public key goes in the app) and a **customer wallet** (pays the invoices). Electrum is the simplest because it has a signet switch:

1. Install Electrum from electrum.org.
2. Shop wallet: `electrum --signet -w shop` → New wallet → Standard → Create a new seed → keep the default **Segwit** seed type → save the seed (it's fake money, but practice good habits).
3. In the shop wallet: **Wallet → Information** → copy the **Master Public Key**. It starts with `vpub` or `tpub`. This is your test `BTC_XPUB`.
4. Customer wallet: `electrum --signet -w customer` → create the same way. Open its **Receive** tab and copy an address.
5. Get free signet coins sent to the **customer** wallet's address from a signet faucet. Faucets come and go; the Bitcoin wiki's Signet page (en.bitcoin.it/wiki/Signet) keeps a current list, and signetfaucet.com has been around for years. Wait for a confirmation (signet blocks arrive roughly every 10 minutes).

Sparrow also supports signet; Electrum's `--signet` flag is just the least fiddly.

### 2b. Configure the backend locally
In a local run there's no router, so put everything in `backend/.env` (leave `ROUTER_URL` empty and the backend simply uses local values):

```
NODE_ENV=development
PORT=5000
MONGODB_URI=<your MongoDB connection string — a free Atlas cluster is fine>
JWT_SECRET=<any long random string>
ADMIN_USERNAME=<pick one>
ADMIN_PASSWORD=<pick one>
FRONTEND_URL=http://localhost:5173

BTC_XPUB=<the vpub/tpub from step 3>
BTC_NETWORK=signet
PAYMENTS_ENC_KEY=<64 hex chars — node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
BTC_TEST_RATE_USD=150000
BTC_QUOTE_MIN_SUPPORT=3
```
Why `BTC_TEST_RATE_USD=150000`: signet coins have no price, so the app uses this fixed rate. At 150,000 a $3 donation is 2,000 sats and the $299 fee is about 0.002 test-BTC, small enough for a faucet drip. `BTC_QUOTE_MIN_SUPPORT=3` makes a quote expire after 3 minutes so you can test expiry quickly.

Frontend `frontend/.env`:
```
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
```
Run them (two terminals): `cd backend && npm run dev` and `cd frontend && npm run dev`. Open http://localhost:5173.

**Check the backend log says:** `[payments] PlanIt Payments active — Bitcoin signet`.
If it says `NOT ACTIVE: …`, the message tells you which variable is wrong.

### 2c. Test cases
Run these in order. Each has an expected result.

| # | Do this | You should see |
|---|---|---|
| 1 | Open `/support`, enter $3, an email, a name, a message, press pay | You land on `/pay/<long id>` with a QR code, a BTC amount, an address, and a countdown |
| 2 | **Compare the address** to the shop wallet: Electrum → Addresses tab (or Receive). The first `tb1q…` address should match | They match. This proves the app derives the same addresses as your wallet. **If they don't match, stop.** |
| 3 | From the customer wallet send **exactly** the amount shown to that address. Turn off any "subtract fee from amount" option | Within ~30 s the page says *Payment detected*, then *Payment confirmed* (donations under $20 need 0 confirmations) and redirects to the thank-you page |
| 4 | Look at `/support/wall` and your Discord channel | The donor appears on the wall; Discord shows "New Donation" |
| 5 | Make another $5+ **feature request** and pay it | Same flow; Discord shows "New Feature Request" |
| 6 | Make a $3 donation, send only **half** the amount | Page says part of the payment was received and asks for the remaining amount. Send the remainder → confirmed |
| 7 | Make a donation and **don't pay**. Wait 3 minutes | Page shows "This quote expired" → press "Get a new quote" → a new address appears |
| 8 | Pay the **old, expired** address | Page shows "We're checking your payment", Discord shows a review alert, nothing is credited automatically |
| 9 | Resolve #8 (see "Resolving a review" below) | Status becomes confirmed (accept) or rejected |
| 10 | Open `/white-label/setup-fee?lead=<a lead's id>` (get the id from the White Label leads in Admin, or the `wlleads` collection) and pay $299 | Needs 2 confirmations (~20 min on signet). Then the lead is marked paid and Discord shows "White Label Setup Fee Received" |
| 11 | Admin → White Label → create a client, set a monthly amount → **Create Payment Link** → pay it | Link is copied; after confirmation the client shows *active* and "paid through" moves 30 days forward |
| 12 | Pay a donation, then stop the backend (Ctrl-C) **before** it confirms, wait a minute, start it again | It picks the payment up and completes. Only **one** record exists in the `supports` collection for that invoice (no double credit) |

### Resolving a review (test 9)
Get your admin token: log in at `/admin`, open the browser's developer tools → Application → Local Storage → copy the `adminToken` value. Then:
```bash
curl -X POST http://localhost:5000/api/payments/admin/<invoice id>/resolve \
  -H "Authorization: Bearer <adminToken>" -H "Content-Type: application/json" \
  -d '{"action":"accept","note":"test"}'
```
Use `"reject"` to refuse it. The invoice id is the long id in the `/pay/…` URL.

To list recent invoices: `curl -H "Authorization: Bearer <adminToken>" http://localhost:5000/api/payments/admin/list`.

---------------------------------------------------------------------------------------------
## Stage 3 — Staging on signet through the router

Now prove that settings really flow from the router to every backend.

1. On the **router** service set `BTC_XPUB` (the signet one), `BTC_NETWORK=signet`, `PAYMENTS_ENC_KEY`, `BTC_TEST_RATE_USD=150000`, and `DISCORD_WEBHOOK_URL`. Make sure **no backend** has any of these set.
2. Deploy the new code to the router and all backends, then **restart the backends**.
3. In **each** backend's log look for both lines:
   - `[configSync] Synced from router: … BTC_XPUB, BTC_NETWORK, PAYMENTS_ENC_KEY …`
   - `[payments] PlanIt Payments active — Bitcoin signet`
4. Repeat test cases 1–4 and 11 against the deployed site. If you have several backends, do a few donations in a row. They may be served by different backends, and each one should work and show the same kind of address.

---------------------------------------------------------------------------------------------
## Stage 4 — Real money, small: a $3 donation on mainnet

Do this only after stages 1–3 pass.

1. **Check your Proton wallet matches the key.** The first address the app will hand out for the xpub you gave me is `bc1qhzg3jntgv08ma96y560j22s4uz75cf668yl7lp`.
   The address you originally sent (`bc1qc53mex…`) is **not** one of the first 200 addresses of that xpub. Proton Wallet can hold several wallets and accounts, each with its own xpub, so make sure the xpub you export is from the same wallet and account that you expect to receive into. If you can't find `bc1qhzg3…` in that Proton wallet, don't go live yet. Re-export the xpub from the right wallet/account, or send me the details and we'll work it out.
2. On the router, switch to your Proton `BTC_XPUB` and `BTC_NETWORK=mainnet`, **remove** `BTC_TEST_RATE_USD`, and restart the backends. The log should say `Bitcoin mainnet`.
3. Make a $3 donation on the live site. Confirm the page shows a bc1q… address and a sensible BTC amount (about $3 at the current price).
4. Pay it from any wallet or exchange. The real network fee is extra, so it costs you a little more than $3.
5. The page should flip to *Paid* and Discord should show the donation. Then open **Proton Wallet** and confirm the incoming transaction is there. That is the proof the money reached you.
6. Optionally, repeat once with the $5 feature request. After that, go live.

---------------------------------------------------------------------------------------------
## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Log: `NOT ACTIVE: BTC_XPUB is not configured` | The variable isn't reaching the backend. Set it on the router, check `ROUTER_URL`/`MESH_SECRET` on the backend, restart the backend. |
| Log: `BTC_XPUB (xpub) does not match BTC_NETWORK=signet` | A mainnet key on a test network (or the reverse). Use a signet `vpub`/`tpub` for signet and an `xpub` for mainnet. |
| Checkout says "Payments are not configured" | Same as above; the backend started without valid settings. |
| Checkout says "Amount too small" | Test rate too high. Lower `BTC_TEST_RATE_USD` or set `BTC_MIN_SATS=500`. |
| Page stays on "Waiting" though you paid | Check the transaction on mempool.space/signet/address/<address> (mainnet: mempool.space/address/<address>). Wrong address, wrong amount, or the wallet deducted the fee from the amount are the usual causes. Press "I've paid — check now". |
| "Payment detected" but never confirms | It needs the confirmation count shown on the page. If the fee was very low, the transaction can sit unconfirmed for a long time. |
| Page doesn't update live | The page also polls every few seconds, so it still updates. Check `VITE_WS_URL` if you want instant updates. |
| A payment shows "We're checking your payment" | It was late or a partial amount. Resolve it with the admin call above. Do not ask the buyer to pay again. |

## What to watch after launch
- Discord is your alert channel: new payments, reviews, failed fulfilments, renewals due.
- Check `GET /api/payments/admin/list` occasionally for anything stuck in `review`.
- Bitcoin payments can't be reversed, so refunds are manual.
