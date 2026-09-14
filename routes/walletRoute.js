const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const multer = require("multer");
const { storeOTP, verifyOTP } = require("../services/otp.services");
const { rateLimit } = require("express-rate-limit");

const cron = require("node-cron");

const { verifyToken } = require("../middlewares/verifyToken");
const knex = require("../db/knex");
const { calculateTimeDifference } = require("../config/timeHelper");
const currencyFormatter = require("../config/currencyFormatter");
const { sendOTPSMS, sendSMS } = require("../config/sms");
const sendEMail = require("../config/sendEmail");
const { mailTextShell } = require("../config/mailText");
const { otpGen } = require("otp-gen-agent");
const generateId = require("../config/generateId");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { uploadAttachment } = require("../config/uploadFile");
const { pinSchema, pinResetSchema } = require("../utils/validationSchema");
const { validate } = require("../middlewares/validators");

const Storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./images/attachments/");
  },
  filename: function (req, file, cb) {
    const ext = file?.mimetype?.split("/")[1];

    cb(null, `${generateId()}.${ext}`);
  },
});

const Upload = multer({ storage: Storage });

const limit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 5 requests per windowMs
  message: "Too many requests!. please try again later.",
});

//Get Wallet Balance
router.get(
  "/status",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    const wallet = await knex("wallets")
      .where("user_id", id)
      .select("active", "created_at", "updated_at")
      .first();

    if (_.isEmpty(wallet) || Boolean(wallet?.active) === false) {
      const now = moment();
      const upTime = moment(new Date(wallet?.updated_at));
      const timeLeft = calculateTimeDifference(now, upTime);

      if (timeLeft.value <= 0) {
        await knex("wallets").where("user_id", id).update({
          active: 1,
        });

        return res.status(200).json({
          active: true,
        });
      }

      return res.status(200).json({
        active: false,
        timeOut:
          timeLeft?.type === "hours"
            ? `${timeLeft.value} hours`
            : `${timeLeft.value} minutes`,
      });
    }

    return res.status(200).json({
      active: Boolean(wallet?.active),
    });
  }),
);

//Get Wallet Balance
router.get(
  "/balance",
  limit,
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.query;

    const wallet = await knex("wallets")
      .where("user_id", id)
      .select("amount", "user_id")
      .first();

    if (_.isEmpty(wallet)) {
      return res.status(200).json(0);
    }

    res.status(200).json(wallet?.amount || 0);
  }),
);

//Get all wallet top up trnsactions
router.get(
  "/transactions",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id: userId } = req.user;
    let { startDate, endDate, page = 1, limit = 50 } = req.query;

    // ---------------- VALIDATION ----------------
    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "startDate and endDate are required",
      });
    }

    const sDate = moment(startDate).startOf("day").toDate();
    const eDate = moment(endDate).endOf("day").toDate();

    if (!moment(sDate).isValid() || !moment(eDate).isValid()) {
      return res.status(400).json({
        message: "Invalid date format",
      });
    }

    const transactions = await knex("wallet_transactions")
      .select(
        "id",
        "user_id",
        "wallet_id as wallet",
        "wallet_amount as walletAmount",
        "type",
        "amount",
        "comment",
        "status",
        "created_at as createdAt",
      )
      .where("user_id", userId)
      .whereBetween("created_at", [sDate, eDate])
      .orderBy("created_at", "desc");

    if (_.isEmpty(transactions)) {
      return res.status(200).json([]);
    }

    res.status(200).json(transactions);
  }),
);

router.get(
  "/pin-reset",
  limit,
  verifyToken,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { code } = req.query;

    if (code) {
      const result = await verifyOTP(user.id, Number(code));

      if (!result.success) {
        return res.status(400).json("Invalid Code");
      }
    } else {
      if (_.isEmpty(user) && !user?.phonenumber) {
        return res.status(400).json("Invalid Request");
      }

      const code = await otpGen();

      if (process.env.NODE_ENV !== "production") {
        console.log(code);
      }

      await storeOTP(user?.id, code);

      await sendOTPSMS(
        `Please ignore this message if you did not request the OTP.Your verification code is ${code}.Don't share this code with anyone; Our employees will never ask for the code.If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.`,
        user?.phonenumber,
      );
    }

    res.sendStatus(201);
  }),
);

//GET all users with wallet
router.get(
  "/users",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const usersWallets = await knex("vw_user_wallet_view")
      .join("roles", "vw_user_wallet_view.roleId", "roles.id")
      .select(
        "vw_user_wallet_view.walletId as id",
        "vw_user_wallet_view.amount",
        "vw_user_wallet_view.id as userId",
        "vw_user_wallet_view.email",
        "vw_user_wallet_view.phonenumber",
        "vw_user_wallet_view.name",
        "roles.code as role",
        "vw_user_wallet_view.createdAt",
        "vw_user_wallet_view.updatedAt",
        knex.raw("DATE_FORMAT(updatedAt,'%D %M %Y . %r' ) as updatedAt"),
      )
      .where("roles.code", process.env.USER_ID)
      .whereNot("vw_user_wallet_view.email", "customer@gpcpins.com")
      .orderBy("vw_user_wallet_view.createdAt", "desc");

    return res.status(200).json(usersWallets);
  }),
);
//GET all users with wallet
router.get(
  "/agents",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const agentWallets = await knex("vw_user_wallet_view")
      .join("roles", "vw_user_wallet_view.roleId", "roles.id")
      .select(
        "vw_user_wallet_view.walletId as id",
        "vw_user_wallet_view.amount",
        "vw_user_wallet_view.id as userId",
        "vw_user_wallet_view.email",
        "vw_user_wallet_view.phonenumber",
        "vw_user_wallet_view.name",
        "roles.code as role",
        "vw_user_wallet_view.createdAt",
        "vw_user_wallet_view.updatedAt",
        knex.raw("DATE_FORMAT(updatedAt,'%D %M %Y . %r' ) as updatedAt"),
      )
      .where("roles.code", process.env.AGENT_ID)
      .whereNot("vw_user_wallet_view.email", "customer@gpcpins.com")
      .orderBy("vw_user_wallet_view.createdAt", "desc");

    return res.status(200).json(agentWallets);
  }),
);

//POST Top up wallet balance
router.post(
  "/topup",
  limit,
  verifyToken,
  verifyAdmin,
  Upload.single("attachment"),
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const { id: user_id, comment, amount } = req.body;
    // console.log(req.body);

    const transaction = await knex.transaction();
    let url = req.file?.filename;

    try {
      if (req.file) {
        url = await uploadAttachment(req.file);
      }

      const agent_balance = await transaction("wallets")
        .where("user_id", user_id)
        .select("id", "amount")
        .first();

      await transaction("wallets")
        .where("user_id", user_id)
        .increment({
          amount: Number(amount),
        });
      await transaction("wallet_transactions").insert({
        id: generateId(),
        user_id,
        issuer: id,
        wallet_id: agent_balance?.id,
        type: "credit",
        wallet_amount: Number(agent_balance?.amount) + Number(amount),
        amount,
        comment: comment || "Top Up",
        attachment: url,
        status: "completed",
      });

      await transaction("notifications").insert({
        id: generateId(),
        user_id,
        type: "wallet",
        title: "Wallet",
        body: `Your wallet account has been credited with an amount of ${currencyFormatter(
          amount,
        )}.`,
      });

      //logs
      await transaction("activity_logs").insert({
        user_id: id,
        title: "Topped up agent wallet.",
        severity: "info",
      });
      await transaction.commit();

      return res.status(200).json("Wallet top up successful");
    } catch (error) {
      console.log(error);
      await transaction.rollback();
      return res.status(500).json("Top up failed");
    }
  }),
);

//Send wallet top up request
// router.post(
//   "/top-up-request",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     const user = req.user;

//     if (_.isEmpty(user)) {
//       return res.status(400).json("Invalid Request!");
//     }
//     try {
//       const mailBody = `<div>
//       <h1 style='text-transform:uppercase;'>Wallet Top Up Request</h1><br/>
//       <div style='text-align:left;'>

//       <p>A request has been placed by <strong>${
//         user?.fullname
//       }</strong> to top up wallet balance.
//       <p><strong>Fullname:</strong> ${user?.firstname} ${user?.lastname}</p>
//       <p><strong>Email:</strong> ${user?.email}</p><br/>
//       <p><strong>Telephone Number:</strong> ${user?.phonenumber}</p><br/>
//       <p><strong>Top Up Amount:</strong> ${currencyFormatter(
//         req?.body?.amount,
//       )}</p><br/>

//       </div>
//       </div>`;

//       // const message = `A request has been placed by ${
//       //   user?.name
//       // } to top up wallet balance.
//       // Name: ${user?.name},
//       // Email: ${user?.email},
//       // Telephone Number: ${user?.phonenumber},
//       // Top Up Amount: ${currencyFormatter(req?.body?.amount)}
//       // `;

//       // await knex("notifications").insert({
//       //   id: generateId(),
//       //   type:'admin',
//       //   title: "Wallet top up request",
//       //   message,
//       // });

//       await sendOTPSMS(
//         `Your request has been received.We'll get back to you shortly.`,
//         user?.phonenumber,
//       );

//       await sendEMail(
//         process.env.MAIL_CLIENT_USER,
//         mailTextShell(mailBody),
//         "Wallet Top Up Request",
//       );

//       res.status(200).json("Request Sent!");
//     } catch (error) {
//       res.status(500).json("An unknown error has occurred");
//     }
//   }),
// );

//update wallet pin

router.put(
  "/",
  limit,
  verifyToken,
  validate(pinResetSchema),
  asyncHandler(async (req, res) => {
    const { id: _id, email, phonenumber } = req.user;
    const { id, pin, isAdmin, userEmail } = req.body;

    const userId = isAdmin ? id : _id;
    const emailAddress = isAdmin ? userEmail : email;

    const hashedPin = await bcrypt.hash(pin, 12);

    const wallet = await knex("wallets")
      .where("user_id", userId)
      .update("user_key", hashedPin);

    if (wallet !== 1) {
      return res
        .status(400)
        .json("Error updating user pin! Please try again later.");
    }

    const text =
      "Your pin has been reset successfully.For security purposes, we wanted to ensure that you are aware of these changes. If you did not make these adjustments yourself or if you believe your account may have been compromised, please take immediate action by contacting us.";

    await knex("notifications").insert({
      id: generateId(),
      user_id: userId,
      type: "general",
      title: "Pin Reset",
      body: text,
    });

    const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333333;">Important: Profile Update Notification</h2>
    <p>Dear Customer ,</p>
    <p> Your profile information has been updated.</p>
    <p>For security purposes, we wanted to ensure that you are aware of these changes. If you did not make these adjustments yourself or if you believe your account may have been compromised, please take immediate action by contacting our support team at <a href='mailto:info@gpcpins.com'>info@gpcpins</a>.</p>
    <p>If you have made these changes intentionally, please disregard this message.</p>
    <p>Thank you for your attention to this matter.</p>

    <p>Best regards,</p>
    <p>Gab Powerful Team<br>
</div>
    `;

    setImmediate(async () => {
      if (!isAdmin && phonenumber) {
        await sendSMS(text, phonenumber);
      }

      await sendEMail(emailAddress, message, "Profile Update Notification");
    });

    res.status(200).json("Wallet Pin Changed!");
  }),
);

//Get Wallet Balance
router.put(
  "/status",
  limit,
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    if (!id) {
      return res.sendStatus(204);
    }

    await knex("wallets").where("user_id", id).update({ active: 0 });
    return res.sendStatus(204);
  }),
);

module.exports = router;
