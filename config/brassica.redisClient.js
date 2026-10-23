"use strict";

/**
 * redisClient.js
 *
 * Single ioredis instance shared across the entire process.
 * Import this wherever Redis access is needed — never create a
 * second connection.
 *
 * Configuration (all optional — defaults to localhost:6379):
 *   REDIS_URL          Full connection string, e.g. redis://:password@host:6379/0
 *                      Takes precedence over the individual fields below.
 *   REDIS_HOST         Default: 127.0.0.1
 *   REDIS_PORT         Default: 6379
 *   REDIS_PASSWORD     Default: (none)
 *   REDIS_DB           Default: 0
 *   REDIS_TLS          Set to "true" to enable TLS (required for Upstash, Redis Cloud, etc.)
 *   REDIS_KEY_PREFIX   Namespace prefix for every key.  Default: "brassica:"
 *
 * Behaviour:
 *   • Lazy connect — the connection is opened on first use, not at require-time,
 *     so importing this module never blocks startup.
 *   • Auto-reconnect with exponential back-off (ioredis default).
 *   • Errors are logged; they do NOT crash the process — the token manager
 *     falls back to in-process caching when Redis is unreachable.
 */

const Redis  = require("ioredis");
const logger = require("../utils/logger");


// ── Build connection options ──────────────────────────────────────────────────
function buildOptions() {
  const tls  = process.env.REDIS_TLS === "true";
  const base = {
    host:             process.env.REDIS_HOST     || "127.0.0.1",
    port:             parseInt(process.env.REDIS_PORT || "6379", 10),
    password:         process.env.REDIS_PASSWORD  || undefined,
    db:               parseInt(process.env.REDIS_DB   || "0",    10),
    keyPrefix:        process.env.REDIS_KEY_PREFIX || "brassica:",
    lazyConnect:      true,         // don't open socket at require-time
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    connectTimeout:   5_000,
    // Exponential back-off: 50 ms → 2 000 ms cap, then retry indefinitely
    retryStrategy: (times) => Math.min(50 * 2 ** times, 2_000),
    ...(tls ? { tls: {} } : {}),
  };
  return base;
}

let client;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    keyPrefix:            process.env.REDIS_KEY_PREFIX || "brassica:",
    lazyConnect:          true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(50 * 2 ** times, 2_000),
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
  });
} else {
  client = new Redis(buildOptions());
}

// ── Event logging ─────────────────────────────────────────────────────────────
client.on("connect",        ()    => logger.info("[Redis] Connected."));
client.on("ready",          ()    => logger.info("[Redis] Ready."));
client.on("reconnecting",   (ms)  => logger.warn(`[Redis] Reconnecting in ${ms} ms…`));
client.on("error",          (err) => logger.error("[Redis] Connection error:", err.message));
client.on("close",          ()    => logger.warn("[Redis] Connection closed."));
client.on("end",            ()    => logger.warn("[Redis] Connection ended."));

module.exports = client;
