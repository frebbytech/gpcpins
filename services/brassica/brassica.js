'use strict';
/**
 * Brassica payment processor client (collect money / power-charge + refund notifications).
 *
 * Flow:  requestPayment -> (callback from Brassica, handled in callbacks.js)
 *        -> if no callback within ~5-10s: checkPaymentStatus (TSQ)
 *        -> after meter is charged: notifyPowerCharge
 *        -> on refund: notifyRefund
 *
 * NOTE: field names such as `extralTransactionId` are spelled exactly as the
 * provider spells them. Do not "fix" them.
 */
const crypto = require('crypto');
const config = require("../../config/brassica");
const { assertConfig } = config;
const { postJson } = require('../http');
const { ProviderError } = require('../errors');

const PROVIDER = 'brassica';
const CHANNELS = ['MTN', 'VODAFONE', 'ATMONEY'];
const METER_TYPES = ['OFFLINE', 'ONLINE', 'POSTPAID'];
const POWER_CHARGE_STATUSES = ['Successful', 'Failed'];
const REFRESH_MARGIN_MS = 60_000;
const FALLBACK_TOKEN_TTL_MS = 50 * 60_000;

let cached = { token: null, expiresAt: 0 };
let inflight = null;

// ---------------------------------------------------------------- helpers

function jwtExpiryMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function toAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new TypeError(`Invalid amount: ${value}`);
  return n.toFixed(2); // provider expects a string like "1.00"
}

function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length) throw new TypeError(`Missing required field(s): ${missing.join(', ')}`);
}

/** Map a provider statusCode to a simple state your code can branch on. */
function classifyStatus(statusCode) {
  switch (String(statusCode)) {
    case '200':
      return 'SUCCESS';
    case '202':
      return 'PENDING';
    case '427':
      return 'REFUNDED';
    case '300':
    case '303':
    case '401':
    case '402':
    case '403':
    case '404':
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}

// ------------------------------------------------------------------- auth

async function fetchToken() {
  assertConfig('brassica', ['baseUrl', 'apiUser', 'apiKey']);
  const { baseUrl, apiUser, apiKey, timeoutMs } = config.brassica;
  const res = await postJson(`${baseUrl}/api/Auth`, {
    body: { apiUser, apiKey },
    timeoutMs,
    provider: PROVIDER,
  });
  const d = res.data || {};
  if (!res.ok || String(d.respCode) !== '200' || !d.token) {
    throw new ProviderError(`Brassica auth failed: ${d.respDesc || `HTTP ${res.status}`}`, {
      provider: PROVIDER,
      httpStatus: res.status,
      code: d.respCode,
      body: { respCode: d.respCode, respDesc: d.respDesc }, // never include the token/keys
    });
  }
  cached = {
    token: d.token,
    expiresAt: jwtExpiryMs(d.token) ?? Date.now() + FALLBACK_TOKEN_TTL_MS,
  };
  return cached.token;
}

/** POST /api/Auth. Returns a cached bearer token, refreshing shortly before expiry. */
function getToken({ force = false } = {}) {
  if (!force && cached.token && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return Promise.resolve(cached.token);
  }
  if (!inflight) inflight = fetchToken().finally(() => (inflight = null));
  return inflight;
}

/** Authenticated POST. Retries once with a fresh token on HTTP 401. */
async function authedPost(path, body, context) {
  const { baseUrl, apiUser, timeoutMs } = config.brassica;
  const attempt = async (force) => {
    const token = await getToken({ force });
    return postJson(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, ApiUser: apiUser },
      body,
      timeoutMs,
      provider: PROVIDER,
    });
  };
  try {
    let res = await attempt(false);
    if (res.status === 401) res = await attempt(true);
    return res;
  } catch (err) {
    if (err instanceof ProviderError) err.context = { ...err.context, ...context, path };
    throw err;
  }
}

function failFrom(res, label, context) {
  const d = res.data || {};
  return new ProviderError(`${label}: ${d.message || `HTTP ${res.status}`}`, {
    provider: PROVIDER,
    httpStatus: res.status,
    code: d.statusCode,
    body: d,
    context,
  });
}

// ------------------------------------------------------- payment endpoints

/**
 * POST /api/Payment/PaymentWithDebit  (asynchronous - result arrives via callback)
 *
 * Generates transactionId / asyncId (UUID v4) if you don't pass them. PERSIST the
 * returned ids and the processor's `accepted.transactionId` / `accepted.extralTransactionId`
 * before doing anything else: the callback carries the processor's ids.
 */
async function requestPayment(p) {
  requireFields(p, ['amount', 'accountNumber', 'paymentChannel', 'paymentNaration', 'paymentBy']);

  const paymentChannel = String(p.paymentChannel).trim().toUpperCase();
  if (!CHANNELS.includes(paymentChannel)) {
    throw new TypeError(`paymentChannel must be one of ${CHANNELS.join(', ')}`);
  }
  const meterType = p.meterType ? String(p.meterType).trim().toUpperCase() : undefined;
  if (meterType && !METER_TYPES.includes(meterType)) {
    throw new TypeError(`meterType must be one of ${METER_TYPES.join(', ')}`);
  }

  const merchantCode = p.merchantCode || config.brassica.defaultMerchantCode;
  const terminalId = p.terminalId || config.brassica.defaultTerminalId;
  if (!merchantCode || !terminalId) throw new TypeError('merchantCode and terminalId are required');

  const transactionId = p.transactionId || crypto.randomUUID();
  const asyncId = p.asyncId || crypto.randomUUID();

  const body = {
    paymentMode: p.paymentMode || 'WALLET',
    amount: toAmount(p.amount),
    accountNumber: String(p.accountNumber), // wallet number, or "walletNumber/cardRef" per provider
    transactionId,
    asyncId,
    paymentChannel,
    merchantCode,
    terminalId,
    paymentNaration: p.paymentNaration, // spelled as the provider spells it
    paymentProduct: p.paymentProduct || 'ECG',
    paymentBy: p.paymentBy,
    ...(p.meterNumber && { meterNumber: String(p.meterNumber) }),
    ...(meterType && { meterType }),
  };

  const context = { transactionId, asyncId };
  const res = await authedPost('/api/Payment/PaymentWithDebit', body, context);
  const d = res.data || {};
  if (!res.ok || String(d.statusCode) !== '202') throw failFrom(res, 'Payment request rejected', context);

  return { sent: { transactionId, asyncId }, accepted: d };
}

/** POST /api/Payment/TSQ - synchronous status check. */
async function checkPaymentStatus({ transactionId, asyncId }) {
  requireFields({ transactionId, asyncId }, ['transactionId', 'asyncId']);
  const context = { transactionId, asyncId };
  const res = await authedPost('/api/Payment/TSQ', { transactionId, asyncId }, context);
  if (!res.ok) throw failFrom(res, 'Payment status check failed', context);
  const d = res.data || {};
  return { state: classifyStatus(d.statusCode), response: d };
}

/**
 * Polling helper for when no callback arrives. The doc says to call TSQ after
 * 5-10s without a callback. Prefer checking your own DB (callback may have landed)
 * between polls if you have one.
 */
async function waitForPaymentResult({
  transactionId,
  asyncId,
  initialDelayMs = 7000,
  intervalMs = 5000,
  timeoutMs = 60000,
} = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const deadline = Date.now() + timeoutMs;
  await sleep(initialDelayMs);
  let last;
  do {
    last = await checkPaymentStatus({ transactionId, asyncId });
    if (last.state !== 'PENDING') return last;
    await sleep(intervalMs);
  } while (Date.now() < deadline);
  return last; // still PENDING: caller decides (retry later / alert)
}

// ------------------------------------------- notifications to the processor

/**
 * POST /api/PowerCharge/PowerChargeCallBack - tell Brassica the final meter-charge result.
 * status: "Successful" | "Failed".
 */
async function notifyPowerCharge({ asyncId, transactionId, merchantCode, terminalId, status }) {
  const body = {
    asyncId,
    transactionId,
    merchantCode: merchantCode || config.brassica.defaultMerchantCode,
    terminalId: terminalId || config.brassica.defaultTerminalId,
    status,
  };
  requireFields(body, ['asyncId', 'transactionId', 'merchantCode', 'terminalId', 'status']);
  if (!POWER_CHARGE_STATUSES.includes(status)) {
    throw new TypeError(`status must be one of ${POWER_CHARGE_STATUSES.join(', ')}`);
  }
  const context = { asyncId, transactionId };
  const res = await authedPost('/api/PowerCharge/PowerChargeCallBack', body, context);
  const d = res.data || {};
  if (!res.ok || d.status !== 'OK') throw failFrom(res, 'Power charge notification failed', context);
  return d;
}

/**
 * Refund notification. The doc lists the SAME URL as the power-charge notification
 * (/api/PowerCharge/PowerChargeCallBack) with a different body. Confirm with Brassica
 * that this isn't a copy-paste error; override the path via `path` if they give another.
 */
async function notifyRefund(
  { statusCode = '427', status = 'Refunded', message = 'Payment refunded successfully.', institutionApprovalCode, transactionId, extralTransactionId, reason = null, asyncId },
  { path = '/api/PowerCharge/PowerChargeCallBack' } = {}
) {
  const body = { statusCode, status, message, institutionApprovalCode, transactionId, extralTransactionId, reason, asyncId };
  requireFields(body, ['institutionApprovalCode', 'transactionId', 'extralTransactionId', 'asyncId']);
  const context = { asyncId, transactionId };
  const res = await authedPost(path, body, context);
  const d = res.data || {};
  if (!res.ok || d.status !== 'OK') throw failFrom(res, 'Refund notification failed', context);
  return d;
}

module.exports = {
  getToken,
  requestPayment,
  checkPaymentStatus,
  waitForPaymentResult,
  notifyPowerCharge,
  notifyRefund,
  classifyStatus,
  CHANNELS,
  METER_TYPES,
};
