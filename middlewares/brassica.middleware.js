"use strict";

const { validationResult } = require("express-validator");
const AppError = require("../utils/AppError");
const logger   = require("../utils/logger");

// ── Validation runner ─────────────────────────────────────────────────────────
function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: { message: "Validation failed.", fields: result.array() },
    });
  }
  next();
}

// ── Webhook signature check ───────────────────────────────────────────────────
function webhookAuth(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return next(); // skip in dev if not configured

  const incoming = req.headers["x-brassica-secret"] || req.headers["x-webhook-secret"];
  if (!incoming || incoming !== secret) {
    return res.status(403).json({ success: false, error: { message: "Forbidden: invalid webhook secret." } });
  }
  next();
}

// ── Global error handler (register LAST in app.js) ────────────────────────────
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== "production";

  if (err instanceof AppError) {
    logger.warn(`[${err.provider}] ${err.code || ""} — ${err.message}`);
    return res.status(err.httpStatus || 500).json({
      success: false,
      error: {
        message:  err.message,
        code:     err.code || null,
        provider: err.provider,
        ...(isDev && err.raw ? { raw: err.raw } : {}),
      },
    });
  }

  // express-validator path (should be handled inline, but kept as safety net)
  if (err.type === "VALIDATION_ERROR") {
    return res.status(422).json({
      success: false,
      error: { message: "Validation failed.", fields: err.errors },
    });
  }

  logger.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    error: {
      message: "An internal server error occurred.",
      ...(isDev ? { detail: err.message } : {}),
    },
  });
}

module.exports = { validate, webhookAuth, errorHandler };
