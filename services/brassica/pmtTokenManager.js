"use strict";

/**
 * pmtTokenManager  (Redis-backed)
 *
 * Manages the JWT issued by Brassica's Payment Processor /api/Auth endpoint.
 *
 * ── Why Redis? ────────────────────────────────────────────────────────────────
 * The in-memory approach works for a single process but breaks under horizontal
 * scaling:
 *
 *   Problem 1 — N auth calls.  Every pod fetches its own token independently,
 *               multiplying traffic to Brassica's auth endpoint by the number
 *               of running instances.
 *
 *   Problem 2 — Token drift.  After a 401, the pod that detected it refreshes,
 *               but the others keep using their stale copies until their local
 *               TTL expires — causing a wave of 401s across the fleet.
 *
 *   Problem 3 — Cold starts.  A rolling restart or crash loses the cached token,
 *               making every first request to that instance pay the auth cost.
 *
 * ── Solution ──────────────────────────────────────────────────────────────────
 * One shared Redis key holds the live token.  A distributed lock (Redis SET NX)
 * ensures only one instance refreshes at a time — all others wait and then read
 * the newly-written value.
 *
 * ── Resilience ────────────────────────────────────────────────────────────────
 * If Redis is unreachable the manager falls back to its local in-process cache.
 * This means the service stays up during a Redis outage but loses the
 * multi-instance coordination until Redis recovers.
 *
 * ── Key layout (all prefixed by REDIS_KEY_PREFIX, default "brassica:") ────────
 *   brassica:pmt:token        — the Bearer token string
 *   brassica:pmt:token:lock   — distributed refresh lock (auto-expires)
 */

const axios = require("axios");
const redis = require("../../config/brassica.redisClient");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");
const config = require("../../config/brassica.config");

// ── Redis key names (the client already prepends REDIS_KEY_PREFIX) ────────────
const TOKEN_KEY = "pmt:token"; // stores the JWT string
const LOCK_KEY = "pmt:token:lock"; // mutex for the refresh critical section
const LOCK_VALUE = "1";
const LOCK_TTL_MS = 15_000; // lock auto-expires after 15 s (safety net)

// ── Local in-process cache — used as fallback when Redis is unreachable ───────
let _localToken = null;
let _localExpiresAt = 0;

// ── In-flight dedup promise (per process) ─────────────────────────────────────
// Even with Redis, concurrent requests *within the same process* should share
// one refresh attempt rather than all racing for the lock.
let _inflight = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Attempt to acquire the distributed lock.  Returns true on success. */
async function acquireLock() {
  try {
    // SET key value NX PX ttl — atomic: only sets if key does not exist
    const result = await redis.set(
      LOCK_KEY,
      LOCK_VALUE,
      "NX",
      "PX",
      LOCK_TTL_MS,
    );
    return result === "OK";
  } catch {
    return false; // Redis unreachable — caller handles gracefully
  }
}

/** Release the distributed lock. */
async function releaseLock() {
  try {
    await redis.del(LOCK_KEY);
  } catch {
    // Lock will auto-expire via TTL — safe to ignore del failure
  }
}

/**
 * Wait up to `maxWaitMs` for another instance to finish refreshing.
 * Polls Redis for the token key every `pollMs` milliseconds.
 */
async function waitForToken(maxWaitMs = 12_000, pollMs = 200) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    try {
      const token = await redis.get(TOKEN_KEY);
      if (token) return token;
    } catch {
      break; // Redis went away — fall through to local cache
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a valid Bearer token.
 *
 * Resolution order:
 *   1. Redis (shared across all instances, always preferred)
 *   2. Local in-process cache (fallback when Redis is unreachable)
 *   3. Fresh /api/Auth call under distributed lock
 */
async function getToken() {
  // 1. Try Redis first
  try {
    const redisToken = await redis.get(TOKEN_KEY);
    if (redisToken) {
      // Keep local cache in sync so fallback stays warm
      _localToken = redisToken;
      _localExpiresAt = Date.now() + config.brassicaPmt.tokenTTL;
      return redisToken;
    }
  } catch (err) {
    logger.warn(
      "[PmtTokenManager] Redis read failed, using local cache:",
      err.message,
    );
    // Fall through to local cache check
  }

  // 2. Local in-process cache (covers Redis-down scenario)
  if (_localToken && Date.now() < _localExpiresAt) {
    return _localToken;
  }

  // 3. Need a fresh token — deduplicate within this process first
  if (!_inflight) {
    _inflight = _refresh().finally(() => {
      _inflight = null;
    });
  }
  return _inflight;
}

/**
 * Invalidate the shared token and force a fresh one.
 * Call this when an upstream 401 is received.
 */
async function forceRefresh() {
  // Wipe both stores so the next getToken() call re-authenticates
  _localToken = null;
  _localExpiresAt = 0;
  try {
    await redis.del(TOKEN_KEY);
  } catch {
    // Not fatal — the expired token will be overwritten on next refresh
  }
  return getToken();
}

/**
 * Internal refresh — acquires the distributed lock, authenticates once,
 * writes the result to Redis + local cache, then releases the lock.
 * All other waiting callers (across all instances) read the new token from Redis.
 */
async function _refresh() {
  const locked = await acquireLock();

  if (!locked) {
    // Another instance is already refreshing — wait for it to finish
    logger.debug("[PmtTokenManager] Lock held by another instance — waiting…");
    const token = await waitForToken();

    if (token) {
      _localToken = token;
      _localExpiresAt = Date.now() + config.brassicaPmt.tokenTTL;
      return token;
    }

    // waitForToken timed out (Redis down or refresh took too long)
    // Fall back to a direct auth call without the lock
    logger.warn(
      "[PmtTokenManager] waitForToken timed out — authenticating directly.",
    );
    return _authenticate();
  }

  // We hold the lock — perform the auth call
  try {
    return await _authenticate();
  } finally {
    await releaseLock();
  }
}

/** Makes the actual HTTP call to Brassica PMT /api/Auth and persists the token. */
async function _authenticate() {
  const url = `${config.brassicaPmt.baseURL}/api/Auth`;
  logger.info("[PmtTokenManager] Refreshing Brassica PMT token…");

  let res;
  try {
    res = await axios.post(
      url,
      {
        apiUser: config.brassicaPmt.apiUser,
        apiKey: config.brassicaPmt.apiKey,
      },
      {
        timeout: config.brassicaPmt.timeout,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg =
      err.response?.data?.message || err.message || "Auth request failed";
    throw new AppError(
      `Brassica PMT auth failed: ${msg}`,
      502,
      null,
      "brassica_pmt",
    );
  }

  const { token, respCode, respDesc } = res.data || {};

  if (respCode !== "200" || !token) {
    throw new AppError(
      `Brassica PMT auth rejected: ${respDesc || "unknown"}`,
      502,
      respCode,
      "brassica_pmt",
    );
  }

  // ── Persist to Redis ────────────────────────────────────────────────────────
  // TTL in seconds (Redis EX flag).  We use tokenTTL - 120 s so the key expires
  // slightly before the token itself, prompting a proactive refresh rather than
  // a reactive 401.
  const redisTTLSeconds = Math.floor(
    (config.brassicaPmt.tokenTTL - 120_000) / 1_000,
  );

  try {
    await redis.set(TOKEN_KEY, token, "EX", Math.max(redisTTLSeconds, 60));
    logger.info(
      `[PmtTokenManager] Token written to Redis (TTL ${redisTTLSeconds}s).`,
    );
  } catch (err) {
    // Redis write failed — continue with local-only caching
    logger.warn(
      "[PmtTokenManager] Redis write failed, using local cache only:",
      err.message,
    );
  }

  // Always update local cache as fallback
  _localToken = token;
  _localExpiresAt = Date.now() + config.brassicaPmt.tokenTTL;

  logger.info(
    `[PmtTokenManager] Token refreshed — valid for ~${config.brassicaPmt.tokenTTL / 60_000} min.`,
  );
  return token;
}

// ── Graceful shutdown helper ───────────────────────────────────────────────────
/**
 * Call during process shutdown to flush pending operations and close the
 * Redis connection cleanly.  Registered automatically in server.js.
 */
async function disconnect() {
  try {
    await redis.quit();
    logger.info("[PmtTokenManager] Redis connection closed.");
  } catch {
    // Best-effort
  }
}

module.exports = { getToken, forceRefresh, disconnect };
