// src/routes/payments.js
"use strict";

/**
 * Payment Routes
 * POST /api/payments/send          → Brassica /sendMoney
 * POST /api/payments/debit         → Brassica /debitMoney
 * POST /api/payments/name-enquiry  → Brassica /nameEnquiry
 * POST /api/payments/status        → Brassica /transStatusQuery
 * POST /api/payments/balance       → Brassica /GetAvailableBalance
 */

const express = require("express");
const { body } = require("express-validator");
const { v4: uuidv4 } = require("uuid");


;
const logger = require("../../utils/logger");
const { brassicaPost } = require("../../services/brassicaClient");
const validate = require("../../middlewares/validate");

const router = express.Router();

// ─── Shared validators ────────────────────────────────────────────────────────

const channelValidator = body("channel")
  .isIn(["mno", "interbank"])
  .withMessage('channel must be "mno" or "interbank".');

const accountNumberValidator = body("accountNumber")
  .matches(/^\d{10,15}$/)
  .withMessage("accountNumber must be 10-15 digits in international format (e.g. 233XXXXXXXXX).");

const institutionCodeValidator = body("institutionCode")
  .matches(/^\d{6}$/)
  .withMessage("institutionCode must be exactly 6 digits.");

const amountValidator = body("amount")
  .matches(/^\d+\.\d{2}$/)
  .withMessage('amount must be a two-decimal string (e.g. "1.00").');

const accountNameValidator = body("accountName")
  .isString()
  .trim()
  .isLength({ min: 1, max: 50 })
  .withMessage("accountName must be 1-50 characters.");

const narrationMaxLength = 50;

// ─── POST /api/payments/send ──────────────────────────────────────────────────
router.post(
  "/send",
  [
    channelValidator,
    institutionCodeValidator,
    accountNumberValidator,
    accountNameValidator,
    amountValidator,
    body("creditNaration")
      .isString()
      .trim()
      .isLength({ min: 1, max: narrationMaxLength })
      .withMessage(`creditNaration must be 1-${narrationMaxLength} characters.`),
    body("transactionId")
      .optional()
      .isAlphanumeric()
      .isLength({ max: 40 })
      .withMessage("transactionId must be alphanumeric, max 40 chars."),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        channel,
        institutionCode,
        accountNumber,
        accountName,
        amount,
        creditNaration,
      } = req.body;

      // Guarantee a unique transactionId even if client omits one
      const transactionId = req.body.transactionId || uuidv4().replace(/-/g, "").slice(0, 40);

      logger.info(`[SendMoney] txId=${transactionId} amount=${amount} to=${accountNumber}`);

      const data = await brassicaPost("/sendMoney", {
        channel,
        institutionCode,
        accountNumber,
        accountName,
        amount,
        creditNaration,
        transactionId,
      });

      return res.status(202).json({ success: true, transactionId, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/payments/debit ─────────────────────────────────────────────────
router.post(
  "/debit",
  [
    body("channel")
      .equals("mno")
      .withMessage('channel must be "mno" for debit operations.'),
    institutionCodeValidator,
    accountNumberValidator,
    accountNameValidator,
    amountValidator,
    body("debitNaration")
      .isString()
      .trim()
      .isLength({ min: 1, max: narrationMaxLength })
      .withMessage(`debitNaration must be 1-${narrationMaxLength} characters.`),
    body("transactionId")
      .optional()
      .isAlphanumeric()
      .isLength({ max: 40 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        institutionCode,
        accountNumber,
        accountName,
        amount,
        debitNaration,
      } = req.body;

      const transactionId = req.body.transactionId || uuidv4().replace(/-/g, "").slice(0, 40);

      logger.info(`[DebitMoney] txId=${transactionId} amount=${amount} from=${accountNumber}`);

      const data = await brassicaPost("/debitMoney", {
        channel: "mno",
        institutionCode,
        accountNumber,
        accountName,
        amount,
        debitNaration,
        transactionId,
      });

      if (data?.statusCode !== "202" || data?.status !== "ACCEPTED") {
      throw new Error("Error processing payment");
    }

      return res.status(202).json({ success: true, transactionId, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/payments/name-enquiry ─────────────────────────────────────────
router.post(
  "/name-enquiry",
  [
    channelValidator,
    institutionCodeValidator,
    accountNumberValidator,
    body("transactionId")
      .optional()
      .isAlphanumeric()
      .isLength({ max: 40 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { channel, institutionCode, accountNumber } = req.body;
      const transactionId = req.body.transactionId || uuidv4().replace(/-/g, "").slice(0, 40);

      logger.info(`[NameEnquiry] txId=${transactionId} account=${accountNumber}`);

      const data = await brassicaPost("/nameEnquiry", {
        channel,
        institutionCode,
        accountNumber,
        transactionId,
      });

      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/payments/status ────────────────────────────────────────────────
router.post(
  "/status",
  [
    body("transactionType")
      .isIn(["credit", "debit"])
      .withMessage('transactionType must be "credit" or "debit".'),
    body("transactionId")
      .notEmpty()
      .withMessage("transactionId is required."),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { transactionType, transactionId } = req.body;

      logger.info(`[StatusQuery] txId=${transactionId} type=${transactionType}`);

      const data = await brassicaPost("/transStatusQuery", {
        transactionType,
        transactionId,
      });

      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/payments/balance ───────────────────────────────────────────────
router.post("/balance", async (req, res, next) => {
  try {
    logger.info("[GetBalance] Fetching available float balance.");

    // Brassica requires POST with no body
    const data = await brassicaPost("/GetAvailableBalance", {});

    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
