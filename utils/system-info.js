const currencyFormatter = require("../config/currencyFormatter");
const { mailTextShell } = require("../config/mailText");
const sendEMail = require("../config/sendEmail");
const { sendSMS } = require("../config/sms");

const insufficientBalanceWarning = async (bal) => {
  const body = `
    Your one-4-all top up account balance is running low. Your remaining balance is ${currencyFormatter(bal)}.
    Please recharge to avoid any inconveniences. Thank you.
  `;

  if (process.env.NODE_ENV === "production") { 
    await sendEMail(
      process.env.MAIL_CLIENT_USER,
      mailTextShell(`<p>${body}</p>`),
      "LOW TOP UP ACCOUNT BALANCE",
    );

    await sendSMS(body, process.env.CLIENT_PHONENUMBER);
  }
};

module.exports = {
  insufficientBalanceWarning,
};
