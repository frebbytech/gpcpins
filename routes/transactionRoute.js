const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const { randomBytes } = require("crypto");
const _ = require("lodash");
const moment = require("moment");
const generateId = require("../config/generateId");
const pLimit = require("p-limit");
const cors = require("cors");
//model

const currencyFormatter = require("../config/currencyFormatter");
const {
  getTodayTransaction,
  getYesterdayTransaction,
  getLastSevenDaysTransactions,
  getThisMonthTransaction,
  getTransactionsByMonth,
  getRecentTransaction,
  getTopCustomers,
  getTopSellingProducts,
  getTodayTransactionArray,
  getYesterdayTransactionArray,
  getLastSevenDaysTransactionsArray,
  getThisMonthTransactionArray,
  getLastMonthTransactionArray,
  getTransactionsArrayByMonth,
  getThisYearTransactionArray,
  getLastYearTransactionArray,
  getRangeTransactions,
} = require("../config/transactionSummary");

const verifyAdmin = require("../middlewares/verifyAdmin");
const verifyAdminORAgent = require("../middlewares/verifyAdminORAgent");
const { verifyToken } = require("../middlewares/verifyToken");
const { rateLimit } = require("express-rate-limit");

const { isValidUUID2 } = require("../config/validation");

const knex = require("../db/knex");
const { moneyStatus, sendMoneyToCustomer } = require("../config/sendMoney");
const verifyAgent = require("../middlewares/verifyAgent");
const { uploadFiles } = require("../config/uploadFile");
const { generateHTMLTemplate } = require("../config/generateVoucherTemplate");
const { generateTransactionReport } = require("../config/generatePDF");
const { sendReportMail } = require("../config/mail");
const { mailTextShell } = require("../config/mailText");
const {
  getInternationalMobileFormat,
  getPhoneNumberInfo,
} = require("../config/PhoneCode");
const { sendSMS } = require("../config/sms");
const { safeJSON } = require("../config/helpers");
const { parseDateRange } = require("../config/dateConfigs");
const { getBrassicaTransactionStatus } = require("./brassica/brasiccaMoney");

const limit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 5 requests per windowMs
  message: "Too many requests!. please try again later.",
});

const plimit = pLimit(3);

const corsOptions = {
  methods: "POST",
  origin: process.env.CLIENT_URL,
};

router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { sort, startDate, endDate } = req.query;
    let modifiedTransaction = [];
    let modifiedAirtimeTransaction = [];

    const [
      bundle_transactions,
      airtime_transactions,
      voucher_transactions,
      prepaid_transactions,
    ] = await Promise.all([
      await knex("vw_payments_bundle_transactions").select(
        "id",
        "paymentId",
        "externalTransactionId",
        "kind",
        "volume",
        "paymentReference as reference",
        "recipient",
        "email",
        "phonenumber",
        "amount",
        "info",
        "mode",
        "partner",
        "amount",
        "service",
        "domain as type",
        "isProcessed",
        "status",
        "createdAt",
        "updatedAt",
        knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
      ),
      // .where("status", "IN", ["completed", "pending"]),

      //Airtime
      await knex("vw_payments_airtime_transactions").select(
        "id",
        "externalTransactionId",
        "kind",
        "paymentReference as reference",
        "recipient",
        "email",
        "phonenumber",
        "info",
        "partner",
        "amount",
        "mode",
        "service",
        "service as type",
        "isProcessed",
        "issuerId as issuer",
        "issuerName",
        "status",
        "createdAt",
        "updatedAt",
        knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
      ),
      // .where("status", "IN", ["completed", "pending"]),
      //Vouchers
      await knex("vw_payments_voucher_transactions").select(
        "id",
        "externalTransactionId",
        "info",
        "partner",
        "mode",
        "service",
        "amount",
        "paymentReference as reference",
        "email",
        "phonenumber",
        "status",
        "createdAt",
        "updatedAt",
        knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
      ),
      // .where("status", "IN", ["completed", "pending"]),
      //Electricity
      await knex("vw_meter_payment_prepaid_transaction_view").select(
        "id",
        "externalTransactionId",
        "paymentReference as reference",
        "info",
        "partner",
        "mode",
        "service",
        "amount",
        "email",
        "phonenumber",
        "status",
        "isProcessed",
        // " issuer",
        " issuerName",
        "createdAt",
        "updatedAt",
        knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
        "meterId",
        "number",
      ),

      // .where("status", "IN", ["completed", "pending"]),
    ]);

    const ecgTransaction = prepaid_transactions.map((transaction) => {
      const info = safeJSON(transaction?.info);
      return {
        id: transaction?.id,
        externalTransactionId: transaction?.externalTransactionId,
        reference: transaction?.reference,
        meter: transaction?.number,
        type: `${transaction?.service} Units`,
        service: transaction?.service,
        domain: transaction?.service,
        amount: transaction?.amount,
        email: transaction?.email,
        phonenumber: transaction?.phonenumber,
        downloadLink: info?.downloadLink,
        issuer: transaction?.issuer,
        issuerName: transaction?.issuerName,
        mode: transaction?.mode,
        partner: safeJSON(transaction?.partner),
        isProcessed: transaction?.isProcessed,
        // status: Boolean(transaction?.isProcessed) ? "completed" : "pending",
        status: transaction.status,
        createdAt: transaction?.updatedAt,
        modifiedAt: transaction?.modifiedAt,
        updatedAt: transaction?.updatedAt,
      };
    });

    const bundleAirtimeTransactions = [
      ...bundle_transactions,
      ...airtime_transactions,
      ...ecgTransaction,
    ].map(({ info, partner, ...rest }) => {
      return {
        ...rest,
        domain: rest.service,
        partner: safeJSON(partner),
        info: safeJSON(info),
      };
    });

    const VoucherTransactions = voucher_transactions.map(
      async ({ info, partner, ...rest }) => {
        const inf = safeJSON(info);

        const category = await knex("categories")
          .where("id", inf?.categoryId)
          .select("name as voucherType")
          .first();

        return {
          id: rest.id,
          externalTransactionId: rest.externalTransactionId,
          reference: rest.reference,
          voucherType: category?.voucherType,
          service: rest?.service,
          domain: rest?.service,
          downloadLink: inf?.downloadLink,
          type: _.upperCase(`${category?.voucherType} ${rest?.service}`),
          phonenumber: rest?.phonenumber,
          email: rest?.email,
          partner: safeJSON(partner),
          quantity: inf?.quantity || inf?.paymentDetails?.quantity,
          amount: rest?.amount || inf?.paymentDetails?.totalAmount,
          createdAt: rest?.updatedAt,
          updatedAt: rest?.updatedAt,
          modifiedAt: rest?.modifiedAt,
          isProcessed: rest?.isProcessed,
          partner: safeJSON(partner),
          mode: rest?.mode,
          status: rest?.status,
        };
      },
    );

    const vouchers = await Promise.all(VoucherTransactions);

    const modifiedTransactionWithRange = getRangeTransactions(
      startDate,
      endDate,
      vouchers,
    );

    const modifiedAirtimeTransactionWithRange = getRangeTransactions(
      startDate,
      endDate,
      bundleAirtimeTransactions,
    );

    switch (sort) {
      case "today":
        modifiedTransaction = getTodayTransactionArray(
          modifiedTransactionWithRange,
        );
        modifiedAirtimeTransaction = getTodayTransactionArray(
          modifiedAirtimeTransactionWithRange,
        );

        break;
      case "yesterday":
        modifiedTransaction = getYesterdayTransactionArray(
          modifiedTransactionWithRange,
        );
        modifiedAirtimeTransaction = getYesterdayTransactionArray(
          modifiedAirtimeTransactionWithRange,
        );

        break;

      case "week":
        modifiedTransaction = getLastSevenDaysTransactionsArray(
          modifiedTransactionWithRange,
        );

        modifiedAirtimeTransaction = getLastSevenDaysTransactionsArray(
          modifiedAirtimeTransactionWithRange,
        );

        break;
      case "month":
        modifiedTransaction = getThisMonthTransactionArray(
          modifiedTransactionWithRange,
        );
        modifiedAirtimeTransaction = getThisMonthTransactionArray(
          modifiedAirtimeTransactionWithRange,
        );

        break;
      case "lmonth":
        modifiedTransaction = getLastMonthTransactionArray(
          modifiedTransactionWithRange,
        );

        modifiedAirtimeTransaction = getLastMonthTransactionArray(
          modifiedAirtimeTransactionWithRange,
        );

        break;
      case "year":
        modifiedTransaction = getThisYearTransactionArray(
          modifiedTransactionWithRange,
        );

        modifiedAirtimeTransaction = getThisYearTransactionArray(
          modifiedAirtimeTransactionWithRange,
        );

        break;
      case "lyear":
        modifiedTransaction = getLastYearTransactionArray(
          modifiedTransactionWithRange,
        );

        modifiedAirtimeTransaction = getLastYearTransactionArray(
          modifiedAirtimeTransactionWithRange,
        );

        break;

      default:
        modifiedTransaction = [...modifiedTransactionWithRange];
        modifiedAirtimeTransaction = [...modifiedAirtimeTransactionWithRange];
    }

    res
      .status(200)
      .json([...modifiedTransaction, ...modifiedAirtimeTransaction]);
  }),
);

router.get(
  "/refund",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { sort, startDate, endDate } = req.query;
    let modifiedTransaction = [];

    const [
      agent_transactions,
      bundle_transactions,
      airtime_transactions,
      voucher_transactions,
      prepaid_transactions,
    ] = await Promise.all([
      knex("agent_transactions")
        .select(
          "id",
          "reference",
          "recipient",
          "recipient as phonenumber",
          "info",
          knex.raw(`'Wallet' as mode`),
          knex.raw(`true as isAgent`),
          knex.raw(`true as isProcessed`),
          "total_amount as amount",
          "type",
          "type as service",
          "type as domain",
          "refunder",
          "user_id as issuer",
          "year",
          "status",
          "created_at as createdAt",
          "updated_at as updatedAt",
          knex.raw("DATE_FORMAT(updated_at,'%D %M,%Y %r') as modifiedAt"),
        )
        .where({
          status: "refunded",
        }),
      //Bundle
      knex("vw_payments_bundle_transactions")
        .select(
          "id",
          "paymentId",
          "kind",
          "volume",
          "paymentReference as reference",
          "recipient",
          "phonenumber",
          "amount",
          "info",
          "mode",
          "service",
          "service as domain",
          "service as type",
          "isProcessed",
          "issuerId as issuer",
          "issuerName",
          "refunderId as refunder",
          "status",
          "createdAt",
          "updatedAt",
          knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
        )
        .where({
          status: "refunded",
        }),
      //Airtime

      knex("vw_payments_airtime_transactions")
        .select(
          "id",
          "paymentId",
          "kind",
          "paymentReference as reference",
          "recipient",
          "phonenumber",
          "info",
          "amount",
          "mode",
          "service",
          "service as domain",
          "service as type",
          "isProcessed",
          "issuerId as issuer",
          "issuerName",
          "refunderId as refunder",
          "status",
          "createdAt",
          "updatedAt",
          knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
        )
        .where({
          status: "refunded",
        }),
      //Vouchers
      knex("vw_payments_voucher_transactions")
        .select(
          "id",
          "paymentId",
          "paymentReference as reference",
          "info",
          "mode",
          "issuerId as issuer",
          "issuerName",
          "refunderId as refunder",
          "amount",
          "phonenumber",
          "service",
          "service as domain",
          "isProcessed",
          "status",
          "email",
          "createdAt",
          "updatedAt",
          knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
        )
        .where({
          status: "refunded",
        }),
      //Electricity
      knex("vw_meter_payment_prepaid_transaction_view")
        .select(
          "id",
          "paymentId",
          "paymentReference as reference",
          "meterId",
          "number",
          "service",
          "info",
          "mode",
          "status",
          "isProcessed",
          "issuerId as issuer",
          "issuerName",
          "refunderId as refunder",
          "createdAt",
          "updatedAt",
          knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
        )
        .where({
          status: "refunded",
        }),
    ]);

    const groupedTransactions = _.groupBy(agent_transactions, "type");

    const agentBundleTransaction = groupedTransactions?.bundle || [];

    const bundleTransactions = [
      ...bundle_transactions,
      ...agentBundleTransaction,
    ].map(({ info, ...rest }) => {
      const infoDetails = JSON.parse(info);
      const details = rest.isAgent
        ? {
            ...rest,
            kind: infoDetails?.plan_name,
            volume: infoDetails?.volume,
            service: "bundle",
            domain: "bundle",
            issuerName: "Agent",
          }
        : {
            ...rest,
            info: infoDetails,
          };
      return details;
    });

    const agentAirtimeTransaction = groupedTransactions?.airtime || [];

    const airtimeTransactions = [
      ...airtime_transactions,
      ...agentAirtimeTransaction,
    ].map(({ info, ...rest }) => {
      const infoDetails = safeJSON(info);
      const details = rest.isAgent
        ? {
            ...rest,
            issuerName: "Agent",
            kind: "single",
            domain: "airtime",
            service: "airtime",
          }
        : {
            ...rest,
            info: infoDetails,
          };
      return details;
    });

    //
    const voucherTransactions = voucher_transactions.map(
      async ({ info, partner, ...rest }) => {
        const inf = safeJSON(info);

        const category = await knex("categories")
          .where("id", inf?.categoryId)
          .select("name as voucherType")
          .first();

        return {
          id: rest.id,
          paymentId: rest.paymentId,
          externalTransactionId: rest.externalTransactionId,
          reference: rest.reference,
          voucherType: category?.voucherType,
          service: rest?.service,
          domain: rest?.service,
          downloadLink: inf?.downloadLink,
          type: _.upperCase(`${category?.voucherType} ${rest?.service}`),
          phonenumber: rest?.phonenumber,
          email: rest?.email,
          partner: safeJSON(partner),
          quantity: inf?.quantity || inf?.paymentDetails?.quantity,
          amount: rest?.amount || inf?.paymentDetails?.totalAmount,
          createdAt: rest?.updatedAt,
          updatedAt: rest?.updatedAt,
          modifiedAt: rest?.modifiedAt,
          isProcessed: rest?.isProcessed,
          issuer: rest?.issuer,
          issuerName: rest?.issuerName,
          refunder: rest?.refunder,
          partner: safeJSON(partner),
          mode: rest?.mode,
          status: rest?.status,
        };
      },
    );

    const vouchers = await Promise.all(voucherTransactions);

    const ecgTransaction = prepaid_transactions.map((transaction) => {
      const info = safeJSON(transaction?.info);
      return {
        id: transaction?.id,
        paymentId: transaction?.paymentId,
        externalTransactionId: transaction?.externalTransactionId,
        reference: transaction?.reference,
        meter: transaction?.number,
        type: `${transaction?.service} Units`,
        service: transaction?.service,
        domain: transaction?.service,
        amount: transaction?.amount,
        email: transaction?.email,
        phonenumber: transaction?.phonenumber,
        downloadLink: info?.downloadLink,
        issuer: transaction?.issuer,
        issuerName: transaction?.issuerName,
        refunder: transaction?.refunder,
        mode: transaction?.mode,
        partner: safeJSON(transaction?.partner),
        isProcessed: transaction?.isProcessed,
        status: transaction.status,
        createdAt: transaction?.updatedAt,
        modifiedAt: transaction?.modifiedAt,
        updatedAt: transaction?.updatedAt,
      };
    });

    const allTransactions = [
      ...vouchers,
      ...ecgTransaction,
      ...airtimeTransactions,
      ...bundleTransactions,
    ];

    const modifiedTransactionWithRange = getRangeTransactions(
      startDate,
      endDate,
      allTransactions,
    );

    switch (sort) {
      case "today":
        modifiedTransaction = getTodayTransactionArray(
          modifiedTransactionWithRange,
        );

        break;
      case "yesterday":
        modifiedTransaction = getYesterdayTransactionArray(
          modifiedTransactionWithRange,
        );
        break;

      case "week":
        modifiedTransaction = getLastSevenDaysTransactionsArray(
          modifiedTransactionWithRange,
        );

        break;
      case "month":
        modifiedTransaction = getThisMonthTransactionArray(
          modifiedTransactionWithRange,
        );
        break;
      case "lmonth":
        modifiedTransaction = getLastMonthTransactionArray(
          modifiedTransactionWithRange,
        );

        break;
      case "year":
        modifiedTransaction = getThisYearTransactionArray(
          modifiedTransactionWithRange,
        );

        break;
      case "lyear":
        modifiedTransaction = getLastYearTransactionArray(
          modifiedTransactionWithRange,
        );

        break;

      default:
        modifiedTransaction = [...modifiedTransactionWithRange];
    }

    res.status(200).json(modifiedTransaction);
  }),
);

router.get(
  "/report",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { year, type } = req.query;

    // --- Input validation ---
    if (!year || !/^\d{4}$/.test(year)) {
      return res.status(400).json({ error: "Valid year (YYYY) is required" });
    }
    const validTypes = [
      "All",
      "Prepaid",
      "Airtime",
      "Bundle",
      "Voucher",
      "Ticket",
    ];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    const currentYear = parseInt(year, 10);

    // Helper to get monthly aggregated totals from a view
    async function getMonthlyTotals(viewName, year, whereConditions = {}) {
      let query = knex(viewName)
        .select(
          knex.raw("MONTH(createdAt) as month"),
          knex.raw("SUM(amount) as total"),
        )
        .where("year", year)
        .andWhere("status", "completed")
        .andWhere(whereConditions)
        .groupByRaw("MONTH(createdAt)")
        .orderBy("month", "asc");

      const rows = await query;
      // Build an array with 12 months (default 0)
      const monthlyData = Array(12).fill(0);
      for (const row of rows) {
        const monthIndex = row.month - 1; // months are 1-12
        monthlyData[monthIndex] = parseFloat(row.total) || 0;
      }
      return monthlyData;
    }

    // Helper for voucher/ticket (same view but filtered by service)
    async function getServiceMonthlyTotals(service, year) {
      return getMonthlyTotals("vw_payments_voucher_transactions", year, {
        service,
      });
    }

    // Build report based on type
    let reportDetails = {};

    if (type === "All") {
      const [prepaid, airtime, bundle, voucher, ticket] = await Promise.all([
        getMonthlyTotals(
          "vw_meter_payment_prepaid_transaction_view",
          currentYear,
        ),
        getMonthlyTotals("vw_payments_airtime_transactions", currentYear),
        getMonthlyTotals("vw_payments_bundle_transactions", currentYear),
        getServiceMonthlyTotals("voucher", currentYear),
        getServiceMonthlyTotals("ticket", currentYear),
      ]);

      reportDetails = {
        prepaid,
        airtime,
        bundle,
        voucher,
        ticket,
      };
    } else if (type === "Prepaid") {
      const monthly = await getMonthlyTotals(
        "vw_meter_payment_prepaid_transaction_view",
        currentYear,
      );
      reportDetails = { report: monthly };
    } else if (type === "Airtime") {
      const monthly = await getMonthlyTotals(
        "vw_payments_airtime_transactions",
        currentYear,
      );
      reportDetails = { report: monthly };
    } else if (type === "Bundle") {
      const monthly = await getMonthlyTotals(
        "vw_payments_bundle_transactions",
        currentYear,
      );
      reportDetails = { report: monthly };
    } else if (type === "Voucher") {
      const monthly = await getServiceMonthlyTotals("voucher", currentYear);
      reportDetails = { report: monthly };
    } else if (type === "Ticket") {
      const monthly = await getServiceMonthlyTotals("ticket", currentYear);
      reportDetails = { report: monthly };
    }

    res.status(200).json(reportDetails);
  }),
);

router.get(
  "/verify",
  limit,
  asyncHandler(async (req, res) => {
    const { id, ticket } = req.query;

    //Check if ticket exists
    if (!ticket || !id) {
      return res.status(400).json("Error! Ticket not available.");
    }

    const transx = await knex.transaction();

    try {
      //find tranasction with specific payment id
      const transaction = await transx("voucher_transactions")
        .select("*")
        .where("_id", id)
        .limit(1)
        .first();

      if (_.isEmpty(transaction)) {
        return res.status(400).json("Couldnt find your ticket!");
      }

      // console.log(transaction)

      //selectedVoucher
      const selectedVoucher = await transx("voucher_view")
        .where("_id", ticket)
        .first();

      if (_.isEmpty(selectedVoucher)) {
        return res.status(400).json("Couldnt Verify your ticket! Try again");
      }

      const info = JSON.parse(transaction?.info);
      const details = JSON.parse(selectedVoucher?.details);
      const modifiedVoucher = {
        id: transaction?._id,
        voucherType: selectedVoucher?.voucher,
        category: selectedVoucher?.category,
        serial: selectedVoucher.serial,
        pin: selectedVoucher.pin,
        type: details?.type,
        seatNo: details?.seatNo,
        mode: transaction?.mode,
        amount: info?.amount,
        email: transaction.email,
        phonenumber: transaction.phonenumber,
        status: _.upperCase(selectedVoucher?.status),
        createdAt: transaction?.createdAt,
      };

      await transx.commit();

      res.status(200).json(modifiedVoucher);
    } catch (error) {
      await transx.rollback();

      return res.status(400).json("Couldnt Verify your ticket");
    }
  }),
);

router.get(
  "/total-sales",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id, isAdmin } = req.user;
    const year = moment().year();
    let logs = [];

    try {
      const [
        agent_transactions,
        bundle_transactions,
        airtime_transactions,
        voucher_transactions,
        prepaid_transactions,
      ] = await Promise.all([
        //AGENT
        knex("agent_transactions")
          .select(
            "id",
            "type",
            "recipient as phonenumber",
            "type as domain",
            "total_amount as amount",
            "year",
            "status",
            "created_at as createdAt",
            "updated_at as updatedAt",
          )
          .where({ year: year })
          .andWhere("status", "IN", ["completed", "refunded"])
          .orderBy("created_at", "desc"),
        //Bundle
        knex("vw_payments_bundle_transactions")
          .select(
            "id",
            "status",
            "info",
            "phonenumber",
            "domain",
            "amount",
            "year",
            "createdAt",
            "updatedAt",
          )
          .where({ year: year })
          .andWhere("status", "IN", ["completed", "refunded"])

          .orderBy("updatedAt", "desc"),
        //Airtime
        knex("vw_payments_airtime_transactions")
          .select(
            "id",
            "status",
            "info",
            "phonenumber",
            "domain",
            "amount",
            "year",
            "createdAt",
            "updatedAt",
          )
          .where({ year: year })
          .andWhere("status", "IN", ["completed", "refunded"])
          .orderBy("updatedAt", "desc"),
        //Vouchers
        knex("vw_payments_voucher_transactions")
          .select(
            "id",
            "status",
            "info",
            "amount",
            "createdAt",
            "updatedAt",
            "year",
          )
          .where({ year: year })
          .andWhere("status", "IN", ["completed", "refunded"])
          .orderBy("updatedAt", "desc"),
        //Electricity
        knex("vw_meter_payment_prepaid_transaction_view")
          .where({ year: year })
          .andWhere("status", "IN", ["completed", "refunded"])
          .select(
            "id",
            "status",
            "amount",
            "info",
            "year",
            "createdAt",
            "updatedAt",
          )
          .orderBy("updatedAt", "desc"),
      ]);

      const groupedTransactions = _.groupBy(agent_transactions, "type");
      const agentAirtimeTransaction = groupedTransactions?.airtime || [];
      const agentBundleTransaction = groupedTransactions?.bundle || [];

      const bundleTransaction = [
        ...bundle_transactions,
        ...agentBundleTransaction,
      ].map(({ info, ...rest }) => {
        return {
          ...rest,
          domain: _.capitalize(rest.domain),
          info: safeJSON(info),
        };
      });

      const airtimeTransaction = [
        ...airtime_transactions,
        ...agentAirtimeTransaction,
      ].map(({ info, ...rest }) => {
        return {
          ...rest,
          domain: _.capitalize(rest.domain),
          info: safeJSON(info),
        };
      });

      const transaction = voucher_transactions.map(({ info, ...rest }) => {
        return {
          ...rest,
          info: safeJSON(info),
        };
      });

      const ecgTransaction = prepaid_transactions.map((transaction) => {
        return {
          id: transaction?.id,
          status: transaction?.status,
          amount: transaction?.amount,
          info: safeJSON(transaction?.info),
          meter: {
            id: transaction?.meterId,
            number: transaction?.number,
          },
          createdAt: transaction?.createdAt,
          updatedAt: transaction?.updatedAt,
        };
      });

      //GET Total numbers of transactions
      const voucherCount = transaction?.length;
      const ecgCount = ecgTransaction?.length;
      const airtimeCount = airtimeTransaction?.length;
      const bundleCount = bundleTransaction?.length;

      const count = {
        labels: [
          "Vouchers & Tickets",
          "Prepaid Units",
          "Airtime Transfer",
          "Data Bundle",
        ],
        data: [voucherCount, ecgCount, airtimeCount, bundleCount],
      };

      const recents = _.orderBy(
        [
          ...getRecentTransaction(transaction, 3),
          ...getRecentTransaction(ecgTransaction, 3),
          ...getRecentTransaction(airtimeTransaction, 3),
          ...getRecentTransaction(bundleTransaction, 3),
        ],
        "updatedAt",
        "desc",
      );

      //Get ECG Total Amount
      const ecgTotal = _.sum(
        _.map(ecgTransaction, (item) => Number(item?.amount)),
      );

      //Get Voucher & Ticket Total Amount
      const voucherTotal = _.sum(
        _.map(transaction, (item) => Number(item?.amount)),
      );

      //Get Airtime Total Amount
      const airtimeTotal = _.sum(
        _.map(airtimeTransaction, (item) => Number(item?.amount)),
      );
      //Get Bundlet Total Amount
      const bundleTotal = _.sum(
        _.map(bundleTransaction, (item) => Number(item?.amount)),
      );

      const grandTotal = {
        ecg: ecgTotal,
        voucher: voucherTotal,
        airtime: airtimeTotal,
        bundle: bundleTotal,
        total: Number(ecgTotal + voucherTotal + airtimeTotal + bundleTotal),
      };

      //GET Total Sales today

      const today = {
        voucher: getTodayTransaction(transaction),
        ecg: getTodayTransaction(ecgTransaction),
        airtime: getTodayTransaction(airtimeTransaction),
        bundle: getTodayTransaction(bundleTransaction),
      };

      //GROUP transactions by Week
      const sevenDays = getLastSevenDaysTransactions(
        transaction,
        ecgTransaction,
      );
      const airtimeSevenDays = getLastSevenDaysTransactions(
        bundleTransaction,
        airtimeTransaction,
      );
      sevenDays.bundle = airtimeSevenDays.voucher;
      sevenDays.airtime = airtimeSevenDays.ecg;

      //GROUP transactions by month
      const transactionByMonth = getTransactionsByMonth(
        transaction,
        ecgTransaction,
      );
      const airtimeByMonth = getTransactionsByMonth(
        bundleTransaction,
        airtimeTransaction,
      );
      transactionByMonth.bundle = airtimeByMonth.voucher;
      transactionByMonth.airtime = airtimeByMonth.ecg;

      if (isAdmin) {
        logs = await knex("vw_user_logs_view")
          .select("*")
          .limit(3)
          .orderBy("createdAt", "desc");
      } else {
        logs = await knex("vw_user_logs_view")
          .where({ userId: id })
          .select("userId", "title", "createdAt")
          .limit(3)
          .orderBy("createdAt", "desc");
      }

      const data = {
        totalSales: grandTotal,
        totalCount: count,
        recents,
        today,
        sevenDays,
        transactionByMonth,
        logs,
      };

      res.status(200).json(data);
    } catch (error) {
      console.log(error);

      return res
        .status(500)
        .json("An unknown error has occurred.Try again later.");
    }
  }),
);

router.get(
  "/products",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const transx = await knex.transaction();
    try {
      const categories = await transx("categories")
        .select("*")
        .where("active", 1);

      const vouchers = await transx("vouchers").select("category_id", "status");

      const voucher_transactions = await transx(
        "vw_payments_voucher_transactions",
      )
        .select("*")
        .where("status", "IN", ["completed", "refunded"])
        .orderBy("createdAt", "desc");

      const transactions = voucher_transactions.map(({ info, ...rest }) => {
        return {
          ...rest,
          info: safeJSON(info),
        };
      });

      //Get Total Categories
      const totalCategories = categories.length;
      //Get Total Vouchers
      const totalVouchers = vouchers.length;

      let voucher = [];
      let ticket = [];

      categories.map((category) => {
        if (["bus", "cinema", "stadium"].includes(category.type)) {
          ticket.push(category?.id);
        } else {
          voucher.push(category?.id);
        }
        return;
      });

      //total vouchers
      const voucherCount = voucher?.length;
      //total tickets
      const ticketCount = ticket?.length;

      const voucherPins = vouchers.filter((vou) => {
        return voucher.includes(vou?.category_id);
      });

      const ticketPins = vouchers.filter((tic) =>
        ticket.includes(tic?.category_id),
      );

      //count pins and serials
      const voucherPinsCount = voucherPins.length;
      const ticketPinsCount = ticketPins.length;

      //Group tickets into status
      const groupedVouchers = _.groupBy(voucherPins, "status");
      const groupedTickets = _.groupBy(ticketPins, "status");

      const voucherTransactions = _.filter(
        transactions,
        (transaction) => transaction?.service === "voucher",
      );
      const ticketTransactions = _.filter(
        transactions,
        (transaction) => transaction?.service === "ticket",
      );

      //Top Sold
      const topSoldVouchers = await getTopSellingProducts(voucherTransactions);
      const topSoldTickets = await getTopSellingProducts(ticketTransactions);

      //Get Recent Transactions
      const recentVoucher = getRecentTransaction(voucherTransactions, 3);
      const recentTicket = getRecentTransaction(ticketTransactions, 3);

      //Get Today Transactions
      const voucherToday = getTodayTransaction(voucherTransactions);

      const ticketToday = getTodayTransaction(ticketTransactions);

      //Get Yesterday Transactions
      const voucherYesterday = getYesterdayTransaction(voucherTransactions);

      const ticketYesterday = getYesterdayTransaction(ticketTransactions);

      //Last Seven Days
      const lastSevenDaysData = getLastSevenDaysTransactions(
        voucherTransactions,
        ticketTransactions,
      );

      const voucherLastSevenDaysTotal = currencyFormatter(
        _.sum(lastSevenDaysData?.voucher?.data),
      );

      const ticketLastSevenDaysTotal = currencyFormatter(
        _.sum(lastSevenDaysData?.ecg?.data),
      );

      const thisYear = getTransactionsByMonth(
        voucherTransactions,
        ticketTransactions,
      );

      await transx.commit();
      const data = {
        category: {
          total: totalCategories,
          voucher: voucherCount,
          ticket: ticketCount,
        },
        pin: {
          total: totalVouchers,
          voucher: voucherPinsCount,
          ticket: ticketPinsCount,
        },
        topSold: {
          voucher: topSoldVouchers,
          ticket: topSoldTickets,
        },
        grouped: {
          voucher: [
            groupedVouchers["new"]?.length ?? 0,
            groupedVouchers["sold"]?.length ?? 0,
          ],
          ticket: [
            groupedTickets["new"]?.length ?? 0,
            groupedTickets["sold"]?.length ?? 0,
            groupedTickets["used"]?.length ?? 0,
          ],
        },
        recent: {
          voucher: recentVoucher,
          recent: recentTicket,
        },
        today: {
          total: currencyFormatter(voucherToday + ticketToday),
          voucher: currencyFormatter(voucherToday),
          ticket: currencyFormatter(ticketToday),
        },
        yesterday: {
          total: currencyFormatter(
            voucherYesterday ?? 0 + ticketYesterday ?? 0,
          ),
          voucher: currencyFormatter(voucherYesterday),
          ticket: currencyFormatter(ticketYesterday),
        },
        lastSevenDaysTotal: {
          voucherLastSevenDaysTotal,
          ticketLastSevenDaysTotal,
        },
        lastSevenDays: {
          labels: lastSevenDaysData.labels,
          voucher: lastSevenDaysData.voucher?.data,
          ticket: lastSevenDaysData.ecg?.data,
        },
        thisYear: {
          labels: thisYear?.labels,
          voucher: thisYear?.voucher?.data,
          ticket: thisYear?.ecg?.data,
        },
      };

      // console.log(data);

      res.status(200).json(data);
    } catch (error) {
      await transx.rollback();

      console.log(error);
      return res
        .status(500)
        .json("An unknown error has occurred.Try again later.");
    }
  }),
);

//ELECTRICTY
router.get(
  "/electricity",
  verifyToken,
  verifyAdmin,

  asyncHandler(async (req, res) => {
    try {
      const meters = await knex("meters").select("*").count({ count: "*" });

      const prepaid_transactions = await knex(
        "vw_meter_payment_prepaid_transaction_view",
      )
        .where({ year: moment().year() })
        .andWhere("status", "IN", ["completed", "refunded"])
        .select(
          "id",
          "amount",
          "email",
          "phonenumber",
          "service",
          "info",
          "status",
          "isProcessed",
          "year",
          "createdAt",
          "updatedAt",
        )
        .orderBy("updatedAt", "desc");

      const transaction = prepaid_transactions.map((transaction) => {
        return {
          id: transaction?.id,
          status: transaction?.status,
          amount: transaction?.amount,
          email: transaction?.email,
          phonenumber:
            transaction?.phonenumber || transaction?.recipient || "N/A",
          service: transaction?.service,
          isProcessed: transaction?.isProcessed,
          createdAt: transaction?.createdAt,
          updatedAt: transaction?.updatedAt,
          info: safeJSON(transaction?.info),
          meter: {
            id: transaction?.meterId,
            number: transaction?.number,
          },
        };
      });

      //Get Recent Transactions
      const recent = getRecentTransaction(transaction, 3);
      //Get Today Transactions
      const today = currencyFormatter(getTodayTransaction(transaction));
      const yesterday = currencyFormatter(getYesterdayTransaction(transaction));
      const lastSevenDaysData = getLastSevenDaysTransactions([], transaction);

      const lastSevenDaysTotal = currencyFormatter(
        _.sum(lastSevenDaysData?.ecg?.data),
      );
      const thisMonth = currencyFormatter(getThisMonthTransaction(transaction));
      const thisYear = getTransactionsByMonth([], transaction);

      const groupedTransactions = _.groupBy(transaction, "isProcessed");

      const topCustomers = getTopCustomers(transaction);

      const data = {
        recent,
        today,
        yesterday,
        lastSevenDaysTotal,
        lastSevenDays: {
          labels: lastSevenDaysData.labels,
          data: lastSevenDaysData.ecg?.data,
        },
        thisMonth,
        thisYear: {
          labels: thisYear?.labels,
          data: thisYear?.ecg?.data,
        },
        status: [
          groupedTransactions["0"]?.length ?? 0,
          groupedTransactions["1"]?.length ?? 0,
          groupedTransactions["1"]?.length ?? 0,
        ],
        topCustomers,
        meters: meters[0].count,
      };

      res.status(200).json(data);
    } catch (error) {
      return res
        .status(500)
        .json("An unknown error has occurred.Try again later.");
    }
  }),
);

router.get(
  "/airtime",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const [agent_airtime_transactions, airtime_transactions] =
      await Promise.all([
        knex("agent_transactions")
          .where({ year: moment().year(), type: "airtime" })
          .andWhere("status", "IN", ["completed", "refunded"])
          .select(
            "id",
            "total_amount as amount",
            "recipient as phonenumber",
            knex.raw("'airtime' as domain"),
            knex.raw("'Agent' as issuer"),
            "status",
            "year",
            "created_at as createdAt",
            "updated_at as updatedAt",
          )
          .orderBy("updated_at", "desc"),

        knex("vw_payments_airtime_transactions")
          .where({ year: moment().year() })
          .andWhere("status", "IN", ["completed", "refunded"])
          .select(
            "id",
            "amount",
            "email",
            "phonenumber",
            "service as domain",
            "info",
            "status",
            "issuerName as issuer",
            "year",
            "createdAt",
            "updatedAt",
          )
          .orderBy("updatedAt", "desc"),
      ]);

    const transaction = [
      ...airtime_transactions,
      ...agent_airtime_transactions,
    ].map(({ info, ...rest }) => {
      return {
        ...rest,
        info: safeJSON(info),
      };
    });

    //Get Recent Transactions
    const recent = getRecentTransaction(transaction, 3);

    //Get Today Transactions
    const today = currencyFormatter(getTodayTransaction(transaction));
    const yesterday = currencyFormatter(getYesterdayTransaction(transaction));
    const lastSevenDaysData = getLastSevenDaysTransactions([], transaction);

    const lastSevenDaysTotal = currencyFormatter(
      _.sum(lastSevenDaysData?.ecg?.data),
    );
    const thisMonth = currencyFormatter(getThisMonthTransaction(transaction));
    const thisYear = getTransactionsByMonth([], transaction);

    const topCustomers = getTopCustomers(transaction);

    const data = {
      recent,
      today,
      yesterday,
      lastSevenDaysTotal,
      lastSevenDays: {
        labels: lastSevenDaysData.labels,
        data: lastSevenDaysData.ecg?.data,
      },
      thisMonth,
      thisYear: {
        labels: thisYear?.labels,
        data: thisYear?.ecg?.data,
      },
      topCustomers,
    };

    res.status(200).json(data);
  }),
);

router.get(
  "/bundle",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const [agent_bundle_transactions, bundle_transactions] = await Promise.all([
      knex("agent_transactions")
        .where({ year: moment().year(), type: "bundle" })
        .andWhere("status", "IN", ["completed", "refunded"])
        .select(
          "id",
          "total_amount as amount",
          "recipient as phonenumber",
          knex.raw("'bundle' as domain"),
          knex.raw("'Agent' as issuer"),
          "status",
          "year",
          "created_at as createdAt",
          "updated_at as updatedAt",
        )
        .orderBy("createdAt", "desc"),

      knex("vw_payments_bundle_transactions")
        .where({ year: moment().year() })
        .andWhere("status", "IN", ["completed", "refunded"])
        .select(
          "id",
          "amount",
          "email",
          "phonenumber",
          "service as domain",
          "info",
          "status",
          "issuerName as issuer",
          "year",
          "createdAt",
          "updatedAt",
        )
        .orderBy("updatedAt", "desc"),
    ]);

    const transaction = [
      ...bundle_transactions,
      ...agent_bundle_transactions,
    ].map(({ info, ...rest }) => {
      return {
        ...rest,
        info: safeJSON(info),
      };
    });

    //Get Recent Transactions
    const recent = getRecentTransaction(transaction, 3);
    //Get Today Transactions
    const today = currencyFormatter(getTodayTransaction(transaction));
    const yesterday = currencyFormatter(getYesterdayTransaction(transaction));
    const lastSevenDaysData = getLastSevenDaysTransactions([], transaction);

    const lastSevenDaysTotal = currencyFormatter(
      _.sum(lastSevenDaysData?.ecg?.data),
    );
    const thisMonth = currencyFormatter(getThisMonthTransaction(transaction));
    const thisYear = getTransactionsByMonth([], transaction);

    const topCustomers = getTopCustomers(transaction);

    const data = {
      recent,
      today,
      yesterday,
      lastSevenDaysTotal,
      lastSevenDays: {
        labels: lastSevenDaysData.labels,
        data: lastSevenDaysData.ecg?.data,
      },
      thisMonth,
      thisYear: {
        labels: thisYear?.labels,
        data: thisYear?.ecg?.data,
      },
      topCustomers,
    };

    res.status(200).json(data);
  }),
);

router.get(
  "/email",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id: userId } = req.user;
    let { startDate, endDate } = req.query;

    // ---------------- VALIDATION ----------------
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "startDate and endDate required" });
    }

    const sDate = moment(startDate).startOf("day").toDate();
    const eDate = moment(endDate).endOf("day").toDate();

    if (!moment(sDate).isValid() || !moment(eDate).isValid()) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // ---------------- FETCH IN PARALLEL ----------------
    const [voucherRows, prepaidRows, airtimeRows, bundleRows, categories] =
      await Promise.all([
        // VOUCHERS
        knex("vw_payments_voucher_transactions")
          .where({
            userId: userId,
            active: 1,
          })
          // .whereIn("status", STATUS_FILTER)
          .whereBetween("createdAt", [sDate, eDate]),

        // PREPAID
        knex("vw_meter_payment_prepaid_transaction_view")
          .where({
            userId: userId,
            active: 1,
          })
          // .whereIn("status", STATUS_FILTER)
          .whereBetween("createdAt", [sDate, eDate]),

        // AIRTIME
        knex("vw_payments_airtime_transactions")
          .where({
            userId: userId,
            active: 1,
          })
          // .whereIn("status", STATUS_FILTER)
          .whereBetween("createdAt", [sDate, eDate]),

        // BUNDLE
        knex("vw_payments_bundle_transactions")
          .where({
            userId: userId,
            active: 1,
          })
          // .whereIn("status", STATUS_FILTER)
          .whereBetween("createdAt", [sDate, eDate]),

        // PRELOAD CATEGORIES (avoid N+1)
        knex("categories").select("id", "name as voucherType"),
      ]);

    // ---------------- MAP CATEGORIES ----------------
    const categoryMap = new Map(categories.map((c) => [c.id, c.voucherType]));

    // ---------------- TRANSFORM ----------------

    // VOUCHERS
    const vouchers = voucherRows.map((t) => {
      const info = safeJSON(t.info);

      const voucherType = categoryMap.get(info?.categoryId) || "Unknown";

      return {
        id: t.id,
        externalTransactionId: t?.externalTransactionId,
        type: _.upperCase(`${voucherType} ${info?.domain || ""}`),
        voucherType,
        domain: _.capitalize(t.service),
        quantity: info?.quantity || info?.paymentDetails?.quantity || 0,
        amount: info?.amount || info?.paymentDetails?.totalAmount || 0,
        phonenumber: t.phonenumber,
        mode: t.mode,
        email: t.email,
        downloadLink: info?.downloadLink || "",
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        status: t.status,
        isProcessed: Boolean(t?.isProcessed),
      };
    });

    // PREPAID
    const prepaid = prepaidRows.map((t) => {
      const info = safeJSON(t.info);
      const partner = safeJSON(t.partner);
      const service = _.capitalize(t?.service);
      // console.log(partner)

      return {
        id: t?.id,
        externalTransactionId: t?.externalTransactionId,
        type: `${service} Units`,
        domain: service,
        meter: t?.number || partner?.billRequest?.accountNumber,
        amount: t?.amount,
        charges: t?.charges,
        topup: t?.topup,
        phonenumber: t?.phonenumber,
        mode: t.mode,
        email: t?.email,
        downloadLink: info?.receiptUrl || "",
        createdAt: t?.createdAt,
        updatedAt: t?.updatedAt,
        isProcessed: Boolean(t?.isProcessed),
        status: t?.status,
      };
    });

    // AIRTIME
    const airtime = airtimeRows.map((t) => ({
      id: t?.id,
      externalTransactionId: t?.externalTransactionId,
      type: `${t?.domain}`,
      kind: `${t?.kind}`,
      domain: _.capitalize(t?.service),
      recipient: t?.recipient,
      amount: t?.amount,
      phonenumber: t?.phonenumber,
      mode: t.mode,
      email: t?.email,
      createdAt: t?.createdAt,
      status: t?.status,
      isProcessed: Boolean(t?.isProcessed),
    }));

    // BUNDLE
    const bundles = bundleRows.map((t) => ({
      id: t.id,
      externalTransactionId: t?.externalTransactionId,
      type: `${t.domain}`,
      domain: _.capitalize(t.service),
      kind: `${t?.bundleName}`,
      volume: t.volume,
      recipient: t.recipient,
      mode: t.mode,
      amount: t.amount,
      phonenumber: t.phonenumber,
      email: t.email,
      createdAt: t.createdAt,
      status: t.status,
      isProcessed: Boolean(t?.isProcessed),
    }));

    // console.log(prepaid);

    // ---------------- MERGE + SORT ----------------
    const result = _.orderBy(
      [...vouchers, ...prepaid, ...airtime, ...bundles],
      ["createdAt"],
      ["desc"],
    );

    return res.status(200).json(result);
  }),
);

router.get(
  "/status",
  // limit,
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { clientReference, type, transactionId } = req.query;
    // console.log(req.query);

    if (!clientReference || !type) {
      return res.status(400).json("Invalid Reference ID");
    }

    try {
      if (type === "prepaid" || type === "wallet") {
        const response = await getBrassicaTransactionStatus(
          transactionId,
          "debit",
        );
        // console.log("res",response.data);
        return res.status(200).json(response);
      }

      const response = await moneyStatus(clientReference);

      return res.status(200).json(response.data);
    } catch (error) {
      // console.log(error);
      return res
        .status(404)
        .json(error || "Transaction not found. Please try again later.");
    }
  }),
);

router.get(
  "/general",
  limit,
  asyncHandler(async (req, res) => {
    const { mobileNo, id } = req.query;

    if (!isValidUUID2(id) || !mobileNo) {
      return res.status(400).json("No results match your search");
    }

    const intMobileNo = getInternationalMobileFormat(mobileNo);

    try {
      const [voucherTransaction, prepaidTransaction, airtimeTransaction] =
        await Promise.all([
          knex("vw_payments_voucher_transactions")
            .select(
              "id",
              "externalTransactionId",
              "phonenumber",
              "mode",
              "service",
              "amount",
              "info",
              "createdAt",
              "status",
            )
            .where({ id: id })
            .orWhere({ externalTransactionId: id })
            .whereIn("phonenumber", [mobileNo, intMobileNo])
            .first(),

          knex("vw_meter_payment_prepaid_transaction_view")
            .select(
              "id",
              "externalTransactionId",
              "phonenumber",
              "mode",
              "service",
              "info",
              "amount",
              "createdAt",
              "status",
            )
            .where({ id: id })
            .orWhere({ externalTransactionId: id })
            .whereIn("phonenumber", [mobileNo, intMobileNo])
            .first(),
          knex("vw_payments_airtime_transactions")
            .select(
              "id",
              "externalTransactionId",
              "phonenumber",
              "mode",
              "service",
              "amount",
              "info",
              "amount",
              "createdAt",
              "status",
            )
            .where({ id: id })
            .orWhere({ externalTransactionId: id })
            .whereIn("phonenumber", [mobileNo, intMobileNo])
            .first(),
        ]);

      const transaction = _.compact([
        voucherTransaction,
        prepaidTransaction,
        airtimeTransaction,
      ])[0];

      if (_.isEmpty(transaction)) {
        return res.status(400).json("No results match your search!");
      }
      const { info, ...rest } = transaction;
      const details = safeJSON(info);

      const category = await knex("categories")
        .select("name", "type")
        .where("id", details?.categoryId)
        .first();

      res.status(200).json({
        id: rest.id,
        externalTransactionId: rest.externalTransactionId,
        phonenumber: rest.phonenumber,
        mode: rest.mode,
        service: rest.service,
        domain: details?.service,
        status: rest.status,
        categoryName: category?.name,
        categoryType: category?.type,
        amount: rest?.amount,
        downloadLink: details?.downloadLink,
        createdAt: rest.createdAt,
      });
    } catch (error) {
      return res
        .status(500)
        .json("An unknown error has occurred.Try again later.");
    }
  }),
);

router.get(
  "/:transactionId",
  limit,
  asyncHandler(async (req, res) => {
    const transactionId = req.params.transactionId;
    const { mobileNo } = req.query;

    if (!isValidUUID2(transactionId) || !mobileNo) {
      return res.status(400).json("No results match your search");
    }

    const transaction = await knex("vw_payments_voucher_transactions")
      .select("*")
      .where({ id: transactionId })
      .orWhere({ externalTransactionId: transactionId })
      .andWhere("status", "IN", ["completed", "refunded"])
      .first();

    if (
      _.isEmpty(transaction) ||
      transaction?.status !== "completed" ||
      mobileNo !== transaction?.phonenumber
    ) {
      return res.status(400).json("No results match your search!");
    }
    const { reference, partner, user, info, ...rest } = transaction;

    const category = await knex("categories")
      .select("name", "type")
      .where("id", details?.categoryId)
      .first();

    res.status(200).json({
      id: rest.id,
      externalTransactionId: rest.externalTransactionId,
      phonenumber: rest.phonenumber,
      email: rest.email,
      mode: rest.mode,
      service: rest.service,
      domain: details?.service,
      status: rest.status,
      categoryName: category?.name,
      categoryType: category?.type,
      amount: rest?.amount,
      downloadLink: details?.downloadLink,
      createdAt: rest.createdAt,
      info: safeJSON(info),
    });
  }),
);

router.get(
  "/refund/:id",
  limit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { category } = req.query;

    if (!isValidUUID2(id) || !category) {
      return res.status(400).json("No results match your search");
    }

    let transaction = {};
    switch (category) {
      case "voucher":
      case "ticket":
        const voucher_transaction = await knex(
          "vw_payments_voucher_transactions",
        )
          .select(
            "id",
            "paymentId",
            "paymentReference as reference",
            "mode",
            "info",
            "email",
            "amount",
            "phonenumber",
            "createdAt",
            "updatedAt",
            "status",
            "userId as user",
            knex.raw("DATE_FORMAT(updatedAt,'%D %M,%Y %r') as modifiedAt"),
          )
          .where({ id })
          .first();

        if (_.isEmpty(voucher_transaction))
          return res.status(400).json("No results match your search!");

        transaction = voucher_transaction;
        break;

      case "airtime":
        agent_airtime_transaction = await knex("agent_transactions")
          .select(
            "id",
            "info",

            knex.raw(`'Wallet' as mode`),
            knex.raw(`true as isAgent`),
            "reference",
            "total_amount as amount",
            "created_at as createdAt",
            "updated_at as updatedAt",
            "status",
            "user_id as user",
          )
          .where({ id: id, type: "airtime" })
          .first();

        airtime_transaction = await knex("vw_payments_airtime_transactions")
          .select(
            "id",
            "paymentId",
            "info",
            "mode",
            "email",
            "phonenumber",
            "paymentReference as reference",
            "amount",
            "createdAt",
            "updatedAt",
            "status",
            "userId as user",
          )
          .where({ id: id })
          .first();

        if (
          _.isEmpty(_.compact([airtime_transaction, agent_airtime_transaction]))
        )
          return res.status(400).json("No results match your search!");

        if (!_.isEmpty(agent_airtime_transaction)) {
          const agentDetails = await knex("vw_users_with_roles")
            .select("email", "phonenumber")
            .where({ id: agent_airtime_transaction?.user })
            .first();

          transaction = {
            ...agent_airtime_transaction,
            email: agentDetails?.email,
            phonenumber: agentDetails?.phonenumber,
          };
        } else {
          transaction = {
            ...airtime_transaction,
            info: safeJSON(airtime_transaction?.info),
          };
        }

        break;

      case "bundle":
        agent_bundle_transaction = await knex("agent_transactions")
          .select(
            "id",
            "reference",
            "info",
            "type",
            knex.raw(`'Wallet' as mode`),
            knex.raw(`true as isAgent`),
            "reference",
            "total_amount as amount",
            "created_at as createdAt",
            "updated_at as updatedAt",
            "status",
            "user_id as user",
          )
          .where({ id: id, type: "bundle" })
          .first();
        bundle_transaction = await knex("vw_payments_bundle_transactions")
          .select(
            "id",
            "paymentId",
            "paymentReference as reference",
            "email",
            "phonenumber",
            "info",
            "mode",
            "amount",
            "status",
            "userId as user",
            "createdAt",
            "updatedAt",
          )
          .where({ id: id })
          .first();

        if (
          _.isEmpty(_.compact([bundle_transaction, agent_bundle_transaction]))
        )
          return res.status(400).json("No results match your search!");

        if (!_.isEmpty(agent_bundle_transaction)) {
          const agentDetails = await knex("vw_users_with_roles")
            .select("email", "phonenumber")
            .where({ id: agent_bundle_transaction?.user })
            .first();

          transaction = {
            ...agent_bundle_transaction,
            email: agentDetails?.email,
            phonenumber: agentDetails?.phonenumber,
          };
        } else {
          transaction = {
            ...bundle_transaction,
            info: safeJSON(bundle_transaction?.info),
          };
        }
        break;
      case "prepaid":
        const prepaid_transaction = await knex(
          "vw_meter_payment_prepaid_transaction_view",
        )
          .select(
            "id",
            "paymentId",
            "paymentReference as reference",
            "info",
            "email",
            "phonenumber",
            "mode",
            "amount",
            "status",
            "userId as user",
            "createdAt",
            "updatedAt",
          )
          .where({ id })
          .first();

        if (_.isEmpty(prepaid_transaction))
          return res.status(400).json("No results match your search!");

        transaction = prepaid_transaction;

        break;

      default:
        transaction = {};
    }

    if (_.isEmpty(transaction)) {
      return res.status(400).json("No results match your search!");
    }
    res.status(200).json(transaction);
  }),
);

router.post(
  "/refund",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: ISSUER_ID, name } = req.user;
    const {
      id,
      paymentId,
      category,
      amount,
      mode,
      phonenumber,
      email,
      user,
      isAgent,
    } = req.body;

    const phoneInfo = getPhoneNumberInfo(phonenumber);
    const transaction_reference = randomBytes(24).toString("hex");

    const tranx = await knex.transaction();
    try {
      if (mode === "Wallet") {
        let user_balance = {};
        let user_credit = {};

        user_balance = await tranx("wallets")
          .where("user_id", user)
          .select("id", "amount")
          .first();

        user_credit = await tranx("wallets").where("user_id", user).increment({
          amount: amount,
        });

        const status = user_credit === 1 ? "refunded" : "completed";

        if (isAgent) {
          await tranx("agent_transactions").where("id", id).update({
            status,
            refunder: ISSUER_ID,
          });
        } else {
          await tranx("payments").where("id", paymentId).update({
            status,
            refunder: ISSUER_ID,
          });
        }

        if (status === "refunded") {
          await sendSMS(
            `Dear Customer,An amount of ${currencyFormatter(
              amount,
            )} has been refunded into to your wallet account for failed ${category} transaction.`,
            phoneInfo.phoneNumber,
          );

          await tranx("notifications").insert({
            id: generateId(),
            user_id: user,
            type: "general",
            title: `Failed ${category} Transaction Refund`,
            body: `An amount of ${currencyFormatter(
              amount,
            )} has been refunded to your wallet account for failed ${category} transaction.`,
          });

          await tranx("wallet_transactions").insert({
            id: generateId(),
            user_id: user,
            wallet_id: user_balance?.id,
            issuer: ISSUER_ID,
            type: "credit",
            wallet_amount: Number(user_balance?.amount),
            amount,
            comment: `Wallet money refund for failed ${category} transaction`,
            attachment: null,
            status: "completed",
          });
        }

        await tranx.commit();
        return res.status(200).json("Completed refund into wallet account");
      } else {
        const payment = {
          transactionId: id,
          category,
          phonenumber: phoneInfo.phoneNumber,
          email,
          amount: Number(amount).toFixed(2),
          provider:
            phoneInfo.providerName === "MTN"
              ? "mtn-gh"
              : phoneInfo.providerName === "Vodafone"
                ? "vodafone-gh"
                : phoneInfo.providerName === "AirtelTigo"
                  ? "tigo-gh"
                  : "",
          transaction_reference,
          refunder: ISSUER_ID,
        };

        const { ResponseCode, Data } = await sendMoneyToCustomer(payment);

        if (["0000", "0001"].includes(ResponseCode)) {
          await tranx.commit();
          return res.status(200).json(Data?.Description);
        } else {
          await tranx.rollback();
          return res.status(400).json(Data?.Description);
        }
      }
    } catch (error) {
      await tranx.rollback();
      console.log(error);
      return res
        .status(500)
        .json("An error has occurred.Could not refund money!");
    }
  }),
);

// //@ Payment callback
// router.post(
//   "/feedback/callback/:category/:id",
//   cors(corsOptions),
//   limit,
//   asyncHandler(async (req, res) => {
//     const {id:userId}=req.user
//     const { uid } = req.query;
//     const { id, category } = req.params;

//     if (!id || !category) {
//       return res.sendStatus(204);
//     }
//     const { ResponseCode, Data } = req.body;

//     const status =
//       ResponseCode === "0000"
//         ? "refunded"
//         : ResponseCode === "0001"
//           ? "pending"
//           : "completed";

//     const tranx = await knex.transaction();
//     const employee = await knex("vw_users_with_roles")
//       .where("id", uid)
//       .select("id",'name')
//       .first();
//     let tx = { user: "", phonenumber: "" };

//     try {

//       await tranx("payments")
//         .where("id", id)
//         .update({
//           partner: JSON.stringify(Data),
//           status,
//           refunder: employee?.name,
//         });

//       if (category === "prepaid") {

//         tx = await tranx("vw_meter_payment_prepaid_transaction_view")
//           .where("id", id)
//           .select("phonenumber", "userId")
//           .first();
//       }

//       if (category === "voucher" || category === "ticket") {

//         tx = await tranx("vw_payments_voucher_transactions")
//           .where("id", id)
//           .select("phonenumber", "userId")
//           .first();
//       }

//       if (category === "airtime") {

//         tx = await tranx("vw_payments_airtime_transactions")
//           .where("id", id)
//           .select("phonenumber", "userId")
//           .first();
//       }

//       if (category === "bundle") {

//         tx = await tranx("vw_payments_bundle_transactions")
//           .where("id", id)
//           .select("phonenumber", "userId")
//           .first();
//       }

//       if (status === "refunded") {
//         await tranx("notifications").insert([{
//           id: generateId(),
//           user_id: userId,
//           type: "general",
//           title: "Money Refund Completed",
//           body: Data?.Description,
//         },
//       {
//           id: generateId(),
//           user_id: tx?.user,
//           type: "general",
//           title: "Money Refund",
//           body: `An amount of ${currencyFormatter(
//             Data?.Amount,
//           )} has been refunded into your mobile money wallet .`,
//         }
//       ]);

//         await sendSMS(
//           `Dear Customer,An amount of ${currencyFormatter(
//             Data?.Amount,
//           )} has been refunded into to your mobile money wallet.`,
//           getInternationalMobileFormat(tx?.phonenumber),
//         );
//       }

//       if (status === "pending") {
//         await tranx("notifications").insert({
//           id: generateId(),
//           user_id: userId,
//           type: "general",
//           title: "Money Refund Pending",
//           body: Data?.Description,
//         });
//       }

//       if (status === "completed") {
//         await tranx("notifications").insert({
//           id: generateId(),
//           user_id: userId,
//           type: "general",
//           title: "Money Refund Failed",
//           body: Data?.Description,
//         });
//       }
//       await tranx.commit();
//     } catch (error) {
//       console.log(error);
//       await tranx.rollback();
//       return res.sendStatus(204);
//     }

//     res.sendStatus(204);
//   }),
// );

//@ Payment callback

router.post(
  "/feedback/callback/:category/:id",
  cors(corsOptions),
  limit,
  asyncHandler(async (req, res) => {
    const { id, category } = req.params;
    const { uid } = req.query; // employee ID (refunder)
    const { ResponseCode, Data } = req.body;

    // --- Input validation ---
    if (!id || !category) {
      return res.status(400).json("Missing payment ID or category");
    }

    // Map categories to their respective view names
    const categoryViewMap = {
      prepaid: "vw_meter_payment_prepaid_transaction_view",
      voucher: "vw_payments_voucher_transactions",
      ticket: "vw_payments_voucher_transactions", // ticket uses same view
      airtime: "vw_payments_airtime_transactions",
      bundle: "vw_payments_bundle_transactions",
    };

    if (!categoryViewMap[category]) {
      return res.status(400).json("Invalid category");
    }

    // Determine payment status based on ResponseCode
    const status =
      ResponseCode === "0000"
        ? "refunded"
        : ResponseCode === "0001"
          ? "pending"
          : "completed";

    // --- Transaction to update payment and insert notifications ---
    const trx = await knex.transaction();

    try {
      // 1. Fetch employee details (if uid provided)
      let employeeName = null;
      if (uid) {
        const employee = await trx("vw_users_with_roles")
          .where("id", uid)
          .select("name")
          .first();
        employeeName = employee?.name || null;
      }

      // 2. Update the payment record
      await trx("payments")
        .where("id", id)
        .update({
          partner: JSON.stringify(Data),
          status,
          refunder: employeeName,
        });

      // 3. Fetch transaction details (phonenumber, userId) from the appropriate view
      const viewName = categoryViewMap[category];
      const txDetails = await trx(viewName)
        .where("id", id)
        .select("phonenumber", "userId")
        .first();

      // 4. Prepare notifications based on status
      const notifications = [];

      // Common fields for notifications
      const baseNotification = {
        id: generateId(),
        type: "general",
      };

      if (status === "refunded") {
        // Notification for the employee (who processed the refund)
        if (employeeName) {
          notifications.push({
            ...baseNotification,
            user_id: uid, // assuming uid is employee ID
            title: "Money Refund Completed",
            body: Data?.Description,
          });
        }

        // Notification for the customer
        if (txDetails?.userId) {
          notifications.push({
            ...baseNotification,
            user_id: txDetails.userId,
            title: "Money Refund",
            body: `An amount of ${currencyFormatter(Data?.Amount)} has been refunded into your mobile money wallet.`,
          });
        }
      } else if (status === "pending") {
        // Notification for the employee (if applicable)
        if (employeeName) {
          notifications.push({
            ...baseNotification,
            user_id: uid,
            title: "Money Refund Pending",
            body: Data?.Description,
          });
        }
      } else if (status === "completed") {
        // Notification for the employee (if applicable)
        if (employeeName) {
          notifications.push({
            ...baseNotification,
            user_id: uid,
            title: "Money Refund Failed",
            body: Data?.Description,
          });
        }
      }

      // Insert notifications if any
      if (notifications.length) {
        await trx("notifications").insert(notifications);
      }

      // Commit transaction
      await trx.commit();

      // 5. Send SMS outside transaction (don't rollback if SMS fails)
      if (status === "refunded" && txDetails?.phonenumber) {
        const smsMessage = `Dear Customer, An amount of ${currencyFormatter(Data?.Amount)} has been refunded into your mobile money wallet.`;
        // Send SMS asynchronously (fire and forget) to avoid blocking response
        sendSMS(
          smsMessage,
          getInternationalMobileFormat(txDetails.phonenumber),
        ).catch((err) => {
          console.error("SMS sending failed:", err.message);
        });
      }

      // Return success (204 No Content)
      res.status(204).send();
    } catch (error) {
      // Rollback transaction on error
      await trx.rollback();

      // console.error("Payment callback error:", {
      //   id,
      //   category,
      //   uid,
      //   ResponseCode,
      //   error: error.message,
      //   stack: error.stack,
      // });

      // Return 500 Internal Server Error
      res.status(500).json("An internal error occurred");
    }
  }),
);

router.post(
  "/report/history",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { startDate, endDate, transactions, type } = req.body;

    let template = "";
    switch (type) {
      case "All":
        template = await generateHTMLTemplate(transactions, "transactions.ejs");
        break;
      case "Voucher":
        template = await generateHTMLTemplate(
          transactions,
          "voucher_transactions.ejs",
        );
        break;
      case "Ticket":
        template = await generateHTMLTemplate(
          transactions,
          "voucher_transactions.ejs",
        );
        break;
      case "Prepaid":
        template = await generateHTMLTemplate(
          transactions,
          "prepaid_transactions.ejs",
        );
        break;
      case "Airtime":
        template = await generateHTMLTemplate(
          transactions,
          "airtime_transactions.ejs",
        );
        break;
      case "Bundle":
        template = await generateHTMLTemplate(
          transactions,
          "bundle_transactions.ejs",
        );
        break;
      default:
        template = await generateHTMLTemplate(transactions, "transactions.ejs");
    }

    const id = generateId();

    const result = await generateTransactionReport(
      template,
      id,
      `${type}-report`,
    );
    if (result) {
      const body = ` <div class="container">
  <h1>Transactional Report</h1>
  <p>Dear Customer,</p>
  <p>Attached is your wallet transactional report from the period ${moment(
    startDate,
  ).format("lll")} to ${moment(endDate).format(
    "lll",
  )}. Please review the details below:</p>
  <p>If you have any questions or concerns regarding this report, please feel free to contact us.</p>
  <p>Thank you for your business!</p>
  <p>Sincerely,<br>Gab Powerful Consults</p>
  </div>`;

      const downloadLink = await uploadFiles(result, "reports");

      if (process.env.NODE_ENV === "production") {
        await sendReportMail(
          // 'nicktest701@gmail.com',
          process.env.MAIL_CLIENT_USER,
          mailTextShell(body),
          result,
          "Transaction Report",
        );
      }

      return res.status(200).json(downloadLink);
    }
  }),
);

router.put(
  "/delete",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (_.isEmpty(ids)) {
      return res.status(400).json("Invalid Request");
    }

    await knex("voucher_transactions").where("_id", "IN", ids).update({
      active: 0,
    });
    await knex("prepaid_transactions").where("_id", "IN", ids).update({
      active: 0,
    });
    await knex("airtime_transactions").where("_id", "IN", ids).update({
      active: 0,
    });
    await knex("bundle_transactions").where("_id", "IN", ids).update({
      active: 0,
    });

    //logs
    await knex("activity_logs").insert({
      employee_id: _id,
      title: "Removed multiple transactions!",
      severity: "error",
    });

    res.sendStatus(204);
  }),
);

router.get(
  "/agent/transaction",
  verifyToken,
  verifyAdminORAgent,
  asyncHandler(async (req, res) => {
    const { id, email, isAdmin } = req.user;
    const { sort, startDate, endDate, type, report } = req.query;

    const { start, end, error } = parseDateRange(startDate, endDate);
    if (error) {
      return res.status(400).json("Invalid date range");
    }

    let modifiedAirtimeTransaction = [];

    let query = knex("agent_transactions")
      .select(
        "id",
        "user_id as userId",
        "reference",
        "type",
        "recipient",
        "provider",
        "info",
        "commission",
        "amount as amt",
        "total_amount as amount",
        "year",
        "active",
        "status",
        "created_at as createdAt",
        "updated_at as updatedAt",
        knex.raw(`DATE_FORMAT(created_at,"%D %M,%Y %r") as purchasedAt`),
      )
      .whereBetween("created_at", [start, end])
      .orderBy("updated_at", "desc");

    if (!isAdmin) {
      query.where({ user_id: id });
    }
    if (["airtime", "bundle"].includes(type)) {
      query.where({ type: type });
    }

    const modifiedTransactions = await query;

    const transactions = modifiedTransactions.map(({ info, ...rest }) => {
      return {
        ...rest,
        info: safeJSON(info),
      };
    });

    if (report) {
      const id = generateId();
      const template = await generateHTMLTemplate(
        {
          transactions,
          type,
          start: moment(start).format("lll"),
          end: moment(end).format("lll"),
        },
        "agent_transactions.ejs",
      );

      const result = await generateTransactionReport(
        template,
        id,
        `${type || "all"}-report`,
      );

      if (result) {
        const body = ` <div class="container">
  <h1>Transactional Report</h1>
  <p>Hello,</p>
  <p>Attached is your transactional report from the period ${start} to ${end}. Please review the details below:</p>
  <p>If you have any questions or concerns regarding this report, please feel free to contact us.</p>
  <p>Thank you for your business!</p>
  <p>Sincerely,<br>Gab Powerful Consults</p>
  </div>`;

        const downloadLink = await uploadFiles(result, "reports");
        const selectedEmail = isAdmin ? process.env.MAIL_CLIENT_USER : email;
        await sendReportMail(
          selectedEmail,
          mailTextShell(body),
          result,
          " Transaction Report",
        );

        return res.status(200).json(downloadLink);
      }
    }

    switch (sort) {
      case "today":
        modifiedAirtimeTransaction = getTodayTransactionArray(transactions);

        break;
      case "yesterday":
        modifiedAirtimeTransaction = getYesterdayTransactionArray(transactions);

        break;

      case "week":
        modifiedAirtimeTransaction =
          getLastSevenDaysTransactionsArray(transactions);

        break;
      case "month":
        modifiedAirtimeTransaction = getThisMonthTransactionArray(transactions);

        break;
      case "lmonth":
        modifiedAirtimeTransaction = getLastMonthTransactionArray(transactions);

        break;
      case "year":
        modifiedAirtimeTransaction = getThisYearTransactionArray(transactions);
        break;
      case "lyear":
        modifiedAirtimeTransaction = getLastYearTransactionArray(transactions);

        break;
      default:
        modifiedAirtimeTransaction = [...transactions];
    }

    res.status(200).json([...modifiedAirtimeTransaction]);
  }),
);

// @route GET api/agent airtime
router.get(
  "/agent/airtime",
  verifyToken,
  verifyAdminORAgent,
  asyncHandler(async (req, res) => {
    const { id, isAdmin } = req.user;
    const { type } = req.query;
    let transactions = [];

    if (isAdmin) {
      transactions = await knex("agent_transactions")
        .select(
          "id",
          "info",
          "type",
          "recipient as phonenumber",
          "type as domain",
          "commission",
          "total_amount as amount",
          "created_at as createdAt",
          "updated_at as updatedAt",
          "year",
        )
        .where({ type, status: "completed" })
        .orderBy("createdAt", "desc");
    } else {
      transactions = await knex("agent_transactions")
        .select(
          "id",
          "info",
          "type",
          "recipient as phonenumber",
          "type as domain",
          "commission",
          "total_amount as amount",
          "created_at as createdAt",
          "updated_at as updatedAt",
          "year",
        )
        .where({ user_id: id, type, status: "completed" })
        .orderBy("createdAt", "desc");
    }

    //Get Recent Transactions
    const recent = getRecentTransaction(transactions, 3);
    //Get Today Transactions
    const today = getTodayTransaction(transactions);
    const yesterday = getYesterdayTransaction(transactions);
    const lastSevenDaysData = getLastSevenDaysTransactions([], transactions);

    const lastSevenDaysTotal = _.sum(lastSevenDaysData?.ecg?.data);

    const thisMonth = getThisMonthTransaction(transactions);
    const thisYear = getTransactionsByMonth([], transactions);

    const topCustomers = getTopCustomers(transactions);
    const totalCommission = _.sumBy(transactions, (item) =>
      Number(item?.commission),
    );

    res.status(200).json({
      recent,
      today,
      yesterday,
      lastSevenDaysTotal,
      lastSevenDays: {
        labels: lastSevenDaysData.labels,
        data: lastSevenDaysData.ecg?.data,
      },
      thisMonth,
      thisYear: {
        labels: thisYear?.labels,
        data: thisYear?.ecg?.data,
      },
      topCustomers,
      commission: totalCommission,
    });
  }),
);

router.get(
  "/agent/total-sales",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const year = moment().year();
    const transactions = await knex("agent_transactions")
      .select(
        "id",
        "info",
        "type",
        "recipient as phonenumber",
        "type as domain",
        "total_amount as amount",
        "created_at as createdAt",
        "updated_at as updatedAt",
        "year",
      )
      .where({ user_id: id, year: year })
      .andWhere("status", "IN", ["completed", "refunded"])
      .orderBy("createdAt", "desc");

    const modifiedTransactions = transactions.map(({ info, ...rest }) => {
      return {
        ...rest,
        // info: JSON.parse(info),
      };
    });
    const groupedTransactions = _.groupBy(modifiedTransactions, "type");
    const airtimeTransaction = groupedTransactions?.airtime;
    const bundleTransaction = groupedTransactions?.bundle;

    //GET Total numbers of transactions
    const airtimeCount = airtimeTransaction?.length;
    const bundleCount = bundleTransaction?.length;

    const count = {
      labels: ["Airtime Transfer", "Data Bundle"],
      data: [airtimeCount, bundleCount],
    };

    const recents = _.orderBy(
      [
        ...getRecentTransaction(airtimeTransaction, 3),
        ...getRecentTransaction(bundleTransaction, 3),
      ],
      "createdAt",
      "desc",
    );

    //Get Airtime Total Amount
    const airtimeTotal = _.sum(
      _.map(airtimeTransaction, (item) => Number(item?.amount)),
    );
    //Get Bundlet Total Amount
    const bundleTotal = _.sum(
      _.map(bundleTransaction, (item) => Number(item?.amount)),
    );

    const grandTotal = {
      airtime: airtimeTotal,
      bundle: bundleTotal,
      total: Number(airtimeTotal + bundleTotal),
    };

    //GET Total Sales today

    const today = {
      airtime: getTodayTransaction(airtimeTransaction),
      bundle: getTodayTransaction(bundleTransaction),
    };

    //GROUP transactions by Week
    const airtimeSevenDays = getLastSevenDaysTransactions(
      bundleTransaction,
      airtimeTransaction,
    );
    airtimeSevenDays.bundle = airtimeSevenDays.voucher;
    airtimeSevenDays.airtime = airtimeSevenDays.ecg;

    //GROUP transactions by month
    const airtimeByMonth = getTransactionsByMonth(
      bundleTransaction,
      airtimeTransaction,
    );
    airtimeByMonth.bundle = airtimeByMonth.voucher;
    airtimeByMonth.airtime = airtimeByMonth.ecg;

    res.status(200).json({
      totalSales: grandTotal,
      totalCount: count,
      recents,
      today,
      sevenDays: airtimeSevenDays,
      transactionByMonth: airtimeByMonth,
    });
  }),
);

router.get(
  "/agent/report",
  verifyToken,
  verifyAdminORAgent,
  asyncHandler(async (req, res) => {
    const { id, isAdmin } = req.user;
    const { year, type } = req.query;

    let query = knex("agent_transactions")
      .select(
        "id",
        "user_id as userId",
        "reference",
        "type",
        "recipient",
        "provider",
        "info",
        "commission",
        "amount as amt",
        "total_amount as amount",
        "year",
        "active",
        "status",
        "created_at as createdAt",
        "updated_at as updatedAt",
      )
      .where({
        year,
        status: "completed",
      });

    if (["airtime", "bundle"].includes(type)) {
      query.where({ type });
    }

    if (!isAdmin) {
      query.where({
        user_id: id,
      });
    }

    const transactions = await query.orderBy("createdAt", "desc");

    const groupedTransactions = _.groupBy(transactions, "type");
    const modifiedAirtimeTransaction = groupedTransactions?.airtime ?? [];
    const modifiedBundleTransaction = groupedTransactions?.bundle ?? [];

    switch (type) {
      case "All":
        return res.status(200).json({
          airtime: getTransactionsArrayByMonth(modifiedAirtimeTransaction),
          bundle: getTransactionsArrayByMonth(modifiedBundleTransaction),
        });
      case "Airtime":
        return res.status(200).json({
          report: getTransactionsArrayByMonth(modifiedAirtimeTransaction),
        });

      case "Bundle":
        return res.status(200).json({
          report: getTransactionsArrayByMonth(modifiedBundleTransaction),
        });
      default:
        return res.status(400).json("Invalid report type");
    }
  }),
);
router.get(
  "/agents/transactions",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const id = req.query.id;
    const agentsWallets = await knex("agent_transactions")
      .select(
        "id",
        "type",
        "recipient",
        "amount",
        "total_amount as totalAmount",
        "commission",
        "created_at as createdAt",
        "status",
      )
      .where("user_id", id)
      .orderBy("created_at", "desc");

    return res.status(200).json(agentsWallets);
  }),
);

router.get(
  "/agents/wallet",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const agentsWallets = await knex("wallets")
      .join("users", "wallets.agent_id", "=", "users.id")
      .select(
        "users.id as _id",
        "wallets.amount as amount",
        "wallets.agent_key as clientID",
        "users.email as email",
        "users.phonenumber as phonenumber",
        knex.raw("CONCAT(firstname,' ',lastname) as name"),
        knex.raw(
          "DATE_FORMAT(wallets.updatedAt,'%D %M %Y . %r' ) as updatedAt",
        ),
      );

    return res.status(200).json(agentsWallets);
  }),
);

router.get(
  "/users/transactions",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.query;

    const [
      bundle_transactions,
      airtime_transactions,
      voucher_transactions,
      prepaid_transactions,
    ] = await Promise.all([
      //Bundle
      knex("vw_payments_bundle_transactions")
        .select(
          "id",
          "userId",
          "kind",
          "volume",
          "recipient",
          "amount",
          "service as domain",
          "type",
          "email",
          "phonenumber",
          "status",
          "isProcessed",
          "createdAt",
          "createdAt as purchaseDate",
          "active",
        )
        .where({ userId: id, active: 1 }),
      // .andWhere("status", "IN", ["completed", "pending", "refunded"]),

      //Airtime
      knex("vw_payments_airtime_transactions")
        .select(
          "id",
          "userId",
          "kind",
          "recipient",
          "amount",
          "service as domain",
          "type",
          "email",
          "phonenumber",
          "status",
          "isProcessed",
          "createdAt",
          "createdAt as purchaseDate",
          "active",
        )
        .where({ userId: id, active: 1 }),
      // .andWhere("status", "IN", ["completed", "pending", "refunded"]),
      //Vouchers
      knex("vw_payments_voucher_transactions")
        .select(
          "id",
          "userId",
          "email",
          "phonenumber",
          "service as domain",
          "info",
          "amount",
          "createdAt",
          "updatedAt",
          "status",
          "year",
        )
        .where({ userId: id, active: 1 }),
      // .andWhere("status", "IN", ["completed", "pending", "refunded"]),
      // .andWhereBetween("createdAt", [sDate, eDate]),
      //Electricity
      knex("vw_meter_payment_prepaid_transaction_view")
        // .andWhere("status", "IN", ["completed", "refunded"])
        .select(
          "id",
          "number as meter",
          "type",
          "service as domain",
          "phonenumber",
          "email",
          "topup",
          "charges",
          "amount",
          "status",
          "isProcessed",
          "info",
          "createdAt",
          "updatedAt",
        )
        .where({ userId: id, active: 1 }),
      // .andWhere("status", "IN", ["completed", "pending", "refunded"]),
      // .andWhereBetween("createdAt", [sDate, eDate]),
    ]);

    const transactions = voucher_transactions?.map(({ info, ...rest }) => {
      return {
        ...rest,
        info: safeJSON(info),
      };
    });

    const modifiedTransaction = transactions.map(async (transaction) => {
      const category = await knex("categories")
        .select("name as voucherType")
        .where("id", transaction?.info?.categoryId)
        .limit(1);

      return {
        id: transaction?.id,
        voucherType: category[0].voucherType,
        domain: transaction?.domain,
        downloadLink: transaction?.info?.downloadLink,
        phonenumber: transaction?.phonenumber,
        email: transaction.email,
        type: _.upperCase(`${category[0].voucherType} ${transaction?.domain}`),
        quantity:
          transaction?.info?.quantity ||
          transaction?.info?.paymentDetails?.quantity,
        amount: transaction?.amount,
        createdAt: transaction?.createdAt,
        updatedAt: transaction?.updatedAt,
        status: transaction?.status,
      };
    });

    const vouchers = await Promise.all(modifiedTransaction);

    const modifiedECGTransaction = prepaid_transactions.map((transaction) => {
      const { info: transInfo, ...rest } = transaction;
      const info = safeJSON(transaction?.info);
      return {
        ...rest,
        downloadLink: info?.downloadLink,
        status: transaction?.status,
      };
    });

    res
      .status(200)
      .json(
        _.orderBy(
          [
            ...vouchers,
            ...modifiedECGTransaction,
            ...airtime_transactions,
            ...bundle_transactions,
          ],
          "createdAt",
          "updatedAt",
          "desc",
        ),
      );
  }),
);

router.get(
  "/:role/wallet/transactions",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { startDate, endDate, report } = req.query;

    const { role } = req.params;
  

    if (role !== "users" && role !== "agents") {
      return res.status(400).json("Invalid role");
    }

    const roleCode =
      role === "users" ? process.env.USER_ID : process.env.AGENT_ID;
    const roleId = await knex("roles")
      .select("id")
      .where("code", roleCode)
      .first();
   

    const sDate = moment(startDate).format("YYYY-MM-DD");
    const eDate = moment(endDate).format("YYYY-MM-DD");

    const transactions = await knex("wallet_transactions")
      .join("users", "wallet_transactions.user_id", "=", "users.id")
      .select(
        "wallet_transactions.id as id",
        "wallet_transactions.user_id as userId",
        "wallet_transactions.amount as amount",
        "wallet_transactions.type as type",
        "wallet_transactions.comment as comment",
        "wallet_transactions.attachment as attachment",
        "wallet_transactions.status as status",
        "wallet_transactions.issuer as issuerId",
        "wallet_transactions.created_at as createdAt",
        "users.fullname as name",
        "users.role_id as role",
      )
      .where("users.role_id", roleId?.id)
      .whereBetween("wallet_transactions.created_at", [startDate, endDate])
      .orderBy("wallet_transactions.created_at", "desc");
    // console.log(transactions);

    if (report && report === "true") {
      if (transactions.length === 0) {
        return res.status(200).json("No data found");
      }

      const data = {
        person: {
          startDate: startDate,
          endDate: endDate,
          type: role === "users" ? "Users" : "Agents",
        },
        transactions: transactions,
      };

      const walletTemplate = await generateHTMLTemplate(
        data,
        "wallet_report.ejs",
      );
      const id = generateId();

      const result = await generateTransactionReport(
        walletTemplate,
        id,
        "wallet-report",
      );

      if (result) {
        const body = ` <div class="container">
    <h1>Transactional Report</h1>
    <p>Dear ${transactions[0]?.name},</p>
    <p>Attached is your wallet transactional report for the period ${sDate} to ${eDate}. Please review the details below:</p>
    <p>If you have any questions or concerns regarding this report, please feel free to contact us.</p>
    <p>Thank you for your business!</p>
    <p>Sincerely,<br>Gab Powerful Consults</p>
    </div>`;

        const downloadLink = await uploadFiles(result, "reports");

        res.status(200).json(downloadLink);

        setImmediate(async () => {
          if (process.env.NODE_ENV === "production") {
            await sendReportMail(
              process.env.MAIL_CLIENT_USER,
              mailTextShell(body),
              result,
              "Wallet Transaction Report",
            );
          }
        });
      }
    } else {
      res.status(200).json(transactions);
    }
  }),
);
router.get(
  "/users/wallet/transactions/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const transactions = await knex("vw_wallet_transactions_issuer_view")
      .where({
        userId: id,
        // type: "credit",
      })
      .select(
        "id",
        "userId",
        "amount",
        "wallet",
        "type",
        "comment",
        "status",
        "issuerId",
        "issuerName",
        "createdAt",
      )
      .orderBy("createdAt", "desc");

    res.status(200).json(transactions);
  }),
);

module.exports = router;
