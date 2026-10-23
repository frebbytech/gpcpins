"use strict";

/**
 * ECG Payment Routes — Brassica 3PP + eCollect
 *
 * Full transaction flow (per the Payment Processor Flow diagram):
 *
 *   [eCollect]  POST /api/ecg/meter-info           → ECGGetMeterInfoLive
 *   [eCollect]  POST /api/ecg/prepaid/inquiry       → ECGPrepaidOnlineInquiry
 *   [eCollect]  POST /api/ecg/postpaid/inquiry      → ECGPostpaidInquiry
 *   [Brassica]  POST /api/ecg/pay                   → /api/Payment/PaymentWithDebit
 *   [Brassica]  POST /api/ecg/status                → /api/Payment/TSQ
 *   [eCollect]  POST /api/ecg/prepaid/charge-status → ECGPrepaidOnlineCheckChargeStatus
 *   [eCollect]  POST /api/ecg/postpaid/charge-status→ ECGPostpaidCheckStatus
 *   [Brassica]  POST /api/ecg/power-charge-callback → /api/PowerCharge/PowerChargeCallBack
 *
 * Webhook (Brassica posts here):
 *   POST /api/ecg/webhook/proof-of-payment
 */

const express = require("express");
const { body } = require("express-validator");
const { v4: uuidv4 } = require("uuid");

const { pmtPost } = require("../../services/brassica/pmtClient");
const {
  ecPost,
  getMeterInfo,
} = require("../../services/brassica/eCollectClient");
const { validate } = require("../../middlewares/brassica.middleware");
const logger = require("../../utils/logger");
const config = require("../../config/brassica");
const { saveMeter } = require("../../services/brassica/token.manager");

const router = express.Router();

// ─── Shared validators ────────────────────────────────────────────────────────
const meterNumberValidator = body("meterNumber")
  .matches(/^\d{8,15}$/)
  .withMessage("meterNumber must be 8-15 digits.");

const phoneValidator = body("phoneNumber")
  .matches(/^\d{12,13}$/)
  .withMessage(
    "phoneNumber must be in international format (e.g. 233XXXXXXXXX).",
  );

const categoryValidator = body("meterCategory")
  .isIn(["prepaid", "postpaid", "PREPAID", "POSTPAID"])
  .withMessage('meterCategory must be "prepaid" or "postpaid".');

// ══════════════════════════════════════════════════════════════════════════════
//  1. GET METER INFO  (eCollect ECGGetMeterInfoLive)
//  Always call this first — it validates the meter and returns the MeterId
//  required for all subsequent Inquiry calls.
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/meter-info",
  [
    meterNumberValidator,
    categoryValidator,
    body("phoneNumber")
      .optional()
      .matches(/^\d{10,13}$/),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { meterNumber, meterCategory, phoneNumber } = req.body;
      logger.info(`[ECG] MeterInfo meter=${meterNumber} cat=${meterCategory}`);

      const data = await getMeterInfo({
        meterNumber,
        meterCategory: meterCategory.toLowerCase(),
        phoneNumber: phoneNumber || "",
      });

      const meterDetails = {
        number: data?.meterNumber,
        spn: data?.spn,
        name: data?.accountName,
        type: "prepaid",
        district: data?.serviceDistrictId,
        address: data?.accountAddress,
        geo_code: "",
        account_number: data?.altAccountNumber,
        reference_id: data?.accountReferenceId,
        region: data?.serviceRegionId,
        provider_name: data?.serviceProviderName,
        alt_account_number: data?.altAccountNumber,
        look_up_id: data?.meterId,
      };

      await saveMeter(meterNumber, data);

      return res.status(200).json(meterDetails);
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  2a. PREPAID INQUIRY  (eCollect ECGPrepaidOnlineInquiry)
//  Call after meter-info. Pass PayLoad.MeterId as referenceId.
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/prepaid/inquiry",
  [
    body("referenceId")
      .notEmpty()
      .withMessage("referenceId (MeterId from meter-info) is required."),
    body("meterSerial")
      .matches(/^\d{8,15}$/)
      .withMessage("meterSerial must be 8-15 digits."),
    phoneValidator,
  ],
  validate,
  async (req, res, next) => {
    try {
      const { referenceId, meterSerial, phoneNumber } = req.body;
      const asyncRequestId = req.body.asyncRequestId || uuidv4();

      logger.info(
        `[ECG] PrepaidInquiry meter=${meterSerial} asyncId=${asyncRequestId}`,
      );

      const data = await ecPost("/ECGPrepaidOnlineInquiry", {
        merchant: config.eCollect.merchant,
        request: { asyncRequestId },
        meter: { referenceId, meterSerial, mobileNumber: phoneNumber },
      });

      return res.status(200).json({ success: true, asyncRequestId, data });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  2b. POSTPAID INQUIRY  (eCollect ECGPostpaidInquiry)
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/postpaid/inquiry",
  [
    body("referenceId")
      .notEmpty()
      .withMessage("referenceId (MeterId from meter-info) is required."),
    body("meterSerial")
      .matches(/^\d{8,15}$/)
      .withMessage("meterSerial must be 8-15 digits."),
    phoneValidator,
  ],
  validate,
  async (req, res, next) => {
    try {
      const { referenceId, meterSerial, phoneNumber } = req.body;
      const asyncRequestId = req.body.asyncRequestId || uuidv4();

      logger.info(
        `[ECG] PostpaidInquiry meter=${meterSerial} asyncId=${asyncRequestId}`,
      );

      const data = await ecPost("/ECGPostpaidInquiry", {
        merchant: config.eCollect.merchant,
        request: { asyncRequestId },
        bill: { referenceId, meterSerial, mobileNumber: phoneNumber },
      });

      return res.status(200).json({ success: true, asyncRequestId, data });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  3. PAYMENT REQUEST  (Brassica /api/Payment/PaymentWithDebit)
//  Submits the debit request to Brassica against the customer's mobile wallet.
//  Returns 202 ACCEPTED — final result comes via webhook (proof-of-payment).
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/pay",
  [
    body("amount")
      .matches(/^\d+(\.\d{1,2})?$/)
      .withMessage('amount must be a valid decimal string e.g. "20.00".'),
    body("accountNumber")
      .notEmpty()
      .withMessage(
        "accountNumber is required (format: 233XXXXXXXXX/meterNumber).",
      ),
    body("paymentChannel")
      .isIn(["MTN", "VODAFONE", "ATMONEY"])
      .withMessage('paymentChannel must be "MTN", "VODAFONE", or "ATMONEY".'),
    body("meterNumber")
      .matches(/^\d{8,15}$/)
      .withMessage("meterNumber must be 8-15 digits."),
    body("meterType")
      .isIn(["OFFLINE", "ONLINE", "POSTPAID"])
      .withMessage('meterType must be "OFFLINE", "ONLINE", or "POSTPAID".'),
    body("paymentBy")
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("paymentBy (payer name) is required."),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        amount,
        accountNumber,
        paymentChannel,
        meterNumber,
        meterType,
        paymentBy,
      } = req.body;

      // Each payment needs a unique transactionId AND asyncId
      const transactionId = req.body.transactionId || uuidv4();
      const asyncId = req.body.asyncId || uuidv4();

      logger.info(
        `[ECG] Pay meter=${meterNumber} channel=${paymentChannel} amount=${amount} ` +
          `txId=${transactionId} asyncId=${asyncId}`,
      );

      const data = await pmtPost("/api/Payment/PaymentWithDebit", {
        paymentMode: "WALLET",
        amount: String(amount),
        accountNumber,
        transactionId,
        asyncId,
        paymentChannel,
        merchantCode: config.brassicaPmt.merchantCode,
        terminalId: config.brassicaPmt.terminalId,
        paymentNaration: req.body.paymentNaration || "ECG Purchase",
        paymentProduct: "ECG",
        paymentBy,
        meterNumber,
        meterType,
      });

      return res
        .status(202)
        .json({ success: true, transactionId, asyncId, data });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  4. PAYMENT STATUS CHECK / TSQ  (Brassica /api/Payment/TSQ)
//  Poll when a proof-of-payment callback is not received within 5-10 seconds.
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/status",
  [
    body("transactionId").notEmpty().withMessage("transactionId is required."),
    body("asyncId").notEmpty().withMessage("asyncId is required."),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { transactionId, asyncId } = req.body;
      logger.info(`[ECG] TSQ txId=${transactionId} asyncId=${asyncId}`);

      const data = await pmtPost("/api/Payment/TSQ", {
        transactionId,
        asyncId,
      });

      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  5a. PREPAID CHARGE STATUS  (eCollect ECGPrepaidOnlineCheckChargeStatus)
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/prepaid/charge-status",
  [
    body("asyncRequestId")
      .isUUID(4)
      .withMessage("asyncRequestId must be a UUID v4."),
    body("transactionId")
      .notEmpty()
      .withMessage("transactionId (from eCollect charge) is required."),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { asyncRequestId, transactionId } = req.body;
      logger.info(
        `[ECG] PrepaidChargeStatus txId=${transactionId} asyncId=${asyncRequestId}`,
      );

      const data = await ecPost("/ECGPrepaidOnlineCheckChargeStatus", {
        merchant: config.eCollect.merchant,
        request: { asyncRequestId },
        transactionId,
        paymentReference: asyncRequestId,
      });

      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  5b. POSTPAID CHARGE STATUS  (eCollect ECGPostpaidCheckStatus)
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/postpaid/charge-status",
  [
    body("asyncRequestId")
      .isUUID(4)
      .withMessage("asyncRequestId must be a UUID v4."),
    body("transactionId")
      .notEmpty()
      .withMessage("transactionId (from eCollect charge) is required."),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { asyncRequestId, transactionId } = req.body;
      logger.info(
        `[ECG] PostpaidChargeStatus txId=${transactionId} asyncId=${asyncRequestId}`,
      );

      const data = await ecPost("/ECGPostpaidCheckStatus", {
        merchant: config.eCollect.merchant,
        request: { asyncRequestId },
        transactionId,
        paymentReference: asyncRequestId,
      });

      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  6. POWER CHARGE CALLBACK  (Brassica /api/PowerCharge/PowerChargeCallBack)
//  Notify Brassica after the eCollect meter charge completes.
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/power-charge-callback",
  [
    body("asyncId").notEmpty().withMessage("asyncId is required."),
    body("transactionId").notEmpty().withMessage("transactionId is required."),
    body("status")
      .isIn(["Successful", "Failed"])
      .withMessage('status must be "Successful" or "Failed".'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { asyncId, transactionId, status } = req.body;
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

      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  WEBHOOK — Proof of Payment  (Brassica POSTs final result here)
//  Brassica calls this URL after the MNO debit is settled.
//  We must acknowledge immediately, then handle async.
// ══════════════════════════════════════════════════════════════════════════════
router.post("/webhook/proof-of-payment", (req, res) => {
  // Brassica requires this exact ack shape within the same HTTP response
  res.status(200).json({
    message: "Callback Received Successfully",
    status: "OK",
  });

  setImmediate(async () => {
    const payload = req.body;
    const {
      statusCode,
      status,
      transactionId,
      extralTransactionId,
      institutionApprovalCode,
    } = payload;

    logger.info(
      `[ECG Webhook] txId=${transactionId} brassicaTxId=${extralTransactionId} ` +
        `status=${status}(${statusCode}) approval=${institutionApprovalCode}`,
    );

    try {
      if (status === "SUCCESSFUL" || statusCode === "200") {
        // ── TODO: persist success, trigger eCollect charge, notify user ──────
        logger.info(
          `[ECG Webhook] Payment SUCCESSFUL — txId=${transactionId}. Proceed to meter charge.`,
        );
      } else if (status === "Refunded" || statusCode === "427") {
        // Refund notification — same endpoint, different statusCode
        logger.warn(`[ECG Webhook] Payment REFUNDED — txId=${transactionId}`);
        // TODO: update order status, notify customer of refund
      } else {
        logger.warn(
          `[ECG Webhook] Unhandled status=${status} (${statusCode}) — txId=${transactionId}`,
        );
      }
    } catch (err) {
      logger.error("[ECG Webhook] Error processing payload:", err);
    }
  });
});

module.exports = router;
