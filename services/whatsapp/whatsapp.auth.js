// whatsapp/whatsapp.auth.js

const redisClient = require("../../config/redisClient");

async function loadAuthState(sessionId) {
  const data = await redisClient.get(`wa:auth:${sessionId}`);

  return data ? JSON.parse(data) : null;
}

async function saveAuthState(sessionId, auth) {
  await redisClient.set(`wa:auth:${sessionId}`, JSON.stringify(auth));
}


async function saveQr(
  sessionId,
  qr
) {
  await redisClient.set(
    `wa:qr:${sessionId}`,
    qr,
    "EX",
    300
  );
}

module.exports = {
  loadAuthState,
  saveAuthState,
  saveQr
};
