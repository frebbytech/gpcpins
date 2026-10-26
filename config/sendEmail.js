const nodemailer = require("nodemailer");

// const resend = new Resend(process.env.MAIL_RESEND_API_KEY);

const sendEMail = async (email_address, message, subject) => {
  // if (process.env.NODE_ENV !== 'production') return true

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

  const mailOptions = {
    from: `GPC ${process.env.MAIL_CLIENT_USER}`,
    sender: process.env.MAIL_CLIENT_USER,
    bcc: typeof email_address === "string" ? [email_address] : email_address,
    subject: subject || "Gab Powerful Consult",
    text: "",
    html: message,
  };

  try {
    // verify connection configuration
    if (process.env.NODE_ENV !== "production") {
      transportMail.verify(function (error) {
        if (error) {
          console.log("Err is", error);
        } else {
          console.log("Server is ready to take our messages");
        }
      });
    }
    // console.log(mailOptions);

    // resend
    // const mailResult = await resend.emails.send({
    //   ...mailOptions,
    //   from: process.env.MAIL_CLIENT_USER,
    // });

    const mailResult = await transportMail.sendMail(mailOptions);

    // console.log('mail results is ',mailResult);

    return mailResult.data;
  } catch (error) {
    // await resend.emails.send({
    //   ...mailOptions,
    //   from: process.env.MAIL_CLIENT_USER,
    // }); // throw error.message;
    console.log(error);
  }
};

module.exports = sendEMail;
