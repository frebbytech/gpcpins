const { v4: uuidv4 } = require("uuid");
const { brassicaPost } = require("../../services/brassicaClient");
const logger = require("../../utils/logger");
const config = require("../../config/brassica.config");
const { pmtPost } = require("../../services/brassica/pmtClient");
const { ecPost } = require("../../services/brassica/eCollectClient");
const { amountChargeValue } = require("../../utils/helper");

function requireFields(obj, fields) {
  const missing = fields.filter(
    (f) => obj[f] === undefined || obj[f] === null || obj[f] === "",
  );
  if (missing.length)
    throw new TypeError(`Missing required field(s): ${missing.join(", ")}`);
}

const chargeMeterBlock = (m) => ({
  referenceId: m.meterId,
   meterProvider: m.meterProvider, // e.g. "MMS-WASION" (MeterType from getMeterInfo)
  accountNumber: m.accountNumber !== undefined ? String(m.accountNumber) : "",
  mobileNumber: m.mobileNumber ? String(m.mobileNumber) : undefined,
  meterSerial: String(m.meterNumber),
  regionId: m.regionId !== undefined ? String(m.regionId) : undefined,
  districtId: m.districtId !== undefined ? String(m.districtId) : undefined,
});

function chargeBody(p, key) {
  requireFields(p, [
    "meterId",
    "meterNumber",
    "amount",
    "mobileNumber",
    "regionId",
    "districtId",
  ]);
  const asyncRequestId = p.asyncRequestId || uuidv4();
  const callbackURL = config.eCollect.callbackURL;
  if (!callbackURL)
    throw new TypeError(
      "callbackUrl is required (or set ECOLLECT_CALLBACK_URL)",
    );
  return {
    asyncRequestId,
    body: {
      merchant: config.brassicaPmt.merchantCode || "ECG",
      request: { asyncRequestId },
      charge: {
        chargeValue: amountChargeValue(p.amount),
        callbackURL,
        paymentReference: asyncRequestId, // doc: same as asyncRequestId
      },
      paymentInstrument: {
        paymentMethod: "Mobile",
        mno: "MTN Mobile Money",
        msisdn: p.mobileNumber,
      },
      [key]: chargeMeterBlock(p),
    },
  };
}

function interpret(data) {
  const code = data?.status?.code;
  const message = data?.status?.message;
  let outcome = "FAILED";
  if (code === 0) outcome = "SUCCESS";
  else if (code === 2002) outcome = "PENDING";
  else if (code === -3) outcome = "UNKNOWN";
  return { outcome, code, message };
}

async function send3PPBrassicaMoney(payload) {
  try {
    const {
      institutionCode,
      accountNumber,
      accountName,
      amount,
      meterNumber,
      transaction_Id,
      debitNaration = "Purchase Prepaid Unit",
    } = payload;

    // console.log(payload)

    const code =
      institutionCode === "mtn-gh"
        ? "MTN"
        : institutionCode === "vodafone-gh"
          ? "VODAFONE"
          : institutionCode === "tigo-gh"
            ? "ATMONEY"
            : "MTN";

    const transactionId =
      transaction_Id || uuidv4().replace(/-/g, "").slice(0, 40);
    const asyncId = uuidv4();

    logger.info(
      `[DebitMoney] txId=${transactionId} amount=${amount} from=${accountNumber} channel=${code} asyncId=${asyncId}`,
    );

    const data = await pmtPost("/api/Payment/PaymentWithDebit", {
      paymentMode: "WALLET",
      amount: ["233543772591", "0543772591"].includes(accountNumber)
        ? "0.01"
        : amount,
      accountNumber,
      transactionId,
      asyncId,
      paymentChannel: code,
      merchantCode: config.brassicaPmt.merchantCode,
      terminalId: config.brassicaPmt.terminalId,
      paymentNaration: debitNaration || "ECG Purchase",
      paymentProduct: "ECG",
      paymentBy: accountName || "GPC PINS",
      meterNumber,
      meterType: "PREPAID",
    });

    // console.log(data)

    if (data?.statusCode !== "202" || data?.status !== "ACCEPTED") {
      throw new Error("Error processing payment");
    }

    return { success: true, asyncId, data };
  } catch (err) {
    console.log(err);
    throw new Error(err, { cause: err });
  }
}
async function sendBrassicaMoney(payload) {
  try {
    const {
      institutionCode,
      accountNumber,
      accountName,
      amount,
      transaction_Id,
      debitNaration = "Purchase Prepaid Unit",
    } = payload;

    // console.log(payload)

    const code =
      institutionCode === "mtn-gh"
        ? "300591"
        : institutionCode === "vodafone-gh"
          ? "300594"
          : institutionCode === "tigo-gh"
            ? "300592"
            : "300591";

    const transactionId =
      transaction_Id || uuidv4().replace(/-/g, "").slice(0, 40);

    logger.info(
      `[DebitMoney] txId=${transactionId} amount=${amount} from=${accountNumber}`,
    );

    const data = await brassicaPost("/debitMoney", {
      channel: "mno",
      institutionCode: code,
      accountNumber,
      accountName,
      amount: ["233543772591", "0543772591"].includes(accountNumber)
        ? "0.01"
        : amount,
      debitNaration,
      transactionId,
    });

    // console.log(data)

    if (data?.statusCode !== "202" || data?.status !== "ACCEPTED") {
      throw new Error("Error processing payment");
    }

    return { success: true, data };
  } catch (err) {
    console.log(err);
    throw new Error(err, { cause: err });
  }
}

async function getBrassicaBalance() {
  try {
    logger.info("[GetBalance] Fetching available float balance.");

    // Brassica requires POST with no body
    const data = await brassicaPost("/GetAvailableBalance", {});

    return data;
  } catch (err) {
    throw new Error(err, { cause: err });
  }
}

async function getBrassica3PPTransactionStatus(transactionId, asyncId) {
  try {
    logger.info(`[ECG] TSQ txId=${transactionId} asyncId=${asyncId}`);

    const data = await pmtPost("/api/Payment/TSQ", {
      transactionId,
      asyncId,
    });
    // console.log(data);

    return data;
  } catch (err) {
    console.log(err);
    throw new Error(err?.raw?.message || "Error fetching transaction status", {
      cause: err,
    });
  }
}
async function getBrassicaTransactionStatus(transactionId, transactionType) {
  try {
    logger.info(
      `[GetTransactionStatus] Fetching status for  txId=${transactionId} type=${transactionType}`,
    );

    const data = await brassicaPost("/transStatusQuery", {
      transactionType,
      //  transactionId: "5365tet055520509"
      transactionId,
    });
    // console.log(data);

    return data;
  } catch (err) {
    console.log(err);
    throw new Error(err?.raw?.message || "Error fetching transaction status", {
      cause: err,
    });
  }
}

/**
 * Performs a prepaid meter inquiry against the ECG system.
 * @param {Object} params
 * @param {string} params.referenceId - The Look Up ID/Meter ID from the meter info endpoint.
 * @param {string} params.meterSerial - The serial number of the meter.
 * @param {string} params.phoneNumber - The user's mobile number.
 * @param {string} [params.asyncRequestId] - Optional unique request tracking identifier.
 * @returns {Promise<Object>} The standard response containing success status, ID, and raw upstream data.
 */
async function performPrepaidInquiry({
  referenceId,
  meterSerial,
  phoneNumber,
  asyncRequestId,
}) {
  // Fall back to generating a UUID if one wasn't explicitly passed down (e.g. from background tasks)
  const requestId = asyncRequestId || uuidv4();

  logger.info(`[ECG] PrepaidInquiry meter=${meterSerial} asyncId=${requestId}`);

  // Execute the external provider network call
  const data = await ecPost("/ECGPrepaidOnlineInquiry", {
    merchant: config.eCollect.merchant,
    request: { asyncRequestId: requestId },
    meter: {
      referenceId,
      meterSerial,
      mobileNumber: phoneNumber,
    },
  });

  return {
    success: true,
    asyncRequestId: requestId,
    data,
  };
}

async function getBrassicaECollectPrepaidChargeStatus(
  transactionId,
  asyncRequestId,
) {
  try {
    logger.info(
      `[ECG] PrepaidChargeStatus txId=${transactionId} asyncId=${asyncRequestId}`,
    );

    const data = await ecPost("/ECGPrepaidOnlineCheckChargeStatus", {
      merchant: config.eCollect.merchant,
      request: { asyncRequestId },
      transactionId,
      paymentReference: asyncRequestId,
    });

    return data;
  } catch (err) {
    console.log(err);
    throw new Error(err?.raw?.message || "Error fetching transaction status", {
      cause: err,
    });
  }
}

async function prepareBrassicaECollectPrepaidCharge(requestBody) {
  const { asyncRequestId, body } = chargeBody(requestBody, "meter");
  console.log(body)

  const data = await ecPost("/ECGPrepaidOnlineCharge1", body);

  return {
    asyncRequestId,
    paymentReference: asyncRequestId,
    ...interpret(data),
    transactionId: data?.transactionId,
    rechargeToken: data?.rechargeToken,
    response: data,
  };
}

/**
 * Triggers the power charge callback to the Brassica PMT service.
 * @param {Object} params
 * @param {string} params.asyncId - The async identifier.
 * @param {string} params.transactionId - The transaction identifier.
 * @param {'Successful' | 'Failed'} params.status - The status of the transaction.
 * @returns {Promise<Object>} The data returned from the PMT service.
 */
const triggerPowerChargeCallback = async ({
  asyncId,
  transactionId,
  status,
}) => {
  logger.info(
    `[ECG] PowerChargeCallback txId=${transactionId} status=${status}`,
  );

  const data = await pmtPost("/api/PowerCharge/PowerChargeCallBack", {
    asyncId,
    transactionId,
    merchantCode: config.brassicaPmt.merchantCode,
    terminalId: config.brassicaPmt.terminalId,
    status,
  });

  return data;
};

module.exports = {
  sendBrassicaMoney,
  send3PPBrassicaMoney,
  getBrassicaBalance,
  getBrassicaTransactionStatus,
  getBrassica3PPTransactionStatus,
  getBrassicaECollectPrepaidChargeStatus,
  prepareBrassicaECollectPrepaidCharge,
  performPrepaidInquiry,
  triggerPowerChargeCallback,
};
