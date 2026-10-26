"use strict";

/**
 * pmtClient
 *
 * Axios wrapper for Brassica's Payment Processor (3PP) API.
 * Base URL: https://testpmtpro.brassicagroup.com
 *
 * Features:
 *   • Injects Bearer token + ApiUser header on every request
 *   • Retries once with a fresh token on 401
 *   • Maps Brassica PMT statusCodes → correct HTTP statuses
 *   • Normalises all errors to AppError
 */

const axios = require("axios");
const pmtTokenMgr = require("./pmtTokenManager");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");
const config = require("../../config/brassica.config.js");

// Brassica PMT codes that represent terminal business errors
const BUSINESS_ERROR_CODES = new Set([
  "300",
  "303",
  "401",
  "402",
  "403",
  "404",
  "405",
  "406",
  "407",
  "408",
  "409",
  "410",
  "411",
  "412",
  "413",
  "414",
  "415",
  "416",
  "419",
  "420",
  "421",
  "422",
  "423",
  "424",
  "425",
  "426",
  "427",
  "428",
  "429",
  "491",
  "500",
]);

/** Map Brassica PMT statusCode → HTTP status */
function toHttpStatus(code) {
  const map = {
    200: 200,
    202: 202,
    203: 200,
    204: 200,
    401: 401,
    407: 401,
    402: 404,
    403: 404,
    404: 404,
    419: 404,
    420: 422,
    405: 503,
    416: 503,
    500: 502,
    406: 422,
    422: 422,
    423: 422,
    425: 422,
    408: 400,
    409: 408,
    410: 402,
    412: 402,
    427: 402,
    300: 422,
    303: 502,
    411: 502,
    413: 502,
    424: 502,
    414: 400,
    415: 403,
    421: 502,
    426: 202,
    428: 429,
    429: 202,
    491: 202,
  };
  return map[String(code)] || 500;
}

/**
 * @param {string}  endpoint  e.g. "/api/Payment/PaymentWithDebit"
 * @param {object}  body      JSON payload
 * @param {boolean} _retry    internal — do not set
 */
async function pmtPost(endpoint, body = {}, _retry = true) {
  const token = await pmtTokenMgr.getToken();
  const url = `${config.brassicaPmt.baseURL}${endpoint}`;

  let res;
  try {
    res = await axios.post(url, body, {
      timeout: config.brassicaPmt.timeout,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ApiUser: config.brassicaPmt.apiUser,
      },
    });
  } catch (err) {
    console.log(err)
    if (err.code === "ECONNABORTED") {
      throw new AppError(
        "Brassica PMT request timed out.",
        504,
        null,
        "brassica_pmt",
      );
    }

    const status = err.response?.status;
    const data = err.response?.data;

    if (status === 401 && _retry) {
      logger.warn(
        "[pmtClient] 401 received — forcing token refresh and retrying.",
      );
      await pmtTokenMgr.forceRefresh();
      return pmtPost(endpoint, body, false);
    }

    logger.error(`[pmtClient] HTTP ${status} on ${endpoint}:`, data);
    throw new AppError(
      data?.message || "Brassica PMT request failed.",
      status || 502,
      data?.statusCode,
      "brassica_pmt",
      data,
    );
  }

  const data = res.data;
  const code = String(data?.statusCode || "");

  if (BUSINESS_ERROR_CODES.has(code)) {
    logger.warn(`[pmtClient] Business error [${code}] on ${endpoint}:`, data);
    throw new AppError(
      data?.message || "Brassica PMT operation rejected.",
      toHttpStatus(code),
      code,
      "brassica_pmt",
      data,
    );
  }

  return data;
}

module.exports = { pmtPost };
