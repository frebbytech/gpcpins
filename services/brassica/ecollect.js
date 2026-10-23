'use strict';
/**
 * eCollect (TGL) client: meter lookup, prepaid online inquiry/charge/status,
 * postpaid inquiry/payBill/status.
 *
 * Auth: every request carries
 *   Referrer:      <terminal id>
 *   Authorization: SHA-256( terminalId + PIN + apiKey + asyncRequestId )  (hex)
 * so each call needs the asyncRequestId (UUID v4) it is sent with.
 *
 * Idempotency: generate and STORE the asyncRequestId before calling a charge. If the
 * call times out, ProviderError.context.asyncRequestId lets you check status
 * instead of charging again.
 */
const crypto = require('crypto');
const config = require('./config');
const { assertConfig } = config;
const { postJson } = require('./http');
const { ProviderError } = require('./errors');

const PROVIDER = 'ecollect';

// ---------------------------------------------------------------- helpers

const sha256Hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

function buildAuthHeaders(asyncRequestId) {
  const { terminalId, pin, apiKey } = config.ecollect;
  return {
    Referrer: terminalId,
    Authorization: sha256Hex(`${terminalId}${pin}${apiKey}${asyncRequestId}`),
  };
}

function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length) throw new TypeError(`Missing required field(s): ${missing.join(', ')}`);
}

function toChargeValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new TypeError(`Invalid amount: ${value}`);
  return Number(n.toFixed(2));
}

/**
 * Interpret status.code from the response table:
 * 0 success | 2002 pending | -3 timeout (outcome unknown - check status!) | others failed.
 */
function interpret(data) {
  const code = data?.status?.code;
  const message = data?.status?.message;
  let outcome = 'FAILED';
  if (code === 0) outcome = 'SUCCESS';
  else if (code === 2002) outcome = 'PENDING';
  else if (code === -3) outcome = 'UNKNOWN';
  return { outcome, code, message };
}

async function call(method, body, asyncRequestId) {
  assertConfig('ecollect', ['baseUrl', 'terminalId', 'pin', 'apiKey']);
  const context = { asyncRequestId, method };
  let res;
  try {
    res = await postJson(`${config.ecollect.baseUrl}/${method}`, {
      headers: buildAuthHeaders(asyncRequestId),
      body,
      timeoutMs: config.ecollect.timeoutMs,
      provider: PROVIDER,
    });
  } catch (err) {
    if (err instanceof ProviderError) err.context = { ...err.context, ...context };
    throw err;
  }
  if (!res.ok) {
    throw new ProviderError(`eCollect ${method} failed: HTTP ${res.status}`, {
      provider: PROVIDER,
      httpStatus: res.status,
      body: res.data,
      context,
    });
  }
  return res.data;
}

const meterBlock = (m) => ({
  referenceId: m.meterId, // PayLoad.MeterId from getMeterInfo
  meterSerial: String(m.meterNumber), // the meter number
  mobileNumber: m.mobileNumber ? String(m.mobileNumber) : undefined,
});

const chargeMeterBlock = (m) => ({
  referenceId: m.meterId,
  meterProvider: m.meterProvider, // e.g. "MMS-WASION" (MeterType from getMeterInfo)
  accountNumber: m.accountNumber !== undefined ? String(m.accountNumber) : '',
  mobileNumber: m.mobileNumber ? String(m.mobileNumber) : undefined,
  meterSerial: String(m.meterNumber),
  regionId: m.regionId !== undefined ? String(m.regionId) : undefined,
  districtId: m.districtId !== undefined ? String(m.districtId) : undefined,
});

function chargeBody(p, key) {
  requireFields(p, ['meterId', 'meterNumber', 'amount', 'mobileNumber', 'regionId', 'districtId']);
  const asyncRequestId = p.asyncRequestId || crypto.randomUUID();
  const callbackURL = p.callbackUrl || config.ecollect.callbackUrl;
  if (!callbackURL) throw new TypeError('callbackUrl is required (or set ECOLLECT_CALLBACK_URL)');
  return {
    asyncRequestId,
    body: {
      merchant: p.merchant || config.ecollect.merchant,
      request: { asyncRequestId },
      charge: {
        chargeValue: toChargeValue(p.amount),
        callbackURL,
        paymentReference: asyncRequestId, // doc: same as asyncRequestId
      },
      paymentInstrument: {
        paymentMethod: p.paymentMethod || 'Quota',
        bank: p.bank || '',
        chequeNumber: p.chequeNumber || '',
      },
      [key]: chargeMeterBlock(p),
    },
  };
}

function statusBody(p) {
  requireFields(p, ['transactionId', 'asyncRequestId']);
  return {
    merchant: p.merchant || config.ecollect.merchant,
    request: { asyncRequestId: p.asyncRequestId },
    transactionId: String(p.transactionId),
    paymentReference: p.asyncRequestId, // doc: same value as asyncRequestId
  };
}

// ----------------------------------------------------------- meter lookup

/**
 * ECGGetMeterInfoLive - validate a meter (prepaid or postpaid). Call this first;
 * its PayLoad.MeterId feeds every later call.
 *
 * The documented body has no asyncRequestId, but the auth hash needs one. A fresh
 * UUID is used for the hash and returned; confirm with TGL what they expect here.
 */
async function getMeterInfo({ meterNumber, meterCategory, phoneNumber }) {
  requireFields({ meterNumber, meterCategory }, ['meterNumber', 'meterCategory']);
  const category = String(meterCategory).toLowerCase();
  if (!['prepaid', 'postpaid'].includes(category)) throw new TypeError('meterCategory must be "prepaid" or "postpaid"');
  const asyncRequestId = crypto.randomUUID();
  const data = await call(
    'ECGGetMeterInfoLive',
    {
      ...(phoneNumber && { PhoneNumber: String(phoneNumber) }),
      MeterNumber: String(meterNumber),
      MeterCategory: category,
    },
    asyncRequestId
  );
  const ok = data?.StatusCode === '0001' && !!data?.PayLoad;
  return { asyncRequestId, success: ok, message: data?.Message, meter: ok ? data.PayLoad : null, response: data };
}

// ----------------------------------------------------------------- prepaid

/** ECGPrepaidOnlineInquiry - prepares a validated prepaid online meter for charging. */
async function prepaidInquiry({ meterId, meterNumber, mobileNumber, asyncRequestId = crypto.randomUUID(), merchant }) {
  requireFields({ meterId, meterNumber, mobileNumber }, ['meterId', 'meterNumber', 'mobileNumber']);
  const data = await call(
    'ECGPrepaidOnlineInquiry',
    {
      merchant: merchant || config.ecollect.merchant,
      request: { asyncRequestId },
      meter: meterBlock({ meterId, meterNumber, mobileNumber }),
    },
    asyncRequestId
  );
  return { asyncRequestId, ...interpret(data), customer: data?.data?.[0] || null, response: data };
}

/**
 * ECGPrepaidOnlineCharge - performs the meter charge. On success `rechargeToken`
 * is in response. OUTCOME "UNKNOWN"/"PENDING" means run prepaidChargeStatus; do NOT charge again.
 */
async function prepaidCharge(params) {
  const { asyncRequestId, body } = chargeBody(params, 'meter');
  const data = await call('ECGPrepaidOnlineCharge', body, asyncRequestId);
  return {
    asyncRequestId,
    paymentReference: asyncRequestId,
    ...interpret(data),
    transactionId: data?.transactionId,
    rechargeToken: data?.rechargeToken,
    response: data,
  };
}

/** ECGPrepaidOnlineCheckChargeStatus - reuse the charge's asyncRequestId and the returned transactionId. */
async function prepaidChargeStatus(params) {
  const body = statusBody(params);
  const data = await call('ECGPrepaidOnlineCheckChargeStatus', body, params.asyncRequestId);
  return {
    ...interpret(data),
    utilityStatus: data?.utilityStatus,
    rechargeToken: data?.rechargeToken,
    response: data,
  };
}

// ---------------------------------------------------------------- postpaid

/** ECGPostpaidInquiry - must be called before payBill. */
async function postpaidInquiry({ meterId, meterNumber, mobileNumber, asyncRequestId = crypto.randomUUID(), merchant }) {
  requireFields({ meterId, meterNumber, mobileNumber }, ['meterId', 'meterNumber', 'mobileNumber']);
  const data = await call(
    'ECGPostpaidInquiry',
    {
      merchant: merchant || config.ecollect.merchant,
      request: { asyncRequestId },
      bill: meterBlock({ meterId, meterNumber, mobileNumber }),
    },
    asyncRequestId
  );
  return { asyncRequestId, ...interpret(data), bill: data?.data?.[0] || null, response: data };
}

/** postpaid/payBill1 - pays the bill (same input shape as prepaidCharge). */
async function postpaidPayBill(params) {
  const { asyncRequestId, body } = chargeBody(params, 'bill');
  const data = await call('postpaid/payBill1', body, asyncRequestId);
  return {
    asyncRequestId,
    paymentReference: asyncRequestId,
    ...interpret(data),
    transactionId: data?.transactionId,
    response: data,
  };
}

/** ECGPostpaidCheckStatus */
async function postpaidStatus(params) {
  const body = statusBody(params);
  const data = await call('ECGPostpaidCheckStatus', body, params.asyncRequestId);
  return { ...interpret(data), utilityStatus: data?.utilityStatus, response: data };
}

module.exports = {
  getMeterInfo,
  prepaidInquiry,
  prepaidCharge,
  prepaidChargeStatus,
  postpaidInquiry,
  postpaidPayBill,
  postpaidStatus,
  buildAuthHeaders,
  interpret,
};
