const redis = require("../config/redisClient");

// const OTP_PREFIX = "gpcpins";
// const ATTEMPT_PREFIX = "gpcpins_attempts";

const OTP_TTL = 900; // 10 minutes
const MAX_ATTEMPTS = 5;

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP
async function storeOTP(
  userId,
  otp,
  OTP_PREFIX = "gpcpins",
  ATTEMPT_PREFIX = "gpcpins_attempts",
) {
  const key = `${OTP_PREFIX}:${userId}`;

  // console.log(userId,otp)

  await redis.set(key, Number(otp), { ex: OTP_TTL });

  // reset attempts
  await redis.del(`${ATTEMPT_PREFIX}:${userId}`);
}

// Verify OTP
async function verifyOTP(
  userId,
  otp,
  OTP_PREFIX = "gpcpins",
  ATTEMPT_PREFIX = "gpcpins_attempts",
) {
  const key = `${OTP_PREFIX}:${userId}`;
  const attemptsKey = `${ATTEMPT_PREFIX}:${userId}`;

  const storedOTP = await redis.get(key);

  if (!storedOTP) {
    return { success: false, message: "OTP expired or not found" };
  }

  const attempts = (await redis.get(attemptsKey)) || 0;

  if (attempts >= MAX_ATTEMPTS) {
    return { success: false, message: "Too many attempts" };
  }

  if (storedOTP.toString() !== otp.toString()) {
    await redis.incr(attemptsKey);
    await redis.expire(attemptsKey, OTP_TTL);

    return { success: false, message: "Invalid OTP" };
  }

  // success → delete OTP
  await redis.del(key);
  await redis.del(attemptsKey);

  return { success: true };
}

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
};
