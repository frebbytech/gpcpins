"use strict";

const client = require("./brassica.redisClient");

/**
 * Centralised config with fail-fast env validation.
 * Import this — never process.env directly — so typos surface at boot.
 */

function require_env(key) {
  const v = process.env[key];
  if (!v)
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  return v;
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5001", 10),

  // ── Brassica Payment Processor (3PP) ───────────────────────────────────────
  brassicaPmt: {
    baseURL: require_env("BRASSICA_PMT_BASE_URL"),
    apiUser: require_env("BRASSICA_PMT_API_USER"),
    apiKey: require_env("BRASSICA_PMT_API_KEY"),
    merchantCode: require_env("BRASSICA_PMT_MERCHANT_CODE"),
    terminalId: require_env("BRASSICA_PMT_TERMINAL_ID"),
    tokenTTL: parseInt(process.env.BRASSICA_PMT_TOKEN_TTL_MS || "3480000", 10),
    clientPhone: require_env("BRASSICA_CLIENT_PHONENUMBER"),
    timeout: 30_000,
  },

  // ── eCollect (TGL Systems) ─────────────────────────────────────────────────
  eCollect: {
    baseURL: require_env("ECOLLECT_BASE_URL"),
    callbackURL: require_env("ECOLLECT_CALLBACK_URL"),
    terminalId: require_env("ECOLLECT_TERMINAL_ID"),
    pin: require_env("ECOLLECT_PIN"),
    apiKey: require_env("ECOLLECT_API_KEY"),
    merchant: process.env.ECOLLECT_MERCHANT || "TGL",
    timeout: 30_000,
  },

  // ── Redis ──────────────────────────────────────────────────────────────────
  redis: {
    url: process.env.REDIS_URL || null, // overrides individual fields
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),
    tls: process.env.REDIS_TLS === "true",
    keyPrefix: process.env.REDIS_KEY_PREFIX || "brassica:",
  },

  // ── Server ─────────────────────────────────────────────────────────────────
  cors: {
    allowedOrigins: (process.env.WHITELIST || "http://localhost:3000")
      .split(",")
      .map((o) => o.trim()),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  },
  callbackBaseURL: process.env.CALLBACK_BASE_URL || "http://localhost:5001",
  webhookSecret: process.env.WEBHOOK_SECRET || "",
};

module.exports = config;
