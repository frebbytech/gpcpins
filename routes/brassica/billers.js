// src/routes/billers.js
"use strict";

/**
 * Biller Routes
 * POST /api/billers/lookup   → Brassica /billerAccountLookUp
 * POST /api/billers/pay      → Brassica /billerPayment
 * POST /api/billers/ecg/lookup  → Convenience: ECG-specific lookup
 * POST /api/billers/ecg/pay     → Convenience: ECG-specific payment
 */

const express = require("express");
const { body } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const asyncHandler = require("express-async-handler");

const { brassicaPost } = require("../../services/brassicaClient");
const validate = require("../../middlewares/validate");
const logger = require("../../utils/logger");
const { saveMeter } = require("../../services/brassica/token.manager");
const { billerPaymentSchema } = require("../../utils/validationSchema");

const router = express.Router();

// ─── Shared phone validator ───────────────────────────────────────────────────
const phoneValidator = body("phoneNumber")
  .matches(/^\d{12,13}$/)
  .withMessage(
    "phoneNumber must be in international format (e.g. 233XXXXXXXXX), 12-13 digits.",
  );

// ─── POST /api/billers/lookup ─────────────────────────────────────────────────
router.post(
  "/lookup",
  [
    body("transactionId").optional().isString().isLength({ max: 40 }),
    body("accountNumber").notEmpty().withMessage("accountNumber is required."),
    phoneValidator,
    body("accountCategory")
      .notEmpty()
      .withMessage("accountCategory is required."),
    body("billerType").notEmpty().withMessage("billerType is required."),
  ],
  validate,
  asyncHandler(async (req, res) => {
    try {
      const { accountNumber, phoneNumber, accountCategory, billerType } =
        req.body;
      const transactionId = req.body.transactionId || uuidv4();

      logger.info(
        `[BillerLookup] billerType=${billerType} account=${accountNumber}`,
      );

      const data = await brassicaPost("/billerAccountLookUp", {
        transactionId,
        accountNumber,
        phoneNumber,
        accountCategory,
        billerType,
      });

      return res.status(200).json({ success: true, data });
    } catch (err) {
      // next(err);
      console.log(err);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

// ─── POST /api/billers/pay ────────────────────────────────────────────────────
router.post(
  "/pay",
  [
    body("billRequest.transactionId")
      .optional()
      .isString()
      .isLength({ max: 40 }),
    body("billRequest.billerType")
      .notEmpty()
      .withMessage("billRequest.billerType is required."),
    body("billRequest.accountNumber")
      .notEmpty()
      .withMessage("billRequest.accountNumber is required."),
    body("billRequest.accountCategory")
      .notEmpty()
      .withMessage("billRequest.accountCategory is required."),
    phoneValidator.withMessage
      ? phoneValidator
      : body("billRequest.phoneNumber").notEmpty(),
    body("paymentDetails.amount")
      .isNumeric()
      .withMessage("paymentDetails.amount must be numeric."),
    body("paymentDetails.accountLookUpId")
      .notEmpty()
      .withMessage(
        "paymentDetails.accountLookUpId is required (from lookup step).",
      ),
    body("paymentDetails.serviceDistrictId").notEmpty(),
    body("paymentDetails.serviceRegionId").notEmpty(),
    body("paymentDetails.serviceProviderName").notEmpty(),
    body("paymentDetails.accountName").notEmpty(),
    body("paymentDetails.accountReferenceId").notEmpty(),
    body("paymentDetails.altAccountNumber").notEmpty(),
    body("paymentDetails.paymentBy")
      .notEmpty()
      .withMessage("paymentDetails.paymentBy is required."),
    body("paymentDetails.paymentNaration")
      .optional()
      .isString()
      .isLength({ max: 100 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    try {
      const { billRequest, paymentDetails } = req.body;

      // Ensure transactionId on billRequest
      if (!billRequest.transactionId) {
        billRequest.transactionId = uuidv4();
      }

      logger.info(
        `[BillerPay] billerType=${billRequest.billerType} account=${billRequest.accountNumber} amount=${paymentDetails.amount}`,
      );

      const data = await brassicaPost("/billerPayment", {
        billRequest,
        paymentDetails,
      });

      return res.status(200).json({ success: true, data });
    } catch (err) {
      // next(err);
      console.log(err);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

// ─── POST /api/billers/ecg/lookup ─────────────────────────────────────────────
// Convenience endpoint — enforces ECG-specific fields so the frontend doesn't
// need to know the exact billerType/category values for ECG.
router.post(
  "/ecg/lookup",
  [
    // body("transactionId").optional().isString().isLength({ max: 40 }),
    body("accountNumber")
      .matches(/^[a-zA-Z0-9-]{10,20}$/)
      .withMessage("accountNumber must be a valid ECG meter number."),
    // body("phoneNumber")
    //   .matches(/^\d{12,13}$/)
    //   .withMessage(
    //     "phoneNumber must be in international format (e.g. 233XXXXXXXXX).",
    //   ),
    // body("accountCategory")
    //   .isIn(["PREPAID", "POSTPAID"])
    //   .withMessage('accountCategory must be "PREPAID" or "POSTPAID".'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    try {
      const { accountNumber, accountCategory } = req.body;
      const transactionId = req.body.transactionId || uuidv4();

      logger.info(
        `[ECGLookup] meter=${accountNumber} category=${accountCategory}`,
      );

      const response = await brassicaPost("/billerAccountLookUp", {
        transactionId,
        accountNumber,
        phoneNumber: process.env.BRASSICA_CLIENT_PHONENUMBER,
        accountCategory,
        billerType: "ECG",
      });

      // console.log(response);

      if (response?.status !== "Success" || response?.statusCode !== "200") {
        return res.status(401).json("Meter not found");
      }

      const { accountDetails: data, accountLookUpId } = response;

      const meterDetails = {
        name: data?.accountName,
        type: data?.accountType,
        address: data?.accountAddress,
        account_number: data?.altAccountNumber,
        provider_name: data?.serviceProviderName,
      };

      await saveMeter(accountNumber, {
        ...data,
        accountLookUpId,
      });
      // console.log(response);

      return res.status(200).json(meterDetails);
    } catch (err) {
      // next(err);
      // console.log("error", err?.raw);
const errorMessage =
        err?.raw?.message === "accountNumber must be a valid ECG meter number."
          ? "ECG Meter not found. Please verify the meter number and try again.":
          err?.raw?.message === "Polymorph: meter not found"
          ? "ECG Meter not found. Please verify the meter number and try again."
          :err?.raw?.message === "Meter Type is not supported"
          ? "ECG Meter not supported. Please use a different meter number."
          : err?.raw?.message || "Error fetching Meter details! Try again later";


      return res
        .status(500)
        .json(
          errorMessage
        );
    }
  }),
);

// ─── POST /api/billers/ecg/pay ────────────────────────────────────────────────
router.post(
  "/ecg/pay",
  billerPaymentSchema,
  validate,
  asyncHandler(async (req, res) => {
    try {
      const {
        accountNumber,
        phoneNumber,
        accountCategory,
        amount,
        paymentBy,
        accountLookUpId,
        serviceDistrictId,
        serviceRegionId,
        serviceProviderName,
        accountName,
        accountReferenceId,
        altAccountNumber,
      } = req.body;

      const transactionId = req.body.transactionId || uuidv4();

      logger.info(
        `[ECGPay] meter=${accountNumber} category=${accountCategory} amount=${amount} by=${paymentBy}`,
      );

      const data = await brassicaPost("/billerPayment", {
        billRequest: {
          transactionId,
          billerType: "ECG",
          accountNumber,
          accountCategory,
          phoneNumber,
        },
        paymentDetails: {
          amount,
          accountLookUpId,
          serviceDistrictId,
          serviceRegionId,
          serviceProviderName,
          accountName,
          accountReferenceId,
          paymentNaration: "Electricity Purchase",
          altAccountNumber,
          paymentBy,
        },
      });
      logger.info(data);

      return res.status(200).json({ success: true, data });
    } catch (err) {
      // next(err);
      console.log(err);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

module.exports = router;
