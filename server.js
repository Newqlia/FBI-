require("dotenv").config();

const express = require("express");
const { rateLimit } = require("express-rate-limit");
const path = require("node:path");
const products = require("./products");

const app = express();
const port = Number(process.env.PORT || 3000);
const deliveryFee = 150;
const productsById = new Map(products.map((product) => [product.id, product]));
const payments = new Map();
let cachedToken = "";
let tokenExpiresAt = 0;
const stkRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many payment attempts. Please wait and try again." },
});

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

function getDarajaBaseUrl() {
  return process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function getDarajaConfig() {
  const required = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
    "MPESA_CALLBACK_URL",
    "MPESA_CALLBACK_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    const error = new Error(`M-Pesa is not configured. Missing: ${missing.join(", ")}`);
    error.status = 503;
    throw error;
  }

  let callbackUrl;
  try {
    callbackUrl = new URL(process.env.MPESA_CALLBACK_URL);
  } catch {
    const error = new Error("MPESA_CALLBACK_URL must be a valid public HTTPS URL.");
    error.status = 503;
    throw error;
  }

  if (callbackUrl.protocol !== "https:") {
    const error = new Error("MPESA_CALLBACK_URL must use HTTPS.");
    error.status = 503;
    throw error;
  }

  if (!/^[A-Za-z0-9_-]{32,}$/.test(process.env.MPESA_CALLBACK_SECRET)) {
    const error = new Error("MPESA_CALLBACK_SECRET must be a random token of at least 32 characters.");
    error.status = 503;
    throw error;
  }

  if (callbackUrl.pathname !== `/api/mpesa/callback/${process.env.MPESA_CALLBACK_SECRET}`) {
    const error = new Error("MPESA_CALLBACK_URL must end with the configured callback secret path.");
    error.status = 503;
    throw error;
  }

  if (!new Set(["sandbox", "production"]).has(process.env.MPESA_ENV || "sandbox")) {
    const error = new Error("MPESA_ENV must be sandbox or production.");
    error.status = 503;
    throw error;
  }

  return {
    callbackUrl: callbackUrl.toString(),
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
  };
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

function calculateOrder(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > products.length) {
    const error = new Error("Add at least one valid item to your order.");
    error.status = 400;
    throw error;
  }

  const seenIds = new Set();
  const orderItems = items.map(({ id, quantity }) => {
    const productId = Number(id);
    const count = Number(quantity);
    const product = productsById.get(productId);

    if (!product || seenIds.has(productId) || !Number.isInteger(count) || count < 1 || count > 20) {
      const error = new Error("Your cart contains an invalid item or quantity.");
      error.status = 400;
      throw error;
    }

    if (!product.available || !Number.isFinite(product.price) || product.price <= 0) {
      const error = new Error(`${product.name} cannot be ordered until it is available and priced.`);
      error.status = 400;
      throw error;
    }

    seenIds.add(productId);
    return { id: productId, name: product.name, price: product.price, quantity: count };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { items: orderItems, subtotal, delivery: deliveryFee, amount: subtotal + deliveryFee };
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const credentials = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");
  const response = await fetch(
    `${getDarajaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` }, signal: AbortSignal.timeout(15000) }
  );
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error("Daraja authorization failed. Check the configured app credentials.");
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max(0, Number(data.expires_in || 3599) - 60) * 1000;
  return cachedToken;
}

function getTimestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

app.post("/api/payments/stk-push", stkRateLimit, async (request, response) => {
  try {
    const phone = normalizePhone(request.body.phone);
    if (!phone) {
      return response.status(400).json({ error: "Enter a valid Kenyan M-Pesa phone number." });
    }

    const order = calculateOrder(request.body.items);
    const config = getDarajaConfig();
    const timestamp = getTimestamp();
    const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64");
    const accessToken = await getAccessToken();
    const stkResponse = await fetch(`${getDarajaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: config.transactionType,
        Amount: order.amount,
        PartyA: phone,
        PartyB: config.shortcode,
        PhoneNumber: phone,
        CallBackURL: config.callbackUrl,
        AccountReference: "FBI BITES",
        TransactionDesc: "FBI Bites order",
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await stkResponse.json();

    if (!stkResponse.ok || !data.CheckoutRequestID) {
      return response.status(502).json({
        error: data.errorMessage || data.ResponseDescription || "Daraja could not start the payment request.",
      });
    }

    payments.set(data.CheckoutRequestID, {
      status: "pending",
      amount: order.amount,
      phone,
      customerName: String(request.body.customerName || "Customer").slice(0, 100),
      location: String(request.body.location || "").slice(0, 200),
      notes: String(request.body.notes || "").slice(0, 500),
      items: order.items,
      createdAt: Date.now(),
    });

    return response.status(202).json({
      checkoutRequestId: data.CheckoutRequestID,
      customerMessage: data.CustomerMessage || "Payment prompt sent.",
    });
  } catch (error) {
    console.error("M-Pesa STK initiation failed:", error.message);
    return response.status(error.status || 502).json({ error: error.status ? error.message : "Unable to contact M-Pesa. Please try again." });
  }
});

app.post("/api/mpesa/callback/:token", (request, response) => {
  if (request.params.token !== process.env.MPESA_CALLBACK_SECRET) {
    return response.status(404).json({ error: "Not found." });
  }

  const callback = request.body?.Body?.stkCallback;
  const checkoutRequestId = callback?.CheckoutRequestID;
  const payment = payments.get(checkoutRequestId);

  if (callback && payment && payment.status === "pending") {
    if (Number(callback.ResultCode) !== 0) {
      payment.status = "failed";
      payment.message = callback.ResultDesc || "Payment was not completed.";
    } else {
      const metadata = callback.CallbackMetadata?.Item || [];
      const values = Object.fromEntries(metadata.map((item) => [item.Name, item.Value]));
      const amountMatches = Number(values.Amount) === payment.amount;
      const phoneMatches = normalizePhone(values.PhoneNumber) === payment.phone;

      payment.status = amountMatches && phoneMatches && values.MpesaReceiptNumber ? "paid" : "review";
      payment.receipt = values.MpesaReceiptNumber ? String(values.MpesaReceiptNumber) : "";
      payment.completedAt = Date.now();
    }
  } else {
    console.warn("Received an M-Pesa callback for an unknown checkout request.");
  }

  return response.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

app.get("/api/payments/:checkoutRequestId", (request, response) => {
  const payment = payments.get(request.params.checkoutRequestId);
  if (!payment) return response.status(404).json({ error: "Payment request not found. Please contact FBI Bites." });
  return response.json({ status: payment.status, receipt: payment.receipt || "", message: payment.message || "" });
});

app.get("/", (request, response) => response.sendFile(path.join(__dirname, "index.html")));
app.get(["/index.html", "/style.css", "/script.js", "/products.js"], (request, response) => {
  response.sendFile(path.join(__dirname, path.basename(request.path)));
});
app.use("/images", express.static(path.join(__dirname, "images"), { maxAge: "1h" }));

app.use((error, request, response, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json({ error: "Request body must be valid JSON." });
  }
  console.error("Request failed:", error.message);
  return response.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, () => {
  console.log(`FBI Bites server listening on http://localhost:${port}`);
});