# FBI Bites

FBI Bites ordering website with a browser cart, WhatsApp ordering, and a Node.js backend for Safaricom Daraja STK Push.

## Run locally

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and enter your Daraja credentials and callback URL.
4. Run `npm start` and open http://localhost:3000.

For sandbox testing, create a Daraja app and use its consumer key and secret, the sandbox shortcode and passkey supplied by Safaricom, and a public HTTPS callback URL. Generate a private callback token with `openssl rand -hex 32`, set it as `MPESA_CALLBACK_SECRET`, then set `MPESA_CALLBACK_URL` to `https://<public-host>/api/mpesa/callback/<same-token>`. A local callback can be exposed temporarily with a tunnelling service such as ngrok. Never put Daraja secrets in `script.js`, HTML, or a public repository.

`MPESA_ENV=sandbox` is the default. Sandbox prompts do not collect real money. Live payments require Safaricom production credentials, an approved shortcode/till, and an HTTPS deployment with a stable callback URL. Daraja STK Push pays to a registered PayBill or Till; it cannot send an STK prompt directly to the personal phone number `0790569032`. That number remains available for manual M-Pesa payments and WhatsApp orders.

## Payment flow

The browser sends product IDs, quantities, and the customer's M-Pesa number to the server. The server recalculates prices from its catalog, requests the STK prompt, and accepts the Daraja callback. The browser polls the server for the callback result. WhatsApp ordering remains available separately.

Payment records and the initial per-IP request limit currently live in server memory and reset on restart. Use persistent order storage and a shared rate-limit store before accepting production orders. Callback receipt and amount are checked against the pending request; operational reconciliation is still required before fulfilling an order.

## Menu catalog

`products.js` is the shared product catalog used to render featured items, category filters, search results, and menu cards in the browser. The backend reads the same data to validate checkout prices. Add products with a unique stable ID, a category, `available`, and a numeric `price`; use `price: null` until the price is confirmed. Set `priceIsEstimate: true` for provisional prices. Add each food photo under `images/` using the filename in that product's `image` value; until it exists, the card automatically displays the FBI Bites image placeholder. Empty recommended categories such as Meals and Drinks are already available as filters for future additions.
