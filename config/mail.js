const nodemailer = require("nodemailer");
const { resendMailText, ecgText } = require("./mailText");
const { getFileStream } = require("./uploadFile");
const currencyFormatter = require("./currencyFormatter");
const { thankYouText } = require("./mailText");

const transportMail = nodemailer.createTransport({
  host: process.env.MAIL_CLIENT_SERVICE,
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_CLIENT_USER,
    pass: process.env.MAIL_CLIENT_PASS,
  },
  connectionTimeout: 15000,
  tls: {
    rejectUnauthorized: false,
  },
});

// const resend = new Resend(process.env.MAIL_RESEND_API_KEY);

const sendMail = async (transaction_id, email_address) => {
  if (process.env.NODE_ENV !== "production") return true;

  const mailOptions = {
    from: `GPC ${process.env.MAIL_CLIENT_USER}`,
    sender: process.env.MAIL_CLIENT_USER,
    bcc: [email_address],
    subject: "Vouchers & Tickets",
    text: "Application Vouchers",
    html: "<h1>Thank you for your business!!!.</h1>",
    attachments: [
      {
        filename: `${transaction_id}.pdf`,
        content: getFileStream("vouchers", transaction_id),
        // path: `./vouchers/${transaction_id}.pdf`,
      },
    ],
  };
  try {
    const mailResult = await transportMail.sendMail(mailOptions);
    // const mailResult = await resend.emails.send({
    //   ...mailOptions,
    //   from: process.env.MAIL_CLIENT_USER,
    // });
    return mailResult.data;
  } catch (error) {
    console.log(error);
  }
};

const sendTicketMail = async (
  transaction_id,
  email_address,
  type = "Voucher",
) => {
  // if (process.env.NODE_ENV !== 'production') return true

  const mailOptions = {
    from: `GPC ${process.env.MAIL_CLIENT_USER}`,
    sender: process.env.MAIL_CLIENT_USER,
    bcc: [email_address],
    subject: type || "Gab Powerful Consult",
    text: "Vouchers & Tickets",
    html: thankYouText(transaction_id),
    attachments: [
      {
        filename: `${transaction_id}.pdf`,
        content: getFileStream("vouchers", transaction_id),
      },
    ],
  };
  try {
    const mailResult = await transportMail.sendMail(mailOptions);
    // const mailResult = await resend.emails.send({
    //   ...mailOptions,
    //   from: process.env.MAIL_CLIENT_USER,
    // });
    return mailResult.data;
  } catch (error) {
    // throw error.message;

    console.log(error);
  }
};
const resendReceiptMail = async (
  transaction_id,
  email_address,
  downloadLink,
) => {
  // if (process.env.NODE_ENV !== "production") return true;

  const mailOptions = {
    from: `GPC ${process.env.MAIL_CLIENT_USER}`,
    sender: process.env.MAIL_CLIENT_USER,
    to: [email_address],
    subject: "Gab Powerful Consult",
    text: "Application Vouchers",
    html: resendMailText(transaction_id, downloadLink),
  };
  try {
    const mailResult = await transportMail.sendMail(mailOptions);
    // const mailResult = await resend.emails.send({
    //   ...mailOptions,
    //   from: process.env.MAIL_CLIENT_USER,
    // });
    return mailResult.data;
  } catch (error) {
    console.log(error);
    // throw error.message;
  }
};

const sendReportMail = async (
  email_address,
  content,
  transaction_id,
  subject,
) => {
  if (process.env.NODE_ENV !== "production") return true;

  const mailOptions = {
    from: `GPC ${process.env.MAIL_CLIENT_USER}`,
    sender: process.env.MAIL_CLIENT_USER,
    to: [email_address],
    subject,
    text: "Application Vouchers",
    html: content,
    attachments: [
      {
        filename: transaction_id,
        path: `./reports/${transaction_id}`,
      },
    ],
  };
  try {
    const mailResult = await transportMail.sendMail(mailOptions);
    // const mailResult = await resend.emails.send({
    //   ...mailOptions,
    //   from: process.env.MAIL_CLIENT_USER,
    // });
    return mailResult.data;
  } catch (error) {
    console.log(error);
  }
};

const sendPrepaidEmail = async (transaction) => {
  // const pdfBuffer = await getReceiptBuffer(transaction?.receiptUrl);

  const mailOptions = {
    from: `GPC ${process.env.MAIL_CLIENT_USER}`,
    sender: process.env.MAIL_CLIENT_USER,
    to: [transaction.email],
    subject: "Prepaid Units Confirmation",
    text: "Prepaid units",
    html: ecgText(
      transaction.token,
      `
      <div>       
      <p>Transaction ID:${transaction.transactionId}</p>
      <p>Meter No:${transaction.number}</p>
      <p>Meter Name:${transaction.name}</p>
        <p>Amount Paid:${currencyFormatter(transaction.amount)}</p>
        <p>Token:${transaction.token}</p>
        </div>
        <p>
        Attached to this message,is a copy of your receipt. Please keep it for your records.
        In case units do not load automatically,Please enter the token on your meter to load your units.Thank you!</p>
        `,
    ),
    attachments: [
      {
        filename: `${transaction.transactionId}-receipt.pdf`, // The file name the user will see
        // content: pdfBuffer,
        path: transaction?.receiptUrl,
        contentType: "application/pdf",
      },
    ],
  };

  try {
    const mailResult = await transportMail.sendMail(mailOptions);

    return mailResult.data;
  } catch (error) {
    console.log(error);
    //  throw error.message;
  }
};

module.exports = {
  sendReportMail,
  sendMail,
  sendTicketMail,
  resendReceiptMail,
  sendPrepaidEmail,
};
