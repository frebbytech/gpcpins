const router = require("express").Router();
const { randomBytes } = require("crypto");
const pLimit = require("p-limit");
const cors = require("cors");
const _ = require("lodash");
const moment = require("moment");
const { rateLimit } = require("express-rate-limit");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

//functons
const {
  sendMoney,
  topUpStatus,
  accountBalance,
  getBundleList,
  sendBundle,
  sendAirtime,
  POS_Balance,
  PREPAID_Balance,
  moneyStatus,
} = require("../config/sendMoney");
const sendEMail = require("../config/sendEmail");
const { sendTicketMail } = require("../config/mail");
const { sendSMS } = require("../config/sms");
const currencyFormatter = require("../config/currencyFormatter");
const sendElectricityMail = require("../config/ecgMail");
const verifyAdmin = require("../middlewares/verifyAdmin");

const { isValidUUID2 } = require("../config/validation");
const knex = require("../db/knex");
const {
  verifyToken,
  verifyOptionalToken,
} = require("../middlewares/verifyToken");
const { mailTextShell } = require("../config/mailText");
const { MTN, VODAFONE, AIRTELTIGO } = require("../config/bundleList");
const generateId = require("../config/generateId");
const { safeJSON } = require("../config/helpers");
const {
  voucherSchema,
  walletTopUpSchema,
  prepaidSchema,
  ticketSchema,
  bundleSchema,
  airtimeSchema,
  airtimeTopUpSchema,
  bundleTopUpSchema,
  billerPaymentSchema,
} = require("../utils/validationSchema");
const validateECG = require("../middlewares/validate");
const { validatePayment, validate } = require("../middlewares/validators");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const { paymentLimiter } = require("../middlewares/rateLimiter");
const { paymentLockMiddleware } = require("../middlewares/paymentLock");
const {
  emitPaymentSuccess,
  emitGeneralInfo,
  emitPaymentFailure,
} = require("../config/emitters");
const redisClient = require("../config/redisClient");
const { storage } = require("../firebase");
const { messageQueue } = require("../queues/message.queue");
const { getInternationalMobileFormat } = require("../config/PhoneCode");
const logger = require("../utils/logger");
const { ticketQueue, voucherQueue } = require("../queues/queues");
const { formatDate, formatTime } = require("../config/dateConfigs");
const { brassicaPost } = require("../services/brassicaClient");
const { getMeter, saveMeter } = require("../services/brassica/token.manager");
const {
  sendBrassicaMoney,
  getBrassicaBalance,
} = require("./brassica/brasiccaMoney");

// ===============================
// 1. Configuration & Constants
// ===============================
const NETWORK_MAP = {
  "mtn-gh": 4,
  "vodafone-gh": 6,
  "tigo-gh": 1,
  // add others as needed
};

const SUCCESS_CODES = ["00", "09"]; // from external APIs
const ALLOWED_TYPES = ["voucher", "ticket", "prepaid", "airtime", "bundle"];

const PAYMENT_TABLE_MAP = {
  v: "vw_payments_voucher_transactions",
  a: "vw_payments_airtime_transactions",
  b: "vw_payments_bundle_transactions",
  p: "vw_meter_payment_prepaid_transaction_view",
  w: "vw_payments_wallet_transactions",
};

const BASE_PAYMENT_FIELDS = [
  "id",
  "paymentId",
  "paymentReference",
  "service",
  "amount",
  "phonenumber",
  "userId",
  "status",
];

const STATUS_MAP = {
  "0000": "completed",
  "0001": "pending",
};

const corsOptions = {
  methods: "POST",
  origin: process.env.CLIENT_URL,
};

const ALLOWED_CATEGORIES = [
  "waec",
  "stadium",
  "university",
  "cinema",
  "security",
  "bus",
];

const rlimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per windowMs
  message: "Too many requests! Please try again later.",
});

const limit = pLimit(3);

const isProduction = process.env.NODE_ENV === "production";

router.get(
  "/vouchers",
  verifyOptionalToken,
  rlimit,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user || {};
    const { id: transactionId } = req.query;

    if (!transactionId || !isValidUUID2(transactionId)) {
      return res.status(400).json("Invalid transaction id");
    }

    const transaction = await knex("vw_payments_voucher_transactions")
      .select(
        "paymentId",
        "paymentReference",
        "id",
        "info",
        "email",
        "service",
        "phonenumber",
        "vouchers",
        "status",
      )
      .where({
        id: transactionId,
        service: "voucher",
      })
      .first();

    if (!transaction) {
      return res.status(404).json("Transaction not found");
    }

    const { id, paymentReference, email, phonenumber, status, info, vouchers } =
      transaction;

    if (status === "pending" || status === "failed") {
      return res.status(409).json("Payment has not been completed");
    }

    const userInfo = safeJSON(info);

    // ==========================================
    // PDF ALREADY GENERATED
    // ==========================================

    if (userInfo?.downloadLink) {
      setImmediate(async () => {
        const selectedVoucher = safeJSON(vouchers);

        if (email) {
          await sendTicketMail(id, email, selectedVoucher[0]?.voucherType);
        }

        if (phonenumber) {
          await sendSMS(
            `${selectedVoucher[0]?.voucherType}   
Please visit https://www.gpcpins.com/evoucher to print your vouchers.
Download voucher here: ${userInfo?.downloadLink}`,
            phonenumber || "",
          );
        }

        await emitGeneralInfo({
          emitter: "ticket-generation",
          userId: userID || phonenumber || paymentReference,
          data: userInfo?.downloadLink,
        });
      });

      return res.status(200).json({
        success: true,
        status: "completed",
        id,
        downloadLink: userInfo.downloadLink,
      });
    }

    const voucherIds = safeJSON(vouchers);

    if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
      return res.status(409).json({
        success: false,
        message: "No vouchers assigned to transaction",
      });
    }

    // ==========================================
    // REDIS LOCK
    // ==========================================

    const lockKey = `voucher:generate:${id}`;

    const lock = await redisClient.set(lockKey, "1", "NX", "EX", 300);

    if (!lock) {
      return res.status(202).json({
        success: true,
        status: "processing",
        message: "Voucher generation already in progress",
      });
    }

    // ==========================================
    // QUEUE JOB
    // ==========================================

    await voucherQueue.add(
      "voucher-generation",
      {
        transactionId: id,
        userID,
      },
      {
        jobId: id,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    return res.status(202).json({
      success: true,
      status: "queued",
      id: id,
      message: "Voucher generation has been queued",
    });
  }),
);

router.get(
  "/tickets",
  rlimit,
  verifyOptionalToken,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user || {};
    const { id: transactionId } = req.query;

    if (!transactionId || !isValidUUID2(transactionId)) {
      return res.status(400).json("Invalid transaction id");
    }

    const transaction = await knex("vw_payments_voucher_transactions")
      .select(
        "id",
        "paymentId",
        "paymentReference",
        "info",
        "email",
        "service",
        "phonenumber",
        "vouchers",
        "status",
      )
      .where({
        id: transactionId,
        service: "ticket",
      })
      .first();

    if (!transaction) {
      return res.status(404).json("Transaction not found");
    }

    const { id, paymentReference, email, phonenumber, status, info, vouchers } =
      transaction;

    if (status === "pending" || status === "failed") {
      return res.status(409).json("Payment has not been completed");
    }

    const userInfo = safeJSON(info);

    if (userInfo?.downloadLink) {
      setImmediate(async () => {
        const selectedVoucher = safeJSON(vouchers);

        if (email) {
          await sendTicketMail(id, email, selectedVoucher[0]?.voucherType);
        }

        if (phonenumber) {
          await sendSMS(
            `${selectedVoucher[0]?.voucherType}   
Please visit https://www.gpcpins.com/evoucher to print your vouchers.
Download voucher here: ${userInfo?.downloadLink}`,
            phonenumber || "",
          );
        }

        await emitGeneralInfo({
          emitter: "ticket-generation",
          userId: userID || phonenumber || paymentReference,
          data: userInfo?.downloadLink,
        });
      });

      return res.status(200).json({
        success: true,
        status: "completed",
        id,
        downloadLink: userInfo.downloadLink,
      });
    }

    const lock = await redisClient.set(`ticket:${id}`, "1", "NX", "EX", 300);

    if (!lock) {
      return res.status(202).json({
        status: "processing",
      });
    }

    await ticketQueue.add(
      "ticket-generation",
      {
        transactionId: id,
        userID,
      },
      {
        jobId: id,
        attempts: 5,
        removeOnComplete: 100,
      },
    );

    return res.status(202).json({
      status: "queued",
      id,
      phonenumber: transaction?.phonenumber,
      email: transaction?.email,
    });
  }),
);

router.get(
  "/airtime",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    // 1. Initialize query with an internal join to avoid the N+1 loop
    let query = knex("vw_payments_airtime_transactions as t")
      .leftJoin("vw_users_with_roles as u", "t.issuerId", "u.id")
      .select(
        "t.id",
        "t.paymentId",
        "t.orderId",
        "t.recipient",
        "t.email",
        "t.phonenumber",
        "t.info",
        "t.year",
        "t.amount",
        "t.isProcessed",
        "t.active",
        "t.createdAt",
        "t.updatedAt",
        "t.status",
        "t.issuerId",
        "u.name as issuerName", // Aliased to separate from transaction columns
      )
      .where({ "t.kind": "bulk" })
      .orderBy("t.updatedAt", "desc"); // Fast database-level sorting

    // 2. Perform database-level date filtering if provided
    if (startDate && endDate) {
      const sDate = moment(startDate)
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss");
      const eDate = moment(endDate).endOf("day").format("YYYY-MM-DD HH:mm:ss");

      query = query.whereBetween("t.updatedAt", [sDate, eDate]);
    }

    const transactions = await query;

    // 3. Clean up formatting and parse strings to objects cleanly in one pass
    const sortedPayments = transactions.map((transaction) => {
      const isProcessed = Boolean(transaction.isProcessed);

      return {
        id: transaction.id,
        paymentId: transaction.paymentId,
        orderId: transaction.orderId,
        email: transaction.email?.trim(),
        phonenumber: transaction.phonenumber?.trim(),
        year: transaction.year,
        amount: transaction.amount,
        active: transaction.active,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        status: transaction?.status,
        processingStatus: isProcessed ? "completed" : "pending",
        issuerId: transaction.issuerId,
        issuer: transaction.issuerName || null,
        isProcessed: Boolean(transaction.isProcessed),
        recipient: safeJSON(transaction.recipient),
        info: safeJSON(transaction.info),
      };
    });
    // console.log(sortedPayments[0]);

    res.status(200).json(sortedPayments);
  }),
);

//Check Balance Status
router.get(
  "/balances",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    try {
      const [posResponse, preResponse, accResponse, brassicaBalance] =
        await Promise.allSettled([
          POS_Balance(),
          PREPAID_Balance(),
          accountBalance(),
          getBrassicaBalance(),
        ]);

      res.status(200).json({
        pos: posResponse?.value?.amount || 0,
        pre: preResponse?.value?.amount || 0,
        balance: accResponse?.value?.balance || 0,
        brassicaBalance: brassicaBalance?.value?.accountBalance || 0,
      });
    } catch (error) {
      logger.error(error);
      res.status(401).json("Am unknown error has occurred!");
    }
  }),
);
//Check Balance Status
router.get(
  "/hb/pos",
  // verifyToken,
  // verifyAdmin,
  asyncHandler(async (req, res) => {
    try {
      const response = await POS_Balance();

      res.status(200).json(response?.amount);
    } catch (error) {
      logger.error(error);
      res.status(401).json("Am unknown error has occurred!");
    }
  }),
);

//Check Balance Status
router.get(
  "/hb/prepaid",
  // verifyToken,
  // verifyAdmin,
  asyncHandler(async (req, res) => {
    try {
      const response = await PREPAID_Balance();

      res.status(200).json(response?.amount);
    } catch (error) {
      logger.error(error);
      res.status(401).json("Am unknown error has occurred!");
    }
  }),
);

//Check Balance Status
router.get(
  "/top-up/balance",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    try {
      const response = await accountBalance();

      res.status(200).json(response?.balance);
    } catch (error) {
      res.status(401).json("Am unknown error has occurred!");
    }
  }),
);

//Get List of all bundles
router.get(
  "/top-up/bundlelist",
  // verifyToken,
  asyncHandler(async (req, res) => {
    const network = req.query?.network;
    let response = [];
    try {
      if (process.env.NODE_ENV === "production") {
        response = await getBundleList(network);
      } else {
        if (network === "4") {
          response = MTN;
        }
        if (network === "6") {
          response = VODAFONE;
        }
        if (network === "1") {
          response = AIRTELTIGO;
        }
      }

      const bundles = response?.bundles?.map((bundle) => {
        const { meta, network, ...rest } = bundle;
        if (Number(rest.price) === 0) return;
        return rest;
      });

      // logger.info(_.groupBy(bundles, 'category'))

      res.status(200).json(_.compact(bundles));
    } catch (error) {
      logger.error(error);
      res.status(401).json("An unknown error has occurred");
    }
  }),
);

router.get(
  "/confirm/:id/:serviceType",
  verifyOptionalToken,
  asyncHandler(async (req, res) => {
    const trx = await knex.transaction();

    try {
      const { id, serviceType } = req.params;

      // console.log(id, serviceType);

      if (!isValidUUID2(id)) {
        return res.status(400).json("Invalid request");
      }

      // ---------------- FETCH TRANSACTION + PAYMENT ----------------

      const transaction = await getTransaction(serviceType, id, trx);
      console.log(transaction);

      if (!transaction) {
        await trx.rollback();
        return res.status(404).json("Transaction not found");
      }

      // ---------------- STATE VALIDATION ----------------
      if (transaction.status === "failed") {
        emitPaymentFailure({
          userId: transaction?.userId,
          txRef: transaction.phonenumber || transaction?.paymentReference,
          reason: "Transaction Failed",
        });

        await trx.rollback();
        return res.status(400).json("Payment failed!");
      }

      if (transaction.status !== "completed") {
        await trx.rollback();
        return res.status(400).json("Payment not completed");
      }

      // ---------------- IDEMPOTENCY ----------------
      if (transaction.isProcessed) {
        await trx.commit();
        return res.status(200).json({
          message: "Already processed",
          id: transaction.id,
        });
      }

      const info = safeJSON(transaction?.info);

      let selectedVouchers = [];

      // ---------------- PROCESS SERVICES ----------------
      // console.log(transaction)

      switch (transaction.service) {
        case "voucher":
        case "ticket":
          selectedVouchers = await processVoucher(trx, transaction);
          break;

        case "bundle":
          await processBundle(trx, transaction);
          break;

        case "airtime":
          await markProcessed(trx, transaction);
          break;

        case "prepaid":
          await processPrepaid(trx, transaction, info);
          break;
        case "wallet":
          await processWalletTopUp(trx, transaction);
          break;
      }

      await trx.commit();

      // ---------------- ASYNC EXTERNAL CALLS ----------------

      triggerAsyncProcessing(transaction, selectedVouchers); // 🔥 non-blocking

      // console.log(formatResponse(transaction));

      return res.status(200).json(formatResponse(transaction));
    } catch (error) {
      await trx.rollback();
      logger.error(error);
      return res.status(500).json("Transaction failed");
    }
  }),
);

// Cancel Payment @route   GET api/transaction/:id
router.get(
  "/cancel/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const type = req.query.type;

    await knex("payments").where({ id: id }).update({
      status: "failed",
    });

    res.status(200).json("Payment Cancelled!");
  }),
);

router.get(
  "/download/:id",
  limit,
  verifyOptionalToken,
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Map the ID to your path inside the Firebase Storage bucket
    const bucketFilePath = `gpcpins/vouchers/${id}.pdf`;
    const file = storage.file(bucketFilePath);

    // 1. Check if the file actually exists in Firebase Storage
    const [exists] = await file.exists();

    if (!exists) {
      return res
        .status(404) // Changed to 404 as it is standard for missing resources
        .json("We couldnt find a transaction which match your transaction id");
    }

    // 2. Set optimal headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="voucher-${id}.pdf"`,
    );

    // 3. Stream the file directly from Firebase to the client response
    const downloadStream = file.createReadStream();

    downloadStream.on("error", (err) => {
      logger.error("Firebase storage download error:", err);
      if (!res.headersSent) {
        res.status(500).json("Error retrieving your file.");
      }
    });

    downloadStream.pipe(res);
  }),
);

router.post(
  "/",
  paymentLimiter,
  verifyOptionalToken,
  idempotencyMiddleware,
  paymentLockMiddleware,
  validatePayment(voucherSchema, ticketSchema),
  asyncHandler(async (req, res) => {
    const trx = await knex.transaction();

    try {
      const { id: userId, name } = req.user;

      const {
        category,
        service,
        categoryId,
        voucherName,
        totalAmount,
        quantity,
        paymentDetails,
        user,
        isWallet,
        token,
      } = req.body;

      // ---------------- VALIDATION ----------------
      if (!category || !ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json("Invalid category");
      }

      if (!totalAmount || Number(totalAmount) <= 0) {
        return res.status(400).json("Invalid amount");
      }

      // ---------------- GENERATE IDS ----------------
      const paymentId = generateId();
      const transactionId = generateId();
      const reference = randomBytes(24).toString("hex");
      const orderNo = randomBytes(20).toString("hex");

      // ---------------- SELECT VOUCHERS ----------------
      const selectedVouchers = await selectVouchers({
        trx,
        category,
        categoryId,
        quantity,
        paymentDetails,
      });

      if (
        !selectedVouchers ||
        selectedVouchers.length === 0 ||
        selectedVouchers.length < quantity
      ) {
        return res
          .status(404)
          .json(`${voucherName} ${service} not available. Try again later!`);
      }

      // ---------------- CREATE PAYMENT ----------------
      let paymentStatus = "pending";
      let providerResponse = null;

      if (isWallet) {
        // ---- WALLET VALIDATION ----
        const wallet = await trx("wallets")
          .where({ user_id: userId })
          .first()
          .forUpdate();

        if (!wallet) {
          await trx.rollback();
          return res.status(401).json("Wallet not found");
        }

        const isPinValid = await bcrypt.compare(token, wallet.user_key);
        if (!isPinValid) {
          await trx.rollback();
          return res.status(401).json("Invalid PIN!");
        }

        if (Number(wallet.amount) < Number(totalAmount)) {
          await trx.rollback();
          return res.status(400).json("Insufficient funds");
        }

        // ---- DEDUCT WALLET ----
        await trx("wallets")
          .where({ user_id: userId })
          .decrement("amount", totalAmount);

        await trx("wallet_transactions").insert({
          id: generateId(),
          user_id: userId,
          wallet_id: wallet.id,
          wallet_amount: wallet.amount,
          issuer: name || "GPC Customer",
          type: "debit",
          comment: `${voucherName} ${service} purchase`,
          amount: totalAmount,
          status: "completed",
          reference,
        });

        paymentStatus = "completed";
        providerResponse = { code: "WALLET_SUCCESS" };
      } else {
        // ---- MOBILE MONEY ----
        const paymentPayload = {
          name: user?.name || "GPC Customer",
          phonenumber: user?.phonenumber,
          email: user?.email,
          amount: Number(totalAmount).toFixed(2),
          provider: user?.provider,
          transaction_reference: reference,
        };

        const response = await sendMoney(paymentPayload, "v");

        providerResponse = response;

        paymentStatus =
          response?.ResponseCode === "0000"
            ? "completed"
            : response?.ResponseCode === "0001"
              ? "pending"
              : "failed";
      }
      // paymentStatus = "failed";

      // ---------------- INSERT PAYMENT ----------------
      await trx("payments").insert({
        id: paymentId,
        user_id: userId,
        reference,
        service,
        amount: totalAmount,
        year: moment().year(),
        provider: isWallet ? "wallet" : user?.provider,
        mode: isWallet ? "Wallet" : "Mobile Money",
        status: paymentStatus,
        externalTransactionId: null,
        partner: JSON.stringify(providerResponse),
      });

      const sVouchers = selectedVouchers.map((v) => v.id);

      // ---------------- INSERT SERVICE TRANSACTION ----------------
      const transaction = await trx("voucher_transactions").insert({
        id: transactionId,
        payment_id: paymentId,
        email: user?.email || "",
        phonenumber: user?.phonenumber || "",
        vouchers: JSON.stringify(sVouchers),
        info: JSON.stringify({
          orderNo,
          categoryType: category,
          categoryId,
          quantity,
          amount: totalAmount,
          paymentDetails,
          user,
        }),
      });

      // ---------------- UPDATE VOUCHERS ----------------
      await trx("vouchers")
        .whereIn("id", sVouchers)
        .update({
          status: "sold",
          active: 1,
          updated_at: knex.fn.now(),
          reserved_at: knex.fn.now(),
          reservation_expires_at: knex.raw(
            "DATE_ADD(NOW(), INTERVAL 10 MINUTE)",
          ),
        });

      await trx.commit();

      const completedTransaction = {
        paymentId,
        transactionId,
        reference,
        status: paymentStatus,
        categoryType: service,
      };

      res.status(200).json(completedTransaction);

      if (isWallet && !_.isEmpty(transaction)) {
        setImmediate(async () => {
          if (completedTransaction?.status === "completed") {
            await emitPaymentSuccess({
              userId: userId,
              txRef: user?.phonenumber || reference,
              amount: totalAmount,
              transaction: {
                id: transactionId || paymentId,
                paymentReference: reference,
                categoryId: categoryId,
                categoryType: category,
                status: paymentStatus,
                userName: user?.name || "",
                email: user?.email,
                phonenumber: user.phonenumber,
                paymentMode: "Wallet",
                amount: totalAmount,
                createdAt: new Date().toISOString(),
              },
            });
          } else {
            await emitPaymentFailure({
              userId,
              txRef: user.phonenumber || reference,
              reason: "Payment failed",
            });
          }
        });
      }

      // if (!isWallet) {
      //   const payload = {
      //     ResponseCode: "0000",
      //     Message: "success",
      //     Data: {
      //       Amount: totalAmount,
      //       Charges: 0.05,
      //       AmountAfterCharges: 0.8,
      //       Description:
      //         " The Vodafone Cash payment has been approved and processed successfully",
      //       ClientReference: reference,
      //       TransactionId: "09f84e20a283942e807128e8c21d08d6",
      //       ExternalTransactionId: generateId(),
      //       AmountCharged: 0.85,
      //       OrderId: "09f84e20a283942e807128e8c21d08d6",
      //       PaymentDate: "2024-05-14T00:44:57.5142719Z",
      //     },
      //   };

      //   await paymentCallback(res, payload, "v");
      // }
    } catch (error) {
      await trx.rollback();
      logger.error(error);

      console.log(error);
      return res.status(500).json("Transaction failed");
    }
  }),
);

router.post(
  "/electricity",
  paymentLimiter,
  verifyOptionalToken,
  idempotencyMiddleware,
  paymentLockMiddleware,
  validateECG,
  validatePayment(prepaidSchema),
  asyncHandler(async (req, res) => {
    // Safely extract user fields (handling unauthenticated optional token states)
    const userID = req.user?.id || "";
    const userName = req.user?.name || "GPC";

    const { info, meter, amount, isWallet, token } = req.body;

    //     console.log(req.body)
    // return res.status(400).json( "Meter not found");
    const userPhone =
      getInternationalMobileFormat(info?.phonenumber, false) ||
      process.env.BRASSICA_CLIENT_PHONENUMBER;

    // ---------------- CREATE PAYMENT ----------------
    let paymentStatus = "pending";
    let providerResponse = null;

    // 1. Fetch or Lookup Meter Details BEFORE opening DB transactions
    let prepaidMeterPayload = await getMeter(meter);

    if (!prepaidMeterPayload) {
      logger.info(`[ECGLookup] meter=${meter} category=PREPAID`);
      const externalTransactionId = uuidv4();

      const lookupResponse = await brassicaPost("/billerAccountLookUp", {
        transactionId: externalTransactionId,
        accountNumber: meter,
        phoneNumber: userPhone,
        accountCategory: "PREPAID",
        billerType: "ECG",
      });

      if (
        lookupResponse?.status !== "Success" ||
        lookupResponse?.statusCode !== "200"
      ) {
        return res.status(400).json("Meter not found");
      }

      prepaidMeterPayload = {
        ...lookupResponse?.accountDetails,
        accountLookUpId: lookupResponse?.accountLookUpId,
      };

      await saveMeter(meter, prepaidMeterPayload);
    }

    const {
      accountName,
      accountReferenceId,
      serviceDistrictId,
      serviceRegionId,
      accountType,
      serviceProviderName,
      altAccountNumber,
      accountLookUpId,
    } = prepaidMeterPayload;

    // 2. Prepare Identifiers & Payload

    const paymentId = generateId();
    const transaction_id = generateId(6);
    const transaction_reference = randomBytes(24).toString("hex");
    // const orderNo = randomBytes(20).toString("hex");

    const transx = await knex.transaction();
    if (isWallet) {
      // ---- WALLET VALIDATION ----
      const wallet = await transx("wallets").where({ user_id: userID }).first();
      // .forUpdate();

      if (!wallet) {
        await transx.rollback();
        return res.status(401).json("Wallet not found");
      }

      const isPinValid = await bcrypt.compare(token, wallet.user_key);
      if (!isPinValid) {
        await transx.rollback();
        return res.status(401).json("Invalid PIN!");
      }

      if (Number(wallet.amount) < Number(amount)) {
        await transx.rollback();
        return res.status(400).json("Insufficient funds");
      }

      // ---- DEDUCT WALLET ----
      await transx("wallets")
        .where({ user_id: userID })
        .decrement("amount", amount);

      await transx("wallet_transactions").insert({
        id: generateId(),
        user_id: userID,
        wallet_id: wallet.id,
        wallet_amount: wallet.amount,
        issuer: userName,
        type: "debit",
        comment: `Prepaid purchase`,
        amount: amount,
        status: "completed",
        reference: transaction_reference,
      });

      paymentStatus = "completed";
      providerResponse = { code: "WALLET_SUCCESS" };
    } else {
      // ---- MOBILE MONEY ----
      const momoPayload = {
        institutionCode: info?.provider,
        accountNumber: userPhone,
        accountName: info?.name || userName || "GPC Customer",
        amount: Number(amount).toFixed(2),
        transaction_Id: `prepaid-${transaction_id}`,
        debitNaration: "Purchase Prepaid Units",
      };

      try {
        await sendBrassicaMoney(momoPayload);
      } catch (error) {
        return res
          .status(400)
          .json("Error processing transaction.Please try again later!");
      }

      paymentStatus = "pending";
    }

    providerResponse = {
      billRequest: {
        transactionId: transaction_id,
        billerType: "ECG",
        accountNumber: meter,
        accountCategory: accountType,
        phoneNumber: userPhone,
      },
      paymentDetails: {
        amount: amount,
        accountLookUpId,
        serviceDistrictId,
        serviceRegionId,
        serviceProviderName,
        accountName,
        accountReferenceId,
        paymentNaration: "Electricity Purchase",
        altAccountNumber,
        paymentBy: userName,
      },
    };

    // ---------------- INSERT PAYMENT ----------------

    // 3. Database Write (Keep this transaction as short as possible)

    try {
      await transx("payments").insert({
        id: paymentId,
        user_id: userID,
        reference: transaction_reference,
        service: "prepaid",
        amount,
        charges: 0,
        provider: isWallet ? "wallet" : info?.provider,
        mode: isWallet ? "Wallet" : "Mobile Money",
        year: moment().year(),
        status: paymentStatus,
        externalTransactionId: null,
        partner: JSON.stringify(providerResponse),
        is_processed: false,
      });

      await transx("electricity_transactions").insert({
        id: transaction_id,
        payment_id: paymentId,
        meter_id: meter,
        charges: 0,
        topup: amount,
        email: info?.email,
        phonenumber: info?.phonenumber,
      });

      await transx.commit();

      res.status(201).json({
        success: true,
        message: "Payment received and is being processed.",
        paymentId: paymentId,
        transactionId: transaction_id,
      });
    } catch (dbError) {
      await transx.rollback();
      logger.error("[ECGPay DB Error]:", dbError);
      return res
        .status(500)
        .json({ message: "Database initialization failed" });
    }

    // setImmediate(async () => {
    //   // 4. Execute External Network Call (Safe from DB locks)
    //   logger.info(
    //     `[ECGPay] meter=${meter} category=${accountType} amount=${amount} by=${userName}`,
    //   );

    //   try {
    //     const paymentResponse = await brassicaPost(
    //       "/billerPayment",
    //       providerResponse,
    //     );

    //     if (
    //       paymentResponse?.status !== "Success" ||
    //       paymentResponse?.statusCode !== "200"
    //     ) {
    //       await knex("payments")
    //         .update({
    //           status: "failed",
    //           is_processed: true,
    //           partner: JSON.stringify(paymentResponse),
    //         })
    //         .where("id", paymentId);

    //       return;

    //       // return res
    //       //   .status(422)
    //       //   .json({ message: "Provider transaction failed" });
    //     }

    //     // 5. Finalize Local Status on Success
    //     const responseDetails = paymentResponse?.paymentResponseDetails || {};

    //     await knex("electricity_transactions")
    //       .update({
    //         info: JSON.stringify({
    //           domain: "Prepaid",
    //           orderNo,
    //           ...responseDetails,
    //         }),
    //       })
    //       .where("id", transaction_id);

    //     await knex("payments")
    //       .update({
    //         is_processed: 1,
    //         status: "completed",
    //       })
    //       .where("id", paymentId);
    //   } catch (apiError) {
    //     logger.error("[ECGPay API Error]:", apiError);
    //     // console.log("error.is");

    //     // Update status to failed so the transaction doesn't hang in pending forever
    //     await knex("payments")
    //       .update({ status: "failed", is_processed: true })
    //       .where("id", paymentId);

    //     // return res
    //     //   .status(502)
    //     //   .json({ message: "External network gateway timeout" });
    //   }
    // });
  }),
);
// /api/gabs/v1/electricity/payment/status/GPC5AC3089C913810951

// router.post(
//   "/electricity",
//   paymentLimiter,
//   verifyOptionalToken,
//   idempotencyMiddleware,
//   paymentLockMiddleware,
//   validateECG,
//   validatePayment(prepaidSchema),
//   asyncHandler(async (req, res) => {
//     const { id: userID, name } = req.user;

//     const { meter, info, amount } = req.body;

//     // logger.info(req.body)
//     const transx = await knex.transaction();

//     try {
//       // Call the API to create a transaction
//       const externalTransactionId = uuidv4();
//       const paymentId = generateId();
//       const transaction_id = generateId(6);
//       const transaction_reference = randomBytes(24).toString("hex");
//       const orderNo = randomBytes(20).toString("hex");

//       let prepaidMeterPayload = null;
//       const meterDetails = await getMeter(meter);

//       if (meterDetails) {
//         prepaidMeterPayload = meterDetails;
//       } else {
//         logger.info(`[ECGLookup] meter=${meter} category=PREPAID`);

//         const response = await brassicaPost("/billerAccountLookUp", {
//           transactionId: externalTransactionId,
//           accountNumber: meter,
//           phoneNumber:
//             info?.phonenumber || process.env.BRASSICA_CLIENT_PHONENUMBER,
//           accountCategory: "PREPAID",
//           billerType: "ECG",
//         });

//         if (response?.status !== "Success" || response?.statusCode !== "200") {
//           return res.status(401).json("Meter not found");
//         }
//         console.log(response);
//         prepaidMeterPayload = {
//           ...response?.accountDetails,
//           accountLookUpId: response?.accountLookUpId,
//         };
//       }

//       const {
//         accountName,
//         accountReferenceId,
//         serviceDistrictId,
//         serviceRegionId,
//         accountType,
//         serviceProviderName,
//         altAccountNumber,
//         accountLookUpId,
//       } = prepaidMeterPayload;

//       // ---------------- CREATE PAYMENT ----------------
//       let paymentStatus = "pending";
//       let partnerResponse = null;

//       // ---------------- INSERT PAYMENT ----------------

//       const paymentPayload = {
//         billRequest: {
//           transactionId: externalTransactionId,
//           billerType: "ECG",
//           accountNumber: meter,
//           accountCategory: accountType,
//           phoneNumber:
//             info?.phonenumber || process.env.BRASSICA_CLIENT_PHONENUMBER,
//         },
//         paymentDetails: {
//           amount: amount,
//           accountLookUpId,
//           serviceDistrictId,
//           serviceRegionId,
//           serviceProviderName,
//           accountName,
//           accountReferenceId,
//           paymentNaration: "Electricity Purchase",
//           altAccountNumber,
//           paymentBy: name || "GPC",
//         },
//       };

//       await transx("payments").insert({
//         id: paymentId,
//         user_id: userID || "",
//         reference: transaction_reference,
//         service: "prepaid",
//         amount: amount,
//         charges: 0,
//         provider: "brasicca",
//         mode: "Mobile Money",
//         year: moment().year(),
//         status: "pending",
//         partner: JSON.stringify(paymentPayload),
//         externalTransactionId: externalTransactionId,
//       });

//       await transx("electricity_transactions").insert({
//         id: transaction_id,
//         payment_id: paymentId,
//         meter_id: meter,
//         charges: 0,
//         topup: amount,
//         email: info?.email,
//         phonenumber: info?.phonenumber,
//       });

//       await transx.commit();

//       logger.info(
//         `[ECGPay] meter=${meter} category=${accountType} amount=${amount} by=${name || "GPC"}`,
//       );

//       const paymentResponse = await brassicaPost(
//         "/billerPayment",
//         paymentPayload,
//       );

//       if (
//         paymentResponse?.status !== "Success" ||
//         paymentResponse?.statusCode !== "200"
//       ) {
//         await transx("payments").update({
//           partner,
//         });
//         return res.status(401).json("Transaction Failed!");
//       }

//       await knex("electricity_transactions")
//         .update({
//           info: JSON.stringify({
//             domain: "Prepaid",
//             orderNo,
//             ...data?.paymentResponseDetails,
//           }),
//         })
//         .where("id", transaction_id);

//       await knex("payments")
//         .update({
//           is_processed: 1,
//           status: "completed",
//         })
//         .where("id", paymentId);

//       res.status(201).json({ success: true, data });
//     } catch (error) {
//       logger.error(error);
//       await transx.rollback();
//       return res.status(500).json("Transaction Failed!");
//     }
//   }),
// );

router.post(
  "/wallet-topup",
  paymentLimiter,
  verifyToken,
  idempotencyMiddleware,
  paymentLockMiddleware,
  validatePayment(walletTopUpSchema),
  asyncHandler(async (req, res) => {
    const info = req.body;

    const trx = await knex.transaction();

    try {
      const { id: userId, name, email } = req.user;
      const { phoneNumber, mobilePartner, amount } = info;
      // console.log(info)

      // ---------------- VALIDATION ----------------

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json("Invalid amount");
      }

      // ---------------- GENERATE IDS ----------------
      const paymentId = generateId();
      // const transactionId = generateId();
      const reference = randomBytes(24).toString("hex");

      // ---------------- CREATE PAYMENT ----------------
      let paymentStatus = "pending";

      // ---- WALLET VALIDATION ----
      const wallet = await trx("wallets").where({ user_id: userId }).first();

      if (!wallet) {
        return res.status(401).json("Wallet not found");
      }

      // ---- MOBILE MONEY ----
      // const paymentPayload = {
      //   name: name || "GPC Customer",
      //   phonenumber: phoneNumber,
      //   email: email ?? "",
      //   amount: Number(amount).toFixed(2),
      //   provider: mobilePartner,
      //   transaction_reference: reference,
      // };

      // const response = await sendMoney(paymentPayload, "w");

      // paymentStatus =
      //   response?.ResponseCode === "0000"
      //     ? "completed"
      //     : response?.ResponseCode === "0001"
      //       ? "pending"
      //       : "failed";

      const userPhone =
        getInternationalMobileFormat(phoneNumber, false) ||
        process.env.BRASSICA_CLIENT_PHONENUMBER;

      const momoPayload = {
        institutionCode: mobilePartner,
        accountNumber: userPhone,
        accountName: name || "GPC Customer",
        amount: Number(amount).toFixed(2)?.toString(),
        transaction_Id: `wallet-${paymentId}`,
        debitNaration: "Top up GPC Wallet Amount",
      };

      try {
        if (isProduction) {
          await sendBrassicaMoney(momoPayload);
          paymentStatus = "pending";
        }
      } catch (error) {
        console.log(error);
        return res
          .status(400)
          .json("Error processing transaction.Please try again later!");
      }

      // ---------------- INSERT PAYMENT ----------------
      await trx("payments").insert({
        id: paymentId,
        user_id: userId,
        reference,
        service: "wallet",
        amount: amount,
        year: moment().year(),
        provider: mobilePartner,
        mode: "Mobile Money",
        externalTransactionId: null,
        partner: JSON.stringify({
          // ...response,
          phonenumber: phoneNumber,
          mobilePartner,
        }),
        status: isProduction ? paymentStatus : "completed",
      });

      await trx("wallet_transactions").insert({
        id: paymentId,
        user_id: userId,
        wallet_id: wallet.id,
        wallet_amount: wallet.amount,
        issuer: name || "GPC Customer",
        type: "credit",
        comment: `wallet top-up`,
        phonenumber: userPhone,
        amount: amount,
         status: isProduction ? paymentStatus : "completed",
        reference,
      });

      await trx.commit();

      // console.log("done")

      return res.status(200).json({
        paymentId,
        reference: reference,
        transactionId: paymentId,
        status:isProduction ? paymentStatus : "completed",
        categoryType: "wallet",
      });
    } catch (error) {
      await trx.rollback();
      logger.error("[Wallet Top Up Error]:", error);
      return res.status(500).json("Transaction failed");
    }
  }),
);

// Make Airtime Payment @route   POST payment/airtime
router.post(
  "/airtime",
  paymentLimiter,
  verifyToken,
  idempotencyMiddleware,
  paymentLockMiddleware,
  validatePayment(airtimeSchema),
  asyncHandler(async (req, res) => {
    const { id: userId, name } = req.user;

    if (_.isEmpty(req.body)) {
      return res.status(401).json("Error Processing your request!");
    }

    const {
      type,
      service,
      amount,
      recipient,
      phonenumber,
      provider,
      pricing,
      email,
      isWallet,
      token,
    } = req.body;

    const trx = await knex.transaction();
    try {
      const response = await accountBalance();
      const balance = Number(response?.balance);

      if (Number(response?.balance) < Number(amount)) {
        if (balance < 1000) {
          await notifyLowBalance(balance);
        }
        return res.status(401).json("Service not available.Try again later!");
      }

      if (!type || !["Airtime", "Bulk"].includes(type)) {
        return res.status(401).json("Invalid Request");
      }

      // ---------------- GENERATE IDS ----------------
      const paymentId = generateId();
      const transactionId = generateId();
      const reference = randomBytes(24).toString("hex");
      const orderNo = randomBytes(20).toString("hex");

      // ---------------- CREATE PAYMENT ----------------
      let paymentStatus = "pending";
      let partnerResponse = null;

      if (isWallet) {
        // ---- WALLET VALIDATION ----
        const wallet = await trx("wallets").where({ user_id: userId }).first();
        // .forUpdate();

        if (!wallet) {
          await trx.rollback(); // Releases the lock on failure
          return res.status(401).json("Wallet not found");
        }

        const isPinValid = await bcrypt.compare(token, wallet.user_key);
        if (!isPinValid) {
          await trx.rollback(); // Releases the lock on failure
          return res.status(401).json("Invalid PIN!");
        }

        if (Number(wallet.amount) < Number(amount)) {
          await trx.rollback(); // Releases the lock on failure
          return res.status(400).json("Insufficient funds");
        }

        // ---- DEDUCT WALLET ----
        await trx("wallets")
          .where({ user_id: userId })
          .decrement("amount", amount);

        await trx("wallet_transactions").insert({
          id: generateId(),
          user_id: userId,
          wallet_id: wallet.id,
          wallet_amount: wallet.amount,
          issuer: userId || "GPC Customer",
          type: "debit",
          comment: "Airtime purchase ",
          attachment: null,
          amount: amount,
          status: "completed",
          reference,
        });
        paymentStatus = "completed";
        partnerResponse = {
          Data: { code: "WALLET_SUCCESS", phonenumber, email },
        };
      } else {
        const payment = {
          name: name || "GPC Customer",
          email: email,
          phonenumber,
          amount: Number(amount).toFixed(2),
          provider,
          transaction_reference: reference,
        };

        partnerResponse = await sendMoney(payment, "a");

        // Save the Transaction to DB and Send Email

        paymentStatus =
          partnerResponse?.ResponseCode === "0000"
            ? "completed"
            : partnerResponse?.ResponseCode === "0001"
              ? "pending"
              : "failed";
      }

      // ---------------- INSERT PAYMENT ----------------
      await trx("payments").insert({
        id: paymentId,
        user_id: userId,
        reference: reference,
        service,
        amount: amount,
        provider: provider,
        mode: isWallet ? "Wallet" : "Mobile Money",
        year: moment().year(),
        status: paymentStatus,
        externalTransactionId: null,
        partner: JSON.stringify(partnerResponse.Data),
      });

      const transaction = await trx("airtime_transactions").insert({
        id: transactionId,
        payment_id: paymentId,
        order_id: orderNo,
        airtime_type: type === "Airtime" ? "single" : "bulk",
        recipient: recipient || JSON.stringify(pricing),
        domain: service,
        info: JSON.stringify({
          phonenumber,
          amount,
          pricing: pricing ?? [],
          domain: service,
        }),

        email: email,
        phonenumber: phonenumber,
        partner: JSON.stringify(partnerResponse.Data),
      });

      // //if creating new transaction fails
      if (_.isEmpty(transaction)) {
        await trx.rollback();
        return res.status(404).json("Error Processing your request!");
      }

      await trx.commit();
      const completedTransaction = {
        paymentId,
        transactionId,
        reference,
        status: paymentStatus,
        categoryType: service,
      };

      res.status(200).json(completedTransaction);

      // console.log(transaction);
      if (isWallet && !_.isEmpty(transaction)) {
        setImmediate(async () => {
          if (completedTransaction?.status === "completed") {
            await emitPaymentSuccess({
              userId: userId,
              txRef: phonenumber || reference,
              amount: amount,
              transaction: {
                id: transactionId || paymentId,
                paymentReference: reference,
                status: paymentStatus,
                email,
                phonenumber,
                paymentMode: "Wallet",
                amount: amount,
                createdAt: new Date().toISOString(),
              },
            });
          } else {
            await emitPaymentFailure({
              userId,
              txRef: user.phonenumber || reference,
              reason: "Payment failed",
            });
          }
        });
      }
    } catch (error) {
      await trx.rollback();
      logger.error(error);
      return res.status(500).json("Transaction Failed!");
    }
  }),
);

// Make Bundle Payment @route   POST payment/bundle
router.post(
  "/bundle",
  paymentLimiter,
  verifyToken,
  idempotencyMiddleware,
  paymentLockMiddleware,
  validatePayment(bundleSchema),
  asyncHandler(async (req, res) => {
    const { id: userId, name } = req.user;

    if (_.isEmpty(req.body)) {
      return res.status(401).json("Error Processing your request!");
    }

    const {
      type,
      service,
      amount,
      recipient,
      phonenumber,
      email,
      provider,
      plan,
      isWallet,
      token,
    } = req.body;

    const trx = await knex.transaction();

    try {
      const response = await accountBalance();
      const balance = Number(response?.balance);

      if (Number(response?.balance) < Number(amount)) {
        if (balance < 1000) {
          await notifyLowBalance(balance);
        }
        return res.status(401).json("Service not available.Try again later!");
      }

      if (!type || type !== "Bundle") {
        return res.status(401).json("Invalid Request");
      }

      // ---------------- GENERATE IDS ----------------
      const paymentId = generateId();
      const transactionId = generateId();
      const reference = randomBytes(24).toString("hex");

      if (isWallet) {
        // ---- WALLET VALIDATION ----
        const wallet = await trx("wallets")
          .where({ user_id: userId })
          .first()
          .forUpdate();

        if (!wallet) {
          await trx.rollback();
          return res.status(401).json("Wallet not found");
        }

        const isPinValid = await bcrypt.compare(token, wallet.user_key);
        if (!isPinValid) {
          await trx.rollback();
          return res.status(401).json("Invalid PIN!");
        }

        if (Number(wallet.amount) < Number(amount)) {
          await trx.rollback();
          return res.status(400).json("Insufficient funds");
        }

        // ---- DEDUCT WALLET ----
        await trx("wallets")
          .where({ user_id: userId })
          .decrement("amount", amount);

        await trx("wallet_transactions").insert({
          id: generateId(),
          user_id: userId,
          wallet_id: wallet.id,
          wallet_amount: wallet.amount,
          issuer: userId || "GPC Customer",
          type: "debit",
          comment: "Data Bundle purchase",
          attachment: null,
          amount: amount,
          status: "completed",
          reference,
        });

        paymentStatus = "completed";
        partnerResponse = {
          Data: { code: "WALLET_SUCCESS", phonenumber, email },
        };
      } else {
        const payment = {
          name: name || "GPC Customer",
          email: email,
          phonenumber,
          amount: Number(amount).toFixed(2),
          provider,
          transaction_reference: reference,
        };

        partnerResponse = await sendMoney(payment, "b");

        // Save the Transaction to DB and Send Email

        paymentStatus =
          partnerResponse?.ResponseCode === "0000"
            ? "completed"
            : partnerResponse?.ResponseCode === "0001"
              ? "pending"
              : "failed";
      }

      // ---------------- INSERT PAYMENT ----------------
      await trx("payments").insert({
        id: paymentId,
        user_id: userId,
        reference: reference,
        service,
        amount: amount,
        provider: provider,
        mode: isWallet ? "Wallet" : "Mobile Money",
        year: moment().year(),
        status: paymentStatus,
        externalTransactionId: null,
        partner: JSON.stringify(partnerResponse.Data),
      });

      const transaction = await trx("bundle_transactions").insert({
        id: transactionId,
        payment_id: paymentId,
        recipient: recipient,
        email: email,
        phonenumber: phonenumber,
        domain: service,
        bundle_id: plan?.id,
        bundle_name: plan?.name,
        bundle_volume: plan?.volume,
        info: JSON.stringify({
          phonenumber,
          amount,
          plan,
        }),
      });

      // //if creating new transaction fails
      if (_.isEmpty(transaction)) {
        await trx.rollback();
        return res.status(404).json("Error Processing your request!");
      }

      await trx.commit();

      const completedTransaction = {
        paymentId,
        transactionId,
        reference,
        status: paymentStatus,
        categoryType: service,
      };

      res.status(200).json(completedTransaction);

      if (isWallet && !_.isEmpty(transaction)) {
        setImmediate(async () => {
          if (completedTransaction?.status === "completed") {
            await emitPaymentSuccess({
              userId: userId,
              txRef: phonenumber || reference,
              amount: amount,
              transaction: {
                id: transactionId || paymentId,
                paymentReference: reference,
                status: paymentStatus,
                email,
                phonenumber,
                paymentMode: "Wallet",
                amount: amount,
                createdAt: new Date().toISOString(),
              },
            });
          } else {
            await emitPaymentFailure({
              userId,
              txRef: user.phonenumber || reference,
              reason: "Payment failed",
            });
          }
        });
      }
    } catch (error) {
      await trx.rollback();
      logger.error(error);
      return res.status(500).json("Transaction Failed!");
    }
  }),
);

//Check Transaction Status
router.post(
  "/top-up/status",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const reference_id = req.body?.id;

    try {
      const response = await topUpStatus(reference_id);

      res.status(200).json(response);
    } catch (error) {
      res.status(401).json(error?.response?.data);
    }
  }),
);

//Send bundle to recipient
router.post(
  "/top-up/bundle",
  verifyToken,
  verifyAdmin,
  validate(bundleTopUpSchema),
  asyncHandler(async (req, res) => {
    const info = req.body;

    try {
      const response = await sendBundle(info);

      res.status(200).json(response);
    } catch (error) {
      res.status(401).json("An unknown error has occurred");
    }
  }),
);

//Send airtime to recipient
router.post(
  "/top-up/airtime",
  verifyToken,
  verifyAdmin,
  validate(airtimeTopUpSchema),
  asyncHandler(async (req, res) => {
    const info = req.body;

    try {
      const response = await sendAirtime(info);

      res.status(200).json(response);
    } catch (error) {
      res.status(401).json("An unknown error has occurred");
    }
  }),
);

router.post(
  "/resend",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id: transactionId } = req.body;

    const transaction = await knex("vw_payments_voucher_transactions")
      .select("*")
      .where("id", transactionId)
      .limit(1)
      .first();

    if (_.isEmpty(transaction)) {
      return res.status(402).json("Transaction not found!");
    }

    const { id, info } = transaction;

    const userInfo = safeJSON(info);

    let selectedVouchers = [];

    //Check if tickets are Stadium tickets or cinema

    if (["stadium", "cinema"].includes(userInfo?.type)) {
      const vouchers = await Promise.all(
        userInfo?.paymentDetails.tickets.flatMap(async (ticket) => {
          return await knex("vouchers")
            .join("categories", "vouchers.category_id", "=", "categories.id")
            .where({
              "vouchers.category_id": userInfo?.categoryId,
              "vouchers.type": ticket?.type,
              // "vouchers.status": "sold",
              "vouchers.active": 1,
            })
            .select(
              "vouchers.id",
              "vouchers.serial",
              "vouchers.pin",
              "vouchers.type",
              "categories.details as details",
              "categories.name as voucherType",
            )
            .limit(ticket?.quantity);
        }),
      );

      selectedVouchers = _.flatMap(vouchers);
    }
    //Check if tickets are bus
    else if (["bus"].includes(userInfo?.type)) {
      selectedVouchers = await knex("vouchers")
        .join("categories", "vouchers.category_id", "=", "categories.id")
        .whereIn("vouchers.type", userInfo?.paymentDetails?.tickets)
        .andWhere({
          "vouchers.category_id": userInfo?.categoryId,
          // "vouchers.status": "new",
          "vouchers.active": 1,
        })
        .select(
          "vouchers.id",
          "vouchers.serial",
          "vouchers.pin",
          "vouchers.type",
          "categories.details as details",
          "categories.name as voucherType",
        );
    }
    //Check if vouchers are waec,university or security
    else {
      selectedVouchers = await knex("vouchers")
        .join("categories", "vouchers.category_id", "=", "categories.id")
        .where({
          "vouchers.category_id": userInfo?.categoryId,
          // "vouchers.status": "new",
          "vouchers.active": 1,
        })
        .select(
          "vouchers.id",
          "vouchers.serial",
          "vouchers.pin",
          "vouchers.type",
          "categories.name as voucherType",
          "categories.details as details",
        )
        .limit(userInfo?.quantity);
    }

    try {
      if (["waec", "security", "university"].includes(userInfo?.type)) {
        const detailsInfo = safeJSON(selectedVouchers[0]?.details ?? {});

        const smsInfo = selectedVouchers.map((voucher) => {
          return `[${voucher?.pin}--${voucher?.serial}]`;
        });
        const smsData = await Promise.all([smsInfo]);

        await sendSMS(
          `${selectedVouchers[0]?.voucherType}  ${detailsInfo?.voucherURL}   
[Pin--Serial]
${smsData.join(" ")},download voucher here: ${userInfo?.downloadLink}`,
          transaction?.phonenumber || "",
        );
      }

      if (["bus", "cinema", "stadium"].includes(userInfo?.type)) {
        const d = _.isEmpty(selectedVouchers)
          ? "{}"
          : selectedVouchers[0]?.details;

        const detailsInfo = JSON.parse(_.isUndefined(d) ? {} : d);

        const smsInfo = selectedVouchers.map((voucher) => {
          return `[${voucher?.type}--${voucher?.serial || voucher?.pin}]`;
        });
        const smsData = await Promise.all([smsInfo]);

        await sendSMS(
          `${selectedVouchers[0]?.voucherType}   
[Seat No./Type--Serial]
${smsData.join(" ")},  

${formatDate(detailsInfo?.date)},${formatTime(detailsInfo?.time)},  
${transaction?.email || ""},${
            transaction?.phonenumber || ""
          }.Please visit https://www.gpcpins.com/evoucher to print your tickets.,download voucher here: ${
            userInfo?.downloadLink
          }
`,
          transaction?.phonenumber || "",
        );
      }
      res.sendStatus(200);

      if (transaction?.email) {
        setImmediate(async () => {
          await sendTicketMail(id, transaction?.email, "GPC Tickets");
        });
      }
    } catch (error) {
      logger.error(error);
      return res
        .status(500)
        .json("Error Processing your request! Please try again later.");
    }
  }),
);

//@ Payment callback
router.post(
  "/re-confirm",
  rlimit,
  asyncHandler(async (req, res) => {
    const { type, paymentReference } = req.body;

    const payload = await moneyStatus(paymentReference);

    const reference = payload?.data?.clientReference;
    if (!reference || paymentReference !== reference)
      return res.sendStatus(204);

    const doneKey = `payment:processed:${reference}`;
    const lockKey = `payment:lock:${reference}`;

    // 1. Already processed?
    if (await redisClient.get(doneKey)) {
      return res.sendStatus(200);
    }

    // 2. Acquire lock
    const lock = await redisClient.set(lockKey, "1", "NX", "EX", 60);
    if (!lock) return res.sendStatus(200);

    let trx;

    try {
      const statusMap = {
        "0000": "completed",
        "0001": "pending",
      };

      if (newStatus === "pending") {
        return res.sendStatus(204);
      }

      const newStatus = statusMap[payload.responseCode] || "failed";

      const table = PAYMENT_TABLE_MAP[type];
      if (!table) return res.sendStatus(204);

      trx = await knex.transaction();

      const payment = await trx(table)
        .where({ paymentReference: reference })
        .first();

      if (!payment) {
        await trx.rollback();
        return res.sendStatus(204);
      }

      // idempotency DB guard
      if (payment.status === "completed") {
        await trx.commit();
        return res.sendStatus(200);
      }

      await trx("payments")
        .where({ id: payment.paymentId })
        .andWhereNot({ status: "completed" })
        .update({
          status: newStatus,
          externalTransactionId: payload?.data?.externalTransactionId,
          updated_at: knex.fn.now(),
        });

      await trx.commit();

      // mark processed
      await redisClient.set(doneKey, "1", "EX", 86400);
      await redisClient.del(lockKey);

      res.sendStatus(200);

      // async events
      queueMicrotask(() =>
        handlePostPaymentEvents(payment, newStatus, payload),
      );
    } catch (err) {
      if (trx) await trx.rollback();
      await redisClient.del(lockKey);
      logger.error(err);
      // console.error(err);
      res.sendStatus(500);
    }
  }),
);

//@ Payment callback brassica
router.post(
  "/callback",
  // cors(corsOptions),
  rlimit,
  asyncHandler(async (req, res) => {
    const payload = req.body;
    // console.log(payload)

    if (!payload?.transactionId) return res.sendStatus(204);

    const doneKey = `payment:processed:${payload?.transactionId}`;
    const lockKey = `payment:lock:${payload?.transactionId}`;

    // 1. Already processed?
    if (await redisClient.get(doneKey)) {
      return res.sendStatus(200);
    }

    // 2. Acquire lock
    const lock = await redisClient.set(lockKey, "1", "NX", "EX", 60);
    if (!lock) return res.sendStatus(200);

    // Acknowledge immediately — Brassica expects this JSON back
    res.status(200).json({
      status: "OK",
      message: "Received successfully.",
    });

    // ── Process asynchronously (after ack) ────────────────────────────────────
    setImmediate(async () => {
      let trx;

      try {
        const {
          statusCode,
          status,
          transactionId,
          extralTransactionId,
          institutionApprovalCode,
        } = payload;

        logger.info(
          `[Webhook] txId=${transactionId} brassicaTxId=${extralTransactionId} ` +
            `status=${status}(${statusCode}) approvalCode=${institutionApprovalCode}`,
        );

        trx = await knex.transaction();

        const [service, transaction_id] = transactionId?.split("-");

        let payment;
        if (service === "prepaid") {
          payment = await trx("vw_meter_payment_prepaid_transaction_view")
            .where({ id: transaction_id })
            .first();
        }
        if (service === "wallet") {
          payment = await trx("vw_payments_wallet_transactions")
            .where({ paymentId: transaction_id })
            .first();
        }

        if (!payment) {
          throw new Error("Transaction does not exist!");
        }

        // idempotency DB guard
        if (payment.status === "completed") {
          throw new Error("Transaction already completed!");
          // return res.sendStatus(200);
        }

        const newStatus =
          status === "SUCCESSFUL" && statusCode === "200"
            ? "completed"
            : (status === "ACCEPTED" && statusCode === "202") ||
                (status === "PENDING" && statusCode === "491")
              ? "pending"
              : "failed";

        await trx("payments")
          .where({ id: payment?.paymentId })
          .andWhereNot({ status: "completed" })
          .update({
            status: newStatus,
            externalTransactionId: extralTransactionId,
            updated_at: knex.fn.now(),
          });

        await trx.commit();

        // mark processed
        await redisClient.set(doneKey, "1", "EX", 86400);
        await redisClient.del(lockKey);

        if (status === "SUCCESSFUL" || statusCode === "200") {
          // Handle success
          logger.info(`[Webhook] Transaction ${transactionId} SUCCEEDED.`);
        }

        // async events
        queueMicrotask(() =>
          handlePostPaymentEvents(payment, newStatus, payload),
        );

        // if (status === "SUCCESSFUL" || statusCode === "200") {
        //   // Handle success
        //   logger.info(`[Webhook] Transaction ${transactionId} SUCCEEDED.`);
        // } else if (
        //   status === "FAILED" ||
        //   ["424", "412", "300"].includes(String(statusCode))
        // ) {
        //   // Handle failure — do NOT retry 424; it is terminal
        //   logger.warn(
        //     `[Webhook] Transaction ${transactionId} FAILED (code=${statusCode}).`,
        //   );
        // } else {
        //   logger.info(
        //     `[Webhook] Transaction ${transactionId} status=${status} — no action taken.`,
        //   );
        // }
      } catch (err) {
        if (trx) await trx.rollback();
        await redisClient.del(lockKey);
        // logger.error(err);
        console.error(err);
        logger.error("[Webhook] Error processing callback payload:", err);
        res.sendStatus(500);
      }
    });
  }),
);

// //@ Payment callback
// router.post(
//   "/callback/e",
//   cors(corsOptions),
//   rlimit,
//   asyncHandler(async (req, res) => {
//     const { type } = req.params;
//     const payload = req.body;

//     const reference = payload?.transactionId;
//     if (!reference) return res.sendStatus(400);

//     const doneKey = `payment:processed:${reference}`;
//     const lockKey = `payment:lock:${reference}`;

//     // 1. Already processed?
//     if (await redisClient.get(doneKey)) {
//       return res.sendStatus(200);
//     }

//     // 2. Acquire lock
//     const lock = await redisClient.set(lockKey, "1", "NX", "EX", 60);
//     if (!lock) return res.sendStatus(200);

//     let trx;

//     try {
//       const statusMap = {
//         200: "completed",
//         202: "pending",
//       };

//       const newStatus = statusMap[payload.status] || "failed";

//       const table = PAYMENT_TABLE_MAP["w"];
//       if (!table) return res.sendStatus(204);

//       trx = await knex.transaction();

//       const payment = await trx(table)
//         .where({ paymentReference: reference })
//         .first();

//       if (!payment) {
//         await trx.rollback();
//         return res.sendStatus(204);
//       }

//       // idempotency DB guard
//       if (payment.status === "completed") {
//         await trx.commit();
//         return res.sendStatus(200);
//       }

//       await trx("payments")
//         .where({ id: payment.paymentId })
//         .andWhereNot({ status: "completed" })
//         .update({
//           status: newStatus,
//           externalTransactionId: payload?.Data?.ExternalTransactionId,
//           updated_at: knex.fn.now(),
//         });

//       await trx.commit();

//       // mark processed
//       await redisClient.set(doneKey, "1", "EX", 86400);
//       await redisClient.del(lockKey);

//       res.sendStatus(200);

//       // async events
//       queueMicrotask(() =>
//         handlePostPaymentEvents(payment, newStatus, payload),
//       );
//     } catch (err) {
//       if (trx) await trx.rollback();
//       await redisClient.del(lockKey);
//       logger.error(err);
//       res.sendStatus(500);
//     }
//   }),
// );

//@ Payment callback
router.post(
  "/feedback/callback/:type/:id",
  cors(corsOptions),
  rlimit,
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const payload = req.body;

    const reference = payload?.Data?.ClientReference;
    if (!reference || !type) return res.sendStatus(204);

    const doneKey = `payment:processed:${reference}`;
    const lockKey = `payment:lock:${reference}`;

    // 1. Already processed?
    if (await redisClient.get(doneKey)) {
      return res.sendStatus(200);
    }

    // 2. Acquire lock
    const lock = await redisClient.set(lockKey, "1", "NX", "EX", 60);
    if (!lock) return res.sendStatus(200);

    let trx;

    try {
      const statusMap = {
        "0000": "completed",
        "0001": "pending",
      };

      const newStatus = statusMap[payload.ResponseCode] || "failed";

      const table = PAYMENT_TABLE_MAP[type];
      if (!table) return res.sendStatus(204);

      trx = await knex.transaction();

      const payment = await trx(table)
        .where({ paymentReference: reference })
        .first();

      if (!payment) {
        await trx.rollback();
        return res.sendStatus(204);
      }

      // idempotency DB guard
      if (payment.status === "completed") {
        await trx.commit();
        return res.sendStatus(200);
      }

      res.sendStatus(200);

      await trx("payments")
        .where({ id: payment.paymentId })
        .andWhereNot({ status: "completed" })
        .update({
          status: newStatus,
          externalTransactionId: payload?.Data?.ExternalTransactionId,
          updated_at: knex.fn.now(),
        });

      await trx.commit();

      // mark processed
      await redisClient.set(doneKey, "1", "EX", 86400);
      await redisClient.del(lockKey);

      // async events
      queueMicrotask(() =>
        handlePostPaymentEvents(payment, newStatus, payload),
      );
    } catch (err) {
      if (trx) await trx.rollback();
      await redisClient.del(lockKey);
      logger.error(err);
      console.error(err);
      res.sendStatus(500);
    }
  }),
);

/**.................Airtime....................... */

//Proccess bulk airtime
router.put(
  "/airtime",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: userId, name } = req.user;
    const { id, status } = req.body;

    // console.log(req.body);

    if (_.isEmpty(id) || !isValidUUID2(id)) {
      return res.status(401).json("Error Processing your request!");
    }

    const transaction = await knex("airtime_transactions")
      .select("id", "payment_id", "phonenumber")
      .where("payment_id", id)
      .first();

    if (_.isEmpty(transaction)) {
      return res.status(401).json("Error Processing your request!");
    }

    await knex("payments").where("id", id).update({
      is_processed: 1,
      status: status,
      issuer_id: userId,
      issuer_name: name,
    });

    //logs
    await knex("activity_logs").insert({
      user_id: userId,
      title: "Processed bulk airtime transaction!",
      severity: "info",
    });

    res.status(200).json("Transaction Completed!");

    setImmediate(async () => {
      await sendSMS(
        `Your request to buy bulk package has been completed.Thank you for purchasing from us.Trans.ID: ${transaction?.id}`,
        transaction?.phonenumber,
      );
    });

    // const recipient = JSON.parse(transaction[0].recipient);

    // const list = recipient.map(async (item) => {
    //   const transaction_reference = randomBytes(24).toString("hex");
    //   const info = {
    //     recipient: item?.recipient,
    //     amount: item?.price,
    //     network:
    //       item?.type === "MTN"
    //         ? 4
    //         : item?.type === "Vodafone"
    //           ? 6
    //           : item?.type === "AirtelTigo"
    //             ? 1
    //             : 0,
    //     transaction_reference,
    //   };

    //   return sendAirtime(info);
    // });

    //     Promise.all(list)
    //       .then(async (data) => {
    //         await knex("airtime_transactions").where("id", id).update({
    //           is_processed: 1,
    //           issuer: name
    //         });

    //         await knex("user_notifications").insert({
    //           id: generateId(),
    //           user_id: userID,
    //           type: "airtime",
    //           title: "Airtime Transfer",
    //           message: `You have successfully recharged ${airtimeInfo.recipient} with GHS ${airtimeInfo.amount} of airtime, you were charged GHS ${airtimeInfo.amount}`,
    //         });

    //         if (process.env.NODE_ENV === 'production') {

    //           const balance = await accountBalance();
    //           if (Number(balance) < 1000) {
    //             const body = `
    // Your one-4-all top up account balance is running low.Your remaining balance is GHS ${balance}.
    // Please recharge to avoid any inconveniences.
    // Thank you.
    //           `;
    //             await sendEMail(
    //               process.env.MAIL_CLIENT_USER,
    //               mailTextShell(`<p>${body}</p>`),
    //               "LOW TOP UP ACCOUNT BALANCE"
    //             );
    //           }

    //         }
    //       })
    //       .catch((error) => {
    //         return res.status(500).json("Transaction Failed!");
    //       });
  }),
);

module.exports = router;

const selectVouchers = async ({
  trx,
  category,
  categoryId,
  quantity,
  paymentDetails,
}) => {
  if (["stadium", "cinema"].includes(category)) {
    const vouchers = await Promise.all(
      paymentDetails.tickets.map(
        (ticket) =>
          trx("vouchers")
            .where({
              category_id: categoryId,
              type: ticket.type,
              status: "new",
              active: 1,
            })
            .limit(ticket.quantity)
            .select("id"),
        // .forUpdate(),
      ),
    );

    return vouchers.flat();
  }

  if (category === "bus") {
    return trx("vouchers")
      .whereIn("type", paymentDetails.tickets)
      .andWhere({
        category_id: categoryId,
        status: "new",
        active: 1,
      })
      .select("id");
    // .forUpdate();
  }

  return trx("vouchers")
    .where({
      category_id: categoryId,
      status: "new",
      active: 1,
    })
    .limit(quantity)
    .select("id");
  // .forUpdate();
};

const selectVouchersForConfirmation = async (trx, transaction) => {
  const info = safeJSON(transaction?.info);
  const vouchers = safeJSON(transaction?.vouchers);

  if (!info || !info.categoryId) {
    throw new Error("Invalid transaction info");
  }

  const {
    categoryId,
    quantity,
    categoryType, // stadium | cinema | bus | others
    paymentDetails,
  } = info;

  let selected = [];

  // ---------------- STADIUM / CINEMA ----------------

  if (["stadium", "cinema"].includes(categoryType)) {
    const results = await Promise.all(
      paymentDetails?.tickets.map(async (ticket) => {
        return trx("vouchers as v")
          .join("categories as c", "v.category_id", "c.id")
          .whereIn("v.id", vouchers)
          .andWhere({
            "v.category_id": categoryId,
            "v.type": ticket.type,
            "v.status": "sold", // 🔥 IMPORTANT (not "new")
            // "v.active": 1,
          })
          .limit(ticket.quantity)
          .select(
            "v.id",
            "v.serial",
            "v.pin",
            "v.type",
            "c.name as voucherType",
            "c.details",
          )
          .forUpdate(); // 🔒 LOCK ROWS
      }),
    );

    selected = results.flat();
  }

  // ---------------- BUS ----------------
  else if (categoryType === "bus") {
    selected = await trx("vouchers as v")
      .join("categories as c", "v.category_id", "c.id")
      .whereIn("v.type", paymentDetails?.tickets || [])
      .whereIn("v.id", vouchers)
      .andWhere({
        "v.category_id": categoryId,
        "v.status": "sold",
        // "v.active": 1,
      })
      .select(
        "v.id",
        "v.serial",
        "v.pin",
        "v.type",
        "c.name as voucherType",
        "c.details",
      )
      .forUpdate();
  }

  // ---------------- DEFAULT (WAEC, etc.) ----------------
  else {
    selected = await trx("vouchers as v")
      .join("categories as c", "v.category_id", "c.id")
      .whereIn("v.id", vouchers)
      .andWhere({
        "v.category_id": categoryId,
        "v.status": "sold",
        // "v.active": 1,
      })
      .limit(quantity)
      .select(
        "v.id",
        "v.serial",
        "v.pin",
        "v.type",
        "c.name as voucherType",
        "c.details",
      )
      .forUpdate();
  }

  // ---------------- VALIDATION ----------------
  if (selected?.length <= 0) {
    throw new Error("No vouchers available");
  }

  // Optional strict validation (recommended)
  if (categoryType !== "bus" && selected.length < Number(quantity)) {
    throw new Error("Insufficient vouchers");
  }

  return selected;
};

async function processVoucher(trx, transaction) {
  const vouchers = await selectVouchersForConfirmation(trx, transaction);

  if (vouchers.length <= 0) {
    throw new Error("No vouchers available");
  }

  const ids = vouchers.map((v) => v.id);

  // await trx("voucher_transactions")
  //   .where({ id: transaction.id })
  //   .update({
  //     vouchers: JSON.stringify(ids),
  //   });

  await trx("vouchers").whereIn("id", ids).update({
    status: "sold",
    active: 0,
  });

  return vouchers;
}

async function markProcessed(trx, transaction) {
  if (Boolean(transaction?.isProcessed)) return;

  if (transaction.type === "single") {
    const airtimeInfo = {
      recipient: transaction?.recipient,
      amount: transaction?.amount,
      network: transaction?.network ? NETWORK_MAP[transaction?.network] : 0,
      transaction_reference: transaction.paymentReference,
    };
    try {
      const response = await sendAirtime(airtimeInfo);

      if (SUCCESS_CODES.includes(response["status-code"])) {
        await trx("payments")
          .where({ id: transaction.paymentId })
          .update({ is_processed: 1 });

        if (transaction.type === "single") {
          await trx("notifications").insert({
            id: generateId(),
            user_id: transaction.userId,
            type: "airtime",
            title: "Airtime Transfer",
            body: `You have successfully recharged ${transaction.recipient} with GHS ${transaction.amount} of airtime, you were charged GHS ${transaction.amount}.Transaction ID :${transaction?.id},`,
          });
        }

        const balance = Number(response?.balance_after);
        if (balance < 1000) {
          await notifyLowBalance(balance);
        }
      }
    } catch (error) {
      await trx.rollback();

      logger.error(error);
      throw new Error("An error has occurred");
    }
  }

  if (transaction.type === "bulk") {
    await trx("notifications").insert({
      id: generateId(),
      user_id: transaction.userId,
      type: "airtime",
      title: "Bulk Airtime Transfer",
      body: `Your request to buy bulk ${transaction.service} has been received.Your transaction id is ${transaction?.id}.Thank you for your business with us!`,
      // link: "/notifications",
    });
  }
}

async function processBundle(trx, transaction) {
  if (Boolean(transaction?.isProcessed)) return;

  if (transaction?.status === "completed") {
    const bundleInfo = {
      recipient: transaction?.recipient,
      data_code: transaction?.bundleId,
      network: transaction?.network ? NETWORK_MAP[transaction?.network] : 0,
      transaction_reference: transaction.paymentReference,
    };

    try {
      const response = await sendBundle(bundleInfo);

      if (SUCCESS_CODES.includes(response["status-code"])) {
        await trx("payments")
          .where({ id: transaction.paymentId })
          .update({ is_processed: 1 });

        await trx("notifications").insert({
          id: generateId(),
          user_id: transaction.userId,
          type: "bundle",
          title: "Data Bundle Transfer",
          body: `You have successfully recharged ${transaction.recipient} with data bundle, "${transaction.bundleId}","${transaction.volume}", you were charged GHS ${transaction?.amount} .Transaction ID :${transaction?.id}`,
        });

        const balance = Number(response?.balance_after);
        if (balance < 1000) {
          await notifyLowBalance(balance);
        }
      }
    } catch (error) {
      await transx.rollback();

      logger.error(error);
      throw new Error("An error has occurred");
    }
  }
}
async function processPrepaid(trx, transaction, info) {
  if (transaction?.userId) {
    await trx("notifications").insert({
      id: generateId(),
      user_id: transaction?.userId,
      type: "prepaid",
      title: "Prepaid Units",
      body: `Payment made for prepaid meter: ${transaction.number} is being processed. Transaction ID: ${transaction.id}`,
      info: JSON.stringify({ info }),
    });
  }
}
async function processWalletTopUp(trx, transaction) {
  await trx("wallets")
    .where({ id: transaction.walletId, user_id: transaction.userId })
    .increment("amount", transaction.amount);

  await trx("payments")
    .update({
      is_processed: true,
    })
    .where({
      id: transaction.paymentId,
    });

  await trx("wallet_transactions")
    .update({
      status: transaction.status,
    })
    .where({
      id: transaction.paymentId,
    });

  if (transaction.userId) {
    await trx("notifications").insert({
      id: generateId(),
      user_id: transaction.userId,
      type: "wallet",
      title: "Wallet Transaction",
      body: `Your wallet top-up of ${currencyFormatter(transaction.amount)} has been processed. Transaction ID: ${transaction.walletTransactionId}`,
    });
  }
}

function triggerAsyncProcessing(transaction, selectedVouchers) {
  setImmediate(async () => {
    try {
      switch (transaction.service) {
        case "bundle":
          await sendBundleLogic(transaction);
          break;

        case "airtime":
          await sendAirtimeLogic(transaction);
          break;

        case "voucher":
        case "ticket":
          await sendVoucherSMS(
            selectedVouchers,
            transaction,
            transaction.service,
          );
          break;

        case "prepaid":
          await sendElectricityMessage(transaction, transaction.service);
          break;

        case "wallet":
          await sendWalletTopUpMessage(transaction);
          break;
      }
    } catch (err) {
      logger.error("Async processing failed:", err);
    }
  });
}

async function sendBundleLogic(transaction) {
  const bundle = await knex("payments")
    .select("is_processed")
    .where("id", transaction.paymentId)
    .first();
  if (Boolean(bundle.is_processed) === true) {
    // const message = `You have successfully recharged ${transaction.recipient} with data bundle, ${transaction.bundleId},${transaction.volume}, you were charged GHS ${transaction?.amount} .Trans.ID-${transaction?.id}`;
    const message = `Success! ${transaction.recipient} updated with package ${transaction.bundleId} (${transaction.volume}). Total cost: GHS ${transaction?.amount}. Ref: ${transaction?.id}`;

    await sendEMail(
      transaction.email,
      mailTextShell(`<p>${message}</p>`),
      "DATA BUNDLE TRANSFER SUCCESSFUL",
    );

    await sendSMS(
      message,
      getInternationalMobileFormat(transaction?.phonenumber, false),
    );
    // await Promise.all([SMSPrompt, emailPrompt]);
  }
}

async function sendAirtimeLogic(transaction) {
  if (transaction.status === "completed") {
    if (transaction.type === "single") {
      const airtime = await knex("payments")
        .select("is_processed")
        .where("id", transaction.paymentId)
        .first();

      if (Boolean(airtime.is_processed) === true) {
        // const message = `Success! You have sent GHS ${transaction.amount} of airtime to ${transaction.recipient}. Fee charged: ${transaction.amount}. Trans. ID: ${transaction?.id}.`;
        const message = `Success! Top-up of GHS ${transaction.amount} completed for ${transaction.recipient}. Cost: GHS ${transaction.amount}. Ref: ${transaction?.id}.`;

        await sendEMail(
          transaction.email,
          mailTextShell(`<p>${message}</p>`),
          "AIRTIME TRANSFER SUCCESSFUL",
        );

        await sendSMS(message, transaction?.phonenumber);
      }
    }

    if (transaction.type === "bulk") {
      // console.log('tranmx is',transaction)

      const recipients = JSON.parse(transaction?.recipient);
      const recipientList = recipients?.map((recipient) => {
        return `${recipient?.type}(${
          recipient?.recipient
        }) at an amount of ${currencyFormatter(recipient?.price)}`;
      });

      const formatter = new Intl.ListFormat("en", {
        style: "long",
        type: "conjunction",
      });
      const formattedList = formatter.format(recipientList);
      // const message= `Your request to buy bulk ${transaction.service} has been received.Your transaction id is ${transaction?.id}.Thank you for your business with us!`,
      const bulkAirtimemessage = `Your request for bulk package is received. Ref: ${transaction?.id}. Thank you for choosing us.`;

      await sendSMS(bulkAirtimemessage, transaction?.phonenumber);

      const message = `The number ${
        transaction?.phonenumber
      } with Email Address ${
        transaction?.email || ""
      } has successfully made payment to transfer bulk airtime to:
    ${formattedList}.`;
      // logger.info(message)

      if (process.env.NODE_ENV === "production") {
        const emailPrompt = await sendEMail(
          process.env.MAIL_CLIENT_USER,
          mailTextShell(`<p>${message}</p>`),
          "REQUEST FOR BULK AIRTIME TRANSFER",
        );

        const SMSPrompt = await sendSMS(
          message,
          process.env.CLIENT_PHONENUMBER,
        );

        await Promise.all([emailPrompt, SMSPrompt]);
      }
    }
  }
}

async function sendVoucherSMS(selectedVouchers, transaction, categoryType) {
  const { phonenumber, email } = transaction;

  // console.log(transaction)
  if (transaction.status === "completed") {
    let message = "";
    if (categoryType === "voucher") {
      const detailsInfo = JSON.parse(selectedVouchers[0]?.details ?? {});

      const smsInfo = selectedVouchers.map((voucher) => {
        return `[${voucher?.pin} -- ${voucher?.serial}]`;
      });
      const smsData = await Promise.all([smsInfo]);

      message = `${selectedVouchers[0]?.voucherType} voucher.
 ${detailsInfo?.voucherURL}   
[Pin--Serial]
${smsData.join(" ")}.
Buy more at https://www.gpcpins.com/evoucher`;
    }

    if (categoryType === "ticket") {
      const detailsInfo = safeJSON(selectedVouchers[0]?.details);

      const smsInfo = selectedVouchers.map((voucher) => {
        return `[${voucher?.type} -- ${voucher?.serial || voucher?.pin}]`;
      });
      const smsData = await Promise.all([smsInfo]);

      message = `${selectedVouchers[0]?.voucherType}   
[Seat No./Type--Serial]
${smsData.join(" ")},  

${formatDate(detailsInfo?.date)},${formatTime(detailsInfo?.time)},  
${email || ""},
${phonenumber}.Please visit https://www.gpcpins.com/evoucher to buy more tickets.
`;
    }

    if (phonenumber) {
      await sendSMS(message, phonenumber);

      await messageQueue.add(
        "send-text",
        {
          sessionId: process.env.WHATSAPP_SESSION_ID,
          type: "send-text",
          phone: getInternationalMobileFormat(phonenumber),
          message: message,
        },
        {
          jobId: `${transaction?.paymentReference}`,
          attempts: 1,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
        },
      );
    }
  }
}

async function sendWalletTopUpMessage(transaction) {
  if (transaction.status === "completed") {
    const message = `Your wallet top-up of ${currencyFormatter(transaction.amount)} has been processed. Transaction ID: ${transaction.walletTransactionId}`;
    const partner = safeJSON(transaction?.partner);

    const sms = await sendSMS(message, partner?.phonenumber);

    limit(() => Promise.all([sms]));
  }
}

async function sendElectricityMessage(transaction) {
  if (transaction.status === "completed") {
    const message = `The number ${transaction?.phonenumber} with METER NO. '${
      transaction?.number
    }' has successfully made payment to buy PREPAID UNITS at an amount of ${currencyFormatter(
      transaction?.topup,
    )}.`;

    // Send Mail and SMS to the User
    if (transaction?.email) {
      await sendElectricityMail(transaction?.id, transaction?.email, "pending");
    }

    if (transaction?.phonenumber) {
      await sendSMS(
        `Thank you for your purchase! You will be notified shortly after your transaction is complete.Your transaction id is ${transaction?.id}`,
        transaction?.phonenumber,
      );
    }

    const agentMail = await sendEMail(
      process.env.MAIL_CLIENT_USER,
      mailTextShell(message),
      "Prepaid Units",
    );

    limit(() => Promise.all([agentMail]));
  }
}

function formatResponse(transaction) {
  const transactionInfo = safeJSON(transaction?.info);

  return {
    id:
      transaction.id ||
      transaction.paymentId ||
      transaction?.walletTransactionId,
    paymentReference: transaction?.paymentReference,
    externalTransactionId: transaction?.externalTransactionId,
    categoryId: transactionInfo?.categoryId,
    categoryType: transactionInfo?.categoryType,
    status: transaction.status,
    userName: transactionInfo?.user?.name || "",
    email: transaction?.email,
    phonenumber: transaction.phonenumber,
    paymentMode: transaction.mode,
    amount: transaction?.amount,
    createdAt: transaction.createdAt,
  };
}

// Fetch transaction based on type and ensure it belongs to the user
async function getTransaction(type, transactionId, transx) {
  let query;
  switch (type) {
    case "voucher":
    case "ticket":
      query = await transx("vw_payments_voucher_transactions")
        .where("id", transactionId)
        .select("*")
        .first();
      break;
    case "prepaid":
      query = await transx("vw_meter_payment_prepaid_transaction_view")
        .select("*")
        .where({
          id: transactionId,
        })
        .first();
      break;
    case "airtime":
      query = await transx("vw_payments_airtime_transactions")
        .select(
          "id",
          "userId",
          "paymentReference",
          "paymentId",
          "kind as type",
          "recipient",
          "email",
          "phonenumber",
          "amount",
          "mode",
          "service",
          "provider as network",
          "createdAt",
          "isProcessed",
          "status",
        )
        .where({ id: transactionId })
        .first();
      break;
    case "bundle":
      query = await transx("vw_payments_bundle_transactions")
        .select(
          "id",
          "userId",
          "paymentReference",
          "paymentId",
          "type",
          "kind",
          "volume",
          "bundleId",
          "bundleName",
          "recipient",
          "email",
          "phonenumber",
          "amount",
          "mode",
          "service",
          "provider as network",
          "createdAt",
          "isProcessed",
          "status",
        )
        .where({ id: transactionId })
        .first();
      break;

    case "wallet":
      query = await transx("vw_payments_wallet_transactions")
        .select("*")
        .where({ paymentId: transactionId })
        .first();
      break;
    default:
      return null;
  }
  return query;
}

async function notifyLowBalance(balance) {
  const body = `Your one-4-all top up account balance is running low. Remaining balance: GHS ${balance}. Please recharge.`;

  if (process.env.NODE_ENV === "production") {
    Promise.all([
      sendEMail(
        process.env.MAIL_CLIENT_USER,
        mailTextShell(`<p>${body}</p>`),
        "LOW TOP UP ACCOUNT BALANCE",
      ),
      sendSMS(body, process.env.CLIENT_PHONENUMBER),
    ]).catch((err) =>
      this.logger.error("Low balance notification failed", err),
    );
  }
}

async function handlePostPaymentEvents(payment, status, payload) {
  try {
    const reference = payment?.paymentReference;
    const amount = payment?.amount;
    const userId = payment?.userId;
    const phone = payment?.phonenumber;
    const service = payment?.service;

    const externalId =
      payload?.Data?.ExternalTransactionId ||
      payload.data.externalTransactionId ||
      payload?.extralTransactionId;

    // ---------------- MESSAGE TEMPLATE ----------------
    const isSuccess = status === "completed";
    // const isPending = status === "pending";

    const message = isSuccess
      ? `Your payment of GHS ${amount} for ${service} service was successful. Thank you for your trust.Transaction ID:${payment?.id}`
      : `Your payment of GHS ${amount} for ${service} service failed. Please try again or contact support.`;

    // ---------------- 1. NOTIFICATIONS ----------------
    if (userId) {
      queueMicrotask(async () => {
        try {
          await knex("notifications").insert({
            id: generateId(),
            user_id: userId,
            type: payment.service,
            title: isSuccess ? "Payment Successful" : "Payment Failed",
            body: message,
          });
        } catch (err) {
          logger.error("Notification insert failed:", err);
        }
      });
    }

    // ---------------- 2. REAL-TIME SOCKET EVENT ----------------
    queueMicrotask(async () => {
      try {
        if (isSuccess) {
          logger.info(
            `[Webhook] Transaction ${payment?.id || payment?.walletTransactionId} SUCCEEDED.`,
          );

          switch (service) {
            case "voucher":
            case "ticket":
              const info = safeJSON(payment?.info);

              await emitPaymentSuccess({
                userId,
                txRef:
                  userId ||
                  payment.phonenumber ||
                  info?.user?.phonenumber ||
                  reference,
                amount,
                transaction: {
                  id: payment.id,
                  paymentReference: reference,
                  categoryId: info?.categoryId,
                  categoryType: info?.categoryType,
                  status: status,
                  userName: info?.user?.name || "",
                  email: payment?.email,
                  phonenumber: payment?.phonenumber,
                  paymentMode: payment?.mode,
                  amount: amount,
                  externalTransactionId: externalId,
                  createdAt: payment.createdAt,
                },
              });
              break;
            default:
              await emitPaymentSuccess({
                userId,
                txRef:
                  payment.phonenumber || info?.user?.phonenumber || reference,
                amount,
                transaction: {
                  id: payment.id || payment?.walletTransactionId,
                  paymentReference: reference,
                  service,
                  status: status,
                  userName: info?.user?.name || "",
                  email: payment?.email,
                  phonenumber: payment?.phonenumber,
                  paymentMode: payment?.mode,
                  amount: amount,
                  externalTransactionId: externalId,
                  createdAt: payment.createdAt,
                },
              });
          }
        } else {
          await emitPaymentFailure({
            userId,
            txRef: payment.phonenumber || info?.user?.phonenumber || reference,
            reason: "Payment failed",
          });
          logger.warn(
            `[Webhook] Transaction ${payment?.id || payment?.walletTransactionId} FAILED (code=${payload?.statusCode}).`,
          );
        }
      } catch (err) {
        logger.error("Socket emit failed:", err);
      }
    });

    // ---------------- 3. SMS DELIVERY ----------------
    setImmediate(async () => {
      try {
        await sendSMS(message, phone);
      } catch (err) {
        logger.error("SMS send failed:", err);
      }
    });

    // ---------------- 4. OPTIONAL AUDIT LOG ----------------
    queueMicrotask(async () => {
      try {
        await knex("payment_logs").insert({
          id: generateId(),
          payment_id: payment.paymentId,
          reference,
          status,
          payload: JSON.stringify(payload),
          external_transaction_id: externalId,
          created_at: knex.fn.now(),
        });
      } catch (err) {
        logger.error("Payment log insert failed:", err);
      }
    });
  } catch (error) {
    // NEVER throw (this runs post-response)
    logger.error("[Webhook] Error processing callback payload:", error);
  }
}

// const paymentCallback = async (res, payload, type) => {
//   const reference = payload?.Data?.ClientReference;
//   if (!reference || !type) return res.sendStatus(204);

//   const doneKey = `payment:processed:${reference}`;
//   const lockKey = `payment:lock:${reference}`;

//   // 1. Already processed?
//   if (await redisClient.get(doneKey)) {
//     return res.sendStatus(200);
//   }

//   // 2. Acquire lock
//   const lock = await redisClient.set(lockKey, "1", "NX", "EX", 60);

//   if (!lock) return res.sendStatus(200);

//   let trx;

//   try {
//     const statusMap = {
//       "0000": "completed",
//       "0001": "pending",
//     };

//     const newStatus = statusMap[payload.ResponseCode] || "failed";

//     const table = PAYMENT_TABLE_MAP[type];
//     if (!table) return res.sendStatus(204);

//     trx = await knex.transaction();

//     const payment = await trx(table)
//       .where({ paymentReference: reference })
//       .first();

//     if (!payment) {
//       await trx.rollback();
//       return res.sendStatus(204);
//     }

//     // idempotency DB guard
//     if (payment.status === "completed") {
//       await trx.commit();
//       return res.sendStatus(200);
//     }

//     await trx("payments")
//       .where({ id: payment.paymentId })
//       .andWhereNot({ status: "completed" })
//       .update({
//         status: newStatus,
//         externalTransactionId: payload?.Data?.ExternalTransactionId,
//         updated_at: knex.fn.now(),
//       });

//     await trx.commit();

//     // mark processed
//     await redisClient.set(doneKey, "1", "EX", 86400);
//     await redisClient.del(lockKey);

//     // async events
//     queueMicrotask(() => handlePostPaymentEvents(payment, newStatus, payload));
//   } catch (err) {
//     if (trx) await trx.rollback();
//     await redisClient.del(lockKey);
//     logger.error(err);
//     console.log(err);
//     res.sendStatus(500);
//   }
// };

// ecg wallet option

// if (isWallet && !_.isEmpty(transaction)) {
//   setImmediate(async () => {
//     await emitPaymentSuccess({
//       userId: userID,
//       txRef: transaction_reference || info?.phonenumber,
//       amount: amount,
//       transaction: {
//         id: transaction_id || paymentId,
//         paymentReference: transaction_reference,
//         status: paymentStatus,
//         userName: info?.name || "Customer",
//         email: info?.email,
//         phonenumber: info?.phonenumber,
//         paymentMode: "Wallet",
//         amount: amount,
//         createdAt: new Date().toISOString(),
//       },
//     });
//   });
// }
