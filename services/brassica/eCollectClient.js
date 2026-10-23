"use strict";

/**
 * eCollectClient
 *
 * Axios wrapper for the TGL eCollect Web Service.
 * Base URL: https://ecollecttest.tglsystems.com:22211/ECollectWebService/jsonsecure
 *
 * Authentication: SHA-256( TID + PIN + APIKey + asyncRequestId )
 * — A new hash is generated per request using the request's asyncRequestId.
 *
 * eCollect status codes:
 *   0     → Success
 *  -1     → Internal error
 *  -3     → Timeout
 *  1001   → General error
 *  1006   → Data not found
 *  1009   → Invalid charge value
 *  2002   → Pending charge
 */

const crypto = require("crypto");
const axios = require("axios");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");
const config = require("../../config/brassica.config");

const EC_ERROR_CODES = new Set([-1, -3, 1001, 1006, 1009]);

/**
 * Generate eCollect SHA-256 Authorization header value.
 * Concatenation order: TID + PIN + APIKey + asyncRequestId
 *
 * @param {string} asyncRequestId  UUID V4 for this request
 * @returns {string} hex SHA-256 digest
 */
function buildAuthHash(asyncRequestId) {
  const raw = [
    config.eCollect.terminalId,
    config.eCollect.pin,
    config.eCollect.apiKey,
    asyncRequestId,
  ].join("");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * POST to an eCollect endpoint.
 *
 * @param {string} path           e.g. "/ECGPrepaidOnlineInquiry"
 * @param {object} body           JSON payload — must include request.asyncRequestId
 * @returns {Promise<object>}     eCollect response body
 */
async function ecPost(path, body) {
  // Extract asyncRequestId from the nested request object
  const asyncId = body?.request?.asyncRequestId;
  if (!asyncId) {
    throw new AppError(
      "eCollect request body must include request.asyncRequestId (UUID V4).",
      400,
      "MISSING_ASYNC_ID",
      "ecollect",
    );
  }

  const url = `${config.eCollect.baseURL}${path}`;
  const authHash = buildAuthHash(asyncId);

  logger.debug(`[eCollectClient] POST ${path} asyncId=${asyncId}`);

  let res;
  try {
    res = await axios.post(url, body, {
      timeout: config.eCollect.timeout,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: authHash,
        Referer: config.eCollect.terminalId,
      },
    });
  } catch (err) {
    console.log(err);
    if (err.code === "ECONNABORTED") {
      throw new AppError("eCollect request timed out.", 504, "-3", "ecollect");
    }

    const status = err.response?.status;
    const data = err.response?.data;
    logger.error(`[eCollectClient] HTTP ${status} on ${path}:`, data);

    throw new AppError(
      data?.message || "eCollect request failed.",
      status || 502,
      String(status),
      "ecollect",
      data,
    );
  }

  const data = res.data;
  // eCollect uses a nested status object: { status: { code: 0, message: "Success" } }
  const code = data?.status?.code ?? data?.StatusCode;

  if (
    EC_ERROR_CODES.has(Number(code)) ||
    (typeof code === "string" && code !== "0001")
  ) {
    logger.warn(`[eCollectClient] Error [${code}] on ${path}:`, data);
    throw new AppError(
      data?.status?.message || data?.Message || "eCollect operation failed.",
      mapECollectCode(Number(code)),
      String(code),
      "ecollect",
      data,
    );
  }

  return data;
}

function mapECollectCode(code) {
  if (code === 0) return 200;
  if (code === -3) return 504;
  if (code === 1006) return 404;
  if (code === 1009) return 422;
  if (code === 2002) return 202;
  return 502;
}

/**
 * Convenience: GET meter info (uses a different endpoint — no inquiry/charge flow).
 * This endpoint uses the same jsonsecure base and the same SHA-256 auth, but the
 * asyncRequestId is generated inside this helper.
 */
async function getMeterInfo({ phoneNumber, meterNumber, meterCategory }) {
  const { v4: uuidv4 } = require("uuid");
  const asyncRequestId = uuidv4();
  const url = `${config.eCollect.baseURL}/ECGCMSGetMeterInfoLive`;
  const authHash = buildAuthHash(asyncRequestId);

  logger.debug(
    `[eCollectClient] getMeterInfo meter=${meterNumber} category=${meterCategory}`,
  );

  let res;
  try {
    res = await axios.post(
      url,
      {
        PhoneNumber: phoneNumber || config.brassicaPmt.clientPhone,
        MeterNumber: meterNumber,
        MeterCategory: meterCategory,
      },
      {
        timeout: config.eCollect.timeout,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: authHash,
          Referrer: config.eCollect.terminalId,
        },
      },
    );
  } catch (err) {
    console.log(err);
    const status = err.response?.status;
    const data = err.response?.data;
    throw new AppError(
      data?.Message || "eCollect meter info request failed.",
      status || 502,
      null,
      "ecollect",
      data,
    );
  }

  const data = res.data;
  // eCollect GetMeterInfo success code is "0001"
  if (data?.StatusCode !== "0001") {
    throw new AppError(
      data?.Message || "Meter not found.",
      404,
      data?.StatusCode,
      "ecollect",
      data,
    );
  }

  const meterDetails = {
    meterId: data?.PayLoad?.MeterId,
    meterNumber: data?.PayLoad?.MeterNumber,
    accountName: data?.PayLoad?.CustomerName, // Show this to user for confirmation
    accountReferenceId: data?.PayLoad?.MeterId,
    accountBalance: 0,
    spn: data?.PayLoad?.SPN,
    accountAddress: data?.PayLoad?.CustomerAddress,
    serviceDistrictId: data?.PayLoad?.DistrictId,
    serviceRegionId: data?.PayLoad?.RegionId,
    serviceProviderName: data?.PayLoad?.MeterType,
    accountType: "Prepaid",
    altAccountNumber: data?.PayLoad?.AccountNumber,
    accountLookUpId: data?.PayLoad?.MeterId,
    // Pass to Payment step
  };

  // console.log(data)

  return meterDetails;
}

module.exports = { ecPost, getMeterInfo, buildAuthHash };
