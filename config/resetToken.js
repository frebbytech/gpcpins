const crypto = require("crypto");

/**
 * Stateless, single-use password-reset tokens.
 *
 * token = base64url(`${expiresAtMs}.${hmac}`)
 * hmac  = HMAC-SHA256(secret, `${userId}.${expiresAtMs}.${sha256(passwordHash)}`)
 *
 * Because the current password hash is part of the signed data, the token stops
 * working the moment the password changes (single use) and can never be used
 * for another account. Nothing needs to be stored.
 *
 * Requires PASSWORD_RESET_SECRET (32+ chars). Never reuse the JWT secret.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

const getSecret = () => {
  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PASSWORD_RESET_SECRET must be set (32+ characters).");
  }
  return secret;
};

const fingerprint = (passwordHash) =>
  crypto.createHash("sha256").update(String(passwordHash ?? "")).digest("hex");

const sign = (userId, expiresAt, passwordHash) =>
  crypto
    .createHmac("sha256", getSecret())
    .update(`${userId}.${expiresAt}.${fingerprint(passwordHash)}`)
    .digest("hex");

const signResetToken = (userId, passwordHash, ttlMs = DEFAULT_TTL_MS) => {
  const expiresAt = Date.now() + ttlMs;
  const mac = sign(userId, expiresAt, passwordHash);
  return Buffer.from(`${expiresAt}.${mac}`).toString("base64url");
};

const verifyResetToken = (userId, passwordHash, token) => {
  if (!userId || !passwordHash || typeof token !== "string" || !token) {
    return false;
  }

  let decoded;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const [expiresRaw, mac] = decoded.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || !mac || Date.now() > expiresAt) {
    return false;
  }

  const expected = Buffer.from(sign(userId, expiresAt, passwordHash), "hex");
  let given;
  try {
    given = Buffer.from(mac, "hex");
  } catch {
    return false;
  }

  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

module.exports = { signResetToken, verifyResetToken };
