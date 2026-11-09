const { default: axios } = require("axios");
// const { getSocket } = require("./whatsapp/whatsapp.socket");

async function sendText(sessionId, phone, message) {
  await axios.post(`http://localhost:4000/send-text`, {
    sessionId,
    phone,
    message,
  });

  return true;
}

module.exports = {
  sendText,
};
