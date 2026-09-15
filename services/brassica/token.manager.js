// services/brassica/token.manager.js

// Token storage helpers for reading and writing the current cached token.
const { getToken, setToken } = require("./token.store.js");

// Lock helpers to avoid concurrent refresh attempts.
const { acquireLock, releaseLock } = require("./token.lock.js");
// Circuit breaker wrapper for the brassica auth endpoint.
const { authBreaker } = require("./auth.client.js");
// Metrics collector used for debugging and observability.
const tokenMetrics = require("./token.metrics.js");
const logger = require("../../utils/logger.js");
const redisClient = require("../../config/redisClient.js");

function sleep(ms) {
  // Pause execution for a defined interval before retrying.
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshToken() {
  // Request a fresh token from the auth service.
  const response = await authBreaker.fire();

  // Extract the token from the expected response structure.
  const token = response?.data?.resp1;

  if (!token) {
    // Ensure callers receive an error when auth fails to return a token.
    throw new Error("Brassica token missing");
  }

  // Persist the new token in local storage so future requests can reuse it.
  await setToken(token);

  // Track refresh activity for monitoring cache behavior.
  tokenMetrics.refreshes++;

  return token;
}

async function getBrassicaToken() {
  // Try to read from the local token cache first.
  let token = await getToken();

  if (token) {
    tokenMetrics.cacheHits++;
    return token;
  }

  // Cache miss means we need to refresh or wait for another process to refresh.
  tokenMetrics.cacheMisses++;

  // Acquire a lock to ensure only one refresh request happens at once.
  const lock = await acquireLock();

  if (lock) {
    try {
      return await refreshToken();
    } finally {
      // Always release the lock after refresh attempts.
      await releaseLock();
    }
  }

  // Another process is refreshing the token, poll the cache until it appears.
  for (let i = 0; i < 20; i++) {
    await sleep(500);

    token = await getToken();
  

    if (token) {
      return token;
    }
  }

  // If the token is still unavailable after retries, fail clearly.
  throw new Error("Unable to obtain Brassica token");
}

/**
 * Sets a key-value pair in Redis with a 5-minute expiration time.
 * @param {string} key - The unique identifier key.
 * @param {any} value - The data to store (will be converted to JSON string).
 */
async function saveMeter(key, value) {
  try {
    // 60 minutes = 3600 seconds
    const EXPIRE_IN_SECONDS = 3600;

    // Always stringify objects/arrays before saving to Redis
    const stringValue =
      typeof value === "object" ? JSON.stringify(value) : String(value);

    // Use the 'EX' option to set expiration in seconds
    await redisClient.set(`$meter:${key}`, stringValue, {
      EX: EXPIRE_IN_SECONDS,
    });

    if (process.env.NODE_ENV !== "production") {
      logger.info(`Successfully cached key "${key}" for 60 minutes.`);
    }
  } catch (error) {
    console.log(error);
    // Log the error but don't throw it, keeping your server alive
    logger.error(`Failed to set Redis key "${key}":`, error);
  }
}

/**
 * Retrieves a key from Redis and automatically parses it back from JSON if necessary.
 * @param {string} key - The unique identifier key.
 * @returns {any|null} The parsed data, or null if the key has expired or does not exist.
 */
async function getMeter(key) {
  try {
    const data = await redisClient.get(`meter:${key}`);

    // If the key has expired or doesn't exist, Redis returns null
    if (!data) {
      if (process.env.NODE_ENV !== "production") {
        logger.info(`Redis cache miss for key: "${key}"`);
      }
      return null;
    }

    // Try to parse the string back into an object/array
    try {
      return JSON.parse(data);
    } catch {
      // If it's a plain string that can't be parsed, return it as-is
      return data;
    }
  } catch (error) {
    // Log the network error but don't crash the server; treat it as a temporary cache miss
    logger.error(`Failed to get Redis key "${key}":`, error);
    return null;
  }
}

module.exports = {
  refreshToken,
  getBrassicaToken,
  saveMeter,
  getMeter,
};
