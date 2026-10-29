const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const generateId = require("../config/generateId");

//model
const verifyScanner = require("../middlewares/verifyScanner");
const { verifyToken } = require("../middlewares/verifyToken");
//
const knex = require("../db/knex");
const { formatPercentage } = require("../config/formatter");
const {
  getLastSevenDaysTicketTransactions,
  getRecentTicketTransaction,
  getTodayScannedTicketsTransaction,
  getScannedTicketsByMonth,
  getTopScannedTickets,
  getTodayTransactionArray,
  getYesterdayTransactionArray,
  getLastSevenDaysTransactionsArray,
  getThisMonthTransactionArray,
  getLastMonthTransactionArray,
  getThisYearTransactionArray,
  getLastYearTransactionArray,
  getRangeTransactions,
} = require("../config/transactionSummary");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { safeJSON } = require("../config/helpers");
const logger = require("../utils/logger");

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const flagOn = (name) => String(process.env[name] ?? "").toLowerCase() === "true";
const MAX_SCAN_ID_LENGTH = 20; // scanned_tickets.id is varchar(20)
const MAX_SYNC_BATCH = 1000;

const toDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const parseJSON = (value, fallback = null) => {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// Categories a verifier is assigned to (their assigned_tickets rows).
const getAssignedCategoryIds = async (db, userId) => {
  const rows = await db("assigned_tickets")
    .select("category_id")
    .where("verifier_id", userId);
  return _.uniq(_.map(rows, "category_id"));
};

// voucher_transactions.vouchers is an array of the voucher ids sold in that
// transaction (stored as JSON text).
const transactionIncludesVoucher = (vouchers, voucherId) => {
  const list = parseJSON(vouchers, null);
  return Array.isArray(list) && list.map(String).includes(voucherId);
};

const buildVerifiedResponse = async (db, voucherId, scan) => {
  const row = await db("scanned_tickets_vouchers_view")
    .where({ voucherId })
    .first();
  return { ...(row ?? { _id: scan?.id, voucherId }), isVerified: true };
};

router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { verifier, category } = req.query;
    let tickets = [];

    if (verifier) {
      tickets = await knex("vw_ticket_category_user_view")
        .select("*")
        .where({
          verifierId: verifier,
          active: 1,
        })
        .orderBy("createdAt", "desc");
    } else if (category) {
      tickets = await knex("vw_ticket_category_user_view")
        .select("*")
        .where("categoryId", category)
        .orderBy("createdAt", "desc");
    } else {
      tickets = await knex("vw_ticket_category_user_view")
        .select("*")
        .orderBy("createdAt", "desc");
    }

    if (_.isEmpty(tickets)) {
      return res.status(200).json([]);
    }
    const modifiedTickets = tickets.map(({ scope, ...rest }) => {
      return {
        ...rest,
        type: safeJSON(scope),
      };
    });

    res.status(200).json(modifiedTickets);
  }),
);

router.get(
  "/vouchers",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { category } = req.query;

    if (!isNonEmptyString(category)) {
      return res.status(400).json("Invalid Request!");
    }

    // Vouchers (with pin + serial) are only handed to verifiers assigned to
    // that category.
    if (!req.user.isAdmin) {
      const assigned = await getAssignedCategoryIds(knex, req.user.id);
      if (!assigned.includes(category)) {
        return res.status(403).json("You are not assigned to this category.");
      }
    }

    const vouchers = await knex("vouchers")
      .select(
        "vouchers.id",
        "categories.id as categoryId",
        "categories.category",
        "categories.voucherType",
        "vouchers.type",
        "vouchers.pin",
        "vouchers.serial",
        "vouchers.status",
        "vouchers.createdAt",
        "vouchers.updatedAt",
      )
      .join("categories", "vouchers.category_id", "categories.id")
      .where("vouchers.category_id", category);

    res.status(200).json(vouchers);
  }),
);

router.get(
  "/scanned_tickets",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const query = knex("scanned_tickets").select("*").orderBy("createdAt", "desc");

    // Verifiers only see their own scans; admins see everything.
    if (!req.user.isAdmin) {
      query.where("verifier", req.user.id);
    }

    const tickets = await query;

    // `type` does not exist on this table (the old JSON.parse(type) threw).
    res.status(200).json(
      tickets.map(({ type, ...rest }) =>
        type === undefined ? rest : { ...rest, type: parseJSON(type, type) },
      ),
    );
  }),
);

// Offline -> online sync.
//   body  : [{ id, ticket, verifier, voucher, category, tranxaction, active, createdAt, updatedAt }]
//   query : ?categories=a,b   (optional, narrows what is sent back)
//   reply : { message, tickets, rejected }
//     tickets  = the server's copies of scans in the caller's categories
//                (excluding the ones just uploaded), so the app can keep its
//                local data in step with the online DB.
// The server never re-accepts a scan it already has (voucher + category).
router.post(
  "/scanned_tickets/sync",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id: userId, isAdmin } = req.user;
    const body = req.body;

    let incoming;
    if (Array.isArray(body)) {
      incoming = body;
    } else if (_.isEmpty(body)) {
      incoming = [];
    } else {
      return res.status(400).json("Invalid Request!");
    }

    if (incoming.length > MAX_SYNC_BATCH) {
      return res.status(413).json("Too many tickets in one request.");
    }

    try {
      // Which categories may this caller upload to / read back?
      const assigned = isAdmin ? null : await getAssignedCategoryIds(knex, userId);
      const requested = String(req.query.categories ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      let pullCategories; // null = every category (admin, no filter)
      if (isAdmin) {
        pullCategories = requested.length ? requested : null;
      } else {
        pullCategories = requested.length
          ? requested.filter((c) => assigned.includes(c))
          : assigned;
      }

      // ---- validate the payload --------------------------------------
      const wellFormed = incoming.filter(
        (t) =>
          t &&
          isNonEmptyString(t.id) &&
          t.id.length <= MAX_SCAN_ID_LENGTH &&
          !/\s/.test(t.id) &&
          isNonEmptyString(t.voucher) &&
          isNonEmptyString(t.category) &&
          (isAdmin || assigned.includes(t.category)),
      );

      const candidates = _.uniqBy(wellFormed, (t) => `${t.voucher}|${t.category}`);

      const result = await knex.transaction(async (trx) => {
        let newRows = [];
        let unknownVouchers = 0;

        if (candidates.length) {
          const voucherIds = _.map(candidates, "voucher");
          const ticketIds = _.map(candidates, "id");

          const [scanned, takenIds, knownVouchers] = await Promise.all([
            trx("scanned_tickets").select("voucher", "category").whereIn("voucher", voucherIds),
            trx("scanned_tickets").select("id").whereIn("id", ticketIds),
            trx("vouchers").select("id").whereIn("id", voucherIds),
          ]);

          const alreadyScanned = new Set(scanned.map((s) => `${s.voucher}|${s.category}`));
          const idsTaken = new Set(_.map(takenIds, "id"));
          const voucherExists = new Set(_.map(knownVouchers, "id"));

          // Only trust a client-supplied verifier id when it is a real user.
          const claimed = _.uniq(_.compact(_.map(candidates, "verifier")));
          const knownUsers = claimed.length
            ? new Set(_.map(await trx("users").select("id").whereIn("id", claimed), "id"))
            : new Set();

          unknownVouchers = candidates.filter((t) => !voucherExists.has(t.voucher)).length;

          newRows = candidates
            .filter(
              (t) =>
                voucherExists.has(t.voucher) &&
                !alreadyScanned.has(`${t.voucher}|${t.category}`) &&
                !idsTaken.has(t.id),
            )
            .map((t) => ({
              id: t.id,
              ticket: t.ticket,
              verifier: knownUsers.has(t.verifier) ? t.verifier : userId,
              voucher: t.voucher,
              category: t.category,
              transaction: t.tranxaction,
              active: t.active === undefined ? true : Boolean(t.active),
              createdAt: toDate(t.createdAt),
              updatedAt: toDate(t.updatedAt),
            }));

          for (const chunk of _.chunk(newRows, 500)) {
            await trx("scanned_tickets").insert(chunk);
          }

          if (newRows.length) {
            await trx("vouchers")
              .update({ status: "used" })
              .whereIn("id", _.map(newRows, "voucher"));
          }
        }

        // Server copies the app does not already have. Scoped to the
        // caller's categories (the old query returned every scan of every
        // category and verifier).
        let tickets = [];
        if (pullCategories === null || pullCategories.length) {
          const pull = trx("scanned_tickets")
            .select(
              "id",
              "ticket",
              "verifier",
              "voucher",
              "category",
              "transaction as tranxaction",
              "active",
              "createdAt",
              "updatedAt",
            )
            .orderBy("createdAt", "desc");

          if (pullCategories !== null) pull.whereIn("category", pullCategories);
          if (newRows.length) pull.whereNotIn("voucher", _.map(newRows, "voucher"));

          tickets = await pull;
        }

        return {
          message: newRows.length ? "Synced successfully" : "No new tickets to sync",
          tickets,
          // malformed, not assigned to the caller, or voucher unknown
          rejected: incoming.length - wellFormed.length + unknownVouchers,
        };
      });

      return res.status(200).json(result);
    } catch (error) {
      logger.error(`Ticket sync failed: ${error?.message}`);
      return res.status(500).json("Syncing Failed! Please try again later.");
    }
  }),
);

router.get(
  "/scanned_tickets/vouchers",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    // GET ALL SCANNED TICKETS
    const recentScans = await knex("scanned_tickets_vouchers_view")
      .where("verifierId", id)
      .select("*")
      .orderBy("createdAt", "desc")
      .limit(100);

    res.status(200).json(recentScans);
  }),
);

router.get(
  "/scanned_tickets/history",
  verifyToken,
  // verifyScanner,
  asyncHandler(async (req, res) => {
    const user = req.user;
    // console.log(user)

    const { sort, startDate, endDate } = req.query;
    // non-admins are always limited to their own scans
    const verifier = user?.isAdmin ? req.query.verifier : user?.id;

    let scannedTickets = [];

    if (verifier) {
      // GET ALL SCANNED TICKETS BY VERIFIER
      scannedTickets = await knex("vw_scanned_ticket_voucher_verifier_view")
        .where("verifierId", verifier)
        .select("*");
    } else {
      if (user?.isAdmin) {
        // GET ALL SCANNED TICKETS
        scannedTickets = await knex(
          "vw_scanned_ticket_voucher_verifier_view",
        ).select("*");
      }
    }

    let modifiedTransaction = [];

    const modifiedscannedTicketsWithRange = getRangeTransactions(
      startDate,
      endDate,
      scannedTickets,
    );

    switch (sort) {
      case "today":
        modifiedTransaction = getTodayTransactionArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "yesterday":
        modifiedTransaction = getYesterdayTransactionArray(
          modifiedscannedTicketsWithRange,
        );
        break;

      case "week":
        modifiedTransaction = getLastSevenDaysTransactionsArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "month":
        modifiedTransaction = getThisMonthTransactionArray(
          modifiedscannedTicketsWithRange,
        );
break;
      case "lmonth":
        modifiedTransaction = getLastMonthTransactionArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "year":
        modifiedTransaction = getThisYearTransactionArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "lyear":
        modifiedTransaction = getLastYearTransactionArray(
          modifiedscannedTicketsWithRange,
        );

        break;

      default:
        modifiedTransaction = [...modifiedscannedTicketsWithRange];
    }

    res.status(200).json([...modifiedTransaction]);
  }),
);

router.get(
  "/scanned_tickets/:verifierId/summary",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { verifierId: id } = req.params;

    if (!req.user.isAdmin && id !== req.user.id) {
      return res.status(403).json("Forbidden");
    }

    //GET ALL ASSIGNED TICKETS
    const assignedTickets = await knex("tickets")
      .where("verifier", id)
      .select("*");

    // GET ALL SCANNED TICKETS
    const scannedTickets = await knex("scanned_tickets_vouchers_view")
      .where("verifierId", id)
      .select("*");

    //GET RECENT TRANSACTIONS
    const todayScannedTicket =
      getTodayScannedTicketsTransaction(scannedTickets);

    //GET RECENT TRANSACTIONS
    const recentTransaction = getRecentTicketTransaction(scannedTickets, 5);

    //GET TOTAL SCAN FOR LAST SEVEN DAYS
    const totalScanForLastSevenDays =
      getLastSevenDaysTicketTransactions(scannedTickets);

    //GET TOTAL SCAN BY MONTH
    const totalScanByMonth = getScannedTicketsByMonth(scannedTickets);

    res.status(200).json({
      assignedTickets: assignedTickets.length,
      scannedTickets: scannedTickets.length,
      todayScannedTicket,
      totalScanForLastSevenDays,
      totalScanByMonth,
      recentTransaction,
    });
  }),
);

router.get(
  "/summary",
  verifyToken,
  // verifyScanner,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const verifier = user?.isAdmin ? req.query.verifier : user?.id;

    let assignedTickets = [];
    let scannedTickets = [];

    if (verifier) {
      //GET ALL ASSIGNED TICKETS BY VERIFIER
      assignedTickets = await knex("vw_ticket_category_user_view")
        .where("verifierId", verifier)
        .select("*");

      // GET ALL SCANNED TICKETS BY VERIFIER
      scannedTickets = await knex("vw_scanned_ticket_voucher_verifier_view")
        .where("verifierId", verifier)
        .select("*");
    } else {
      if (user?.isAdmin) {
        //GET ALL ASSIGNED TICKETS
        assignedTickets = await knex("vw_ticket_category_user_view").select(
          "*",
        );

        // GET ALL SCANNED TICKETS
        scannedTickets = await knex(
          "vw_scanned_ticket_voucher_verifier_view",
        ).select("*");
      }
    }

    //GET TODAY TRANSACTIONS
    const todayScannedTicket =
      getTodayScannedTicketsTransaction(scannedTickets);

    //GET RECENT TRANSACTIONS
    const recentTransaction = getRecentTicketTransaction(scannedTickets, 5);

    //GET TOTAL SCAN FOR LAST SEVEN DAYS
    const totalScanForLastSevenDays =
      getLastSevenDaysTicketTransactions(scannedTickets);

    //GET TOTAL SCAN BY MONTH
    const totalScanByMonth = getScannedTicketsByMonth(scannedTickets);

    //GET TOP SCANNED TICKETS
    const topScannedTickets = getTopScannedTickets(scannedTickets);

    res.status(200).json({
      assignedTickets: assignedTickets.length,
      scannedTickets: scannedTickets.length,
      todayScannedTicket,
      totalScanForLastSevenDays: {
        labels: totalScanForLastSevenDays.labels,
        data: _.map(totalScanForLastSevenDays.tickets, "value"),
      },
      totalScanByMonth: {
        labels: _.map(totalScanByMonth, "label"),
        values: _.map(totalScanByMonth, "value"),
      },
      recentTransaction,
      topScannedTickets,
    });
  }),
);

router.get(
  "/summary/history",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { sort, startDate, endDate } = req.query;
    // non-admins are always limited to their own scans
    const verifier = user?.isAdmin ? req.query.verifier : user?.id;

    let scannedTickets = [];

    if (verifier) {
      // GET ALL SCANNED TICKETS BY VERIFIER
      scannedTickets = await knex("scanned_tickets_vouchers_view")
        .where("verifierId", verifier)
        .select("*");
    } else {
      if (user?.isAdmin) {
        // GET ALL SCANNED TICKETS
        scannedTickets = await knex("scanned_tickets_vouchers_view").select(
          "*",
        );
      }
    }

    let modifiedTransaction = [];

    const modifiedscannedTicketsWithRange = getRangeTransactions(
      startDate,
      endDate,
      scannedTickets,
    );

    switch (sort) {
      case "today":
        modifiedTransaction = getTodayTransactionArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "yesterday":
        modifiedTransaction = getYesterdayTransactionArray(
          modifiedscannedTicketsWithRange,
        );
        break;

      case "week":
        modifiedTransaction = getLastSevenDaysTransactionsArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "month":
        modifiedTransaction = getThisMonthTransactionArray(
          modifiedscannedTicketsWithRange,
        );
        break;
      case "lmonth":
        modifiedTransaction = getLastMonthTransactionArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "year":
        modifiedTransaction = getThisYearTransactionArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "lyear":
        modifiedTransaction = getLastYearTransactionArray(
          modifiedscannedTicketsWithRange,
        );

        break;

      default:
        modifiedTransaction = [...modifiedscannedTicketsWithRange];
    }

    res.status(200).json([...modifiedTransaction]);
  }),
);

router.get(
  "/:id",
  verifyToken,
  // verifyScanner,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ticket = await knex("vw_ticket_category_user_view")
      .select("*")
      .where("id", id)
      .first();

    // Not found, or somebody else's assignment: same empty answer. (The old
    // code kept going after sending {} and crashed destructuring undefined.)
    if (_.isEmpty(ticket) || (!req.user.isAdmin && ticket.verifierId !== req.user.id)) {
      return res.status(200).json({});
    }

    const { scope, ...rest } = ticket;

    res.status(200).json({
      ...rest,
      type: safeJSON(scope),
    });
  }),
);

router.get(
  "/:id/recent",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // The original filtered on a misspelt column (`caetgoryId`), so it always
    // failed. Filtering by the assigned ticket id, as the sibling
    // /:id/scanned_tickets/verifier/:verifierId route does.
    const query = knex("scanned_tickets_vouchers_view")
      .select("createdAt", "voucherType", "type", "verifierName")
      .where({ ticketId: id })
      .orderBy("createdAt", "desc")
      .limit(5);

    if (!req.user.isAdmin) {
      query.andWhere({ verifierId: req.user.id });
    }

    res.status(200).json(await query);
  }),
);

router.get(
  "/:id/scanned_tickets",
  verifyToken,
  // verifyScanner,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const ticket = await knex("assigned_tickets")
      .select("scope", "category_id", "verifier_id")
      .where({ id: id })
      .first();

    // Own assignment only (admins can pass ?scanner=<verifier id>).
    const scanner = req.user.isAdmin ? req.query.scanner : req.user.id;

    if (_.isEmpty(ticket) || (!req.user.isAdmin && ticket.verifier_id !== req.user.id)) {
      return res.status(200).json({
        overall: 0,
        total: 0,
        totalPercent: "0%",
        scanned: [],
        scannedPercent: "0%",
        unScannedPercent: "0%",
      });
    }

    const ticketTypes = JSON.parse(ticket.scope);

    //TOTAL TICKETS IN SYSTEM
    const vouchers = await knex("vouchers")
      .select("id", "type")
      .where({ category_id: ticket?.category_id, status: "sold" })
      .orWhere({ category_id: ticket?.category_id, status: "used" });

    // GET ALL TICKETS ASSIGNED TO VERIFIER
    // const assignedVouchers = vouchers.filter(voucher => stripedTicketTypes.includes(voucher?.type))
    //  console.log(assignedVouchers)

    //GET ALL TICKETS SCANNED  BY CATEGORY
    const scannedTicketsByCategory = await knex(
      "vw_scanned_ticket_voucher_verifier_view",
    )
      .select("*")
      .where({ categoryId: ticket?.category_id })
      .orderBy("createdAt", "desc");

    //GET ALL TICKETS SCANNED BY VERIFIER
    const scannedTickets = scannedTicketsByCategory?.filter(
      (ticket) => ticket?.verifierId === scanner,
    );
    // console.log(scannedTickets);

    const totalUnscannedVouchers =
      vouchers?.length - scannedTicketsByCategory?.length;

    // //GET TOTAL PERCENTAGE OF SCANNED TICKETS
    const totalScannedVouchersPercent =
      scannedTicketsByCategory.length / vouchers.length || 0;
    const totalScannedByVerifierPercent =
      scannedTickets.length / vouchers.length || 0;
    const totalUnscannedVouchersPercent =
      totalUnscannedVouchers / vouchers.length || 0;

    let groupedScannedTickets = [];
    if (_.isEmpty(scannedTickets)) {
      groupedScannedTickets = ticketTypes.map((ticket) => {
        return {
          label: ticket?.type,
          value: 0,
          frontColor: "#f78e2a",
        };
      });
    } else {
      groupedScannedTickets = ticketTypes.map((ticket) => {
        return {
          label: ticket?.type,
          value: scannedTickets.filter(
            (scannedTicket) => scannedTicket?.type === ticket?.type,
          )?.length,
          frontColor: "#f78e2a",
        };
      });
    }

    const data = _.map(groupedScannedTickets, "value");
    const unassigned = scannedTicketsByCategory?.length - _.sum(data);

    return res.status(200).json({
      totalSoldVouchers: vouchers?.length,
      totalScannedVouchers: scannedTicketsByCategory?.length,
      totalUnscannedVouchers,
      totalScannedByVerifier: scannedTickets?.length,
      totalScannedVouchersPercent: formatPercentage(
        totalScannedVouchersPercent,
      ),
      totalUnscannedVouchersPercent: formatPercentage(
        totalUnscannedVouchersPercent,
      ),
      totalScannedByVerifierPercent: formatPercentage(
        totalScannedByVerifierPercent,
      ),
      scanned: data,
      groupedScannedTickets,
      unassigned,
    });
  }),
);

router.get(
  "/:id/scanned_tickets/verifier/:verifierId",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { verifierId, id } = req.params;

    if (!req.user.isAdmin && verifierId !== req.user.id) {
      return res.status(403).json("Forbidden");
    }

    if (verifierId) {
      const scannedTicketByVerifier = await knex(
        "scanned_tickets_vouchers_view",
      )
        .select("id", "createdAt", "type", "pin", "serial", "voucherType")
        .where({ ticketId: id, verifierId: verifierId })
        .orderBy("createdAt", "desc");

      return res.status(200).json(scannedTicketByVerifier);
    }

    return res.status(200).json([]);
  }),
);

router.post(
  "/",
  verifyToken,
  // verifyScanner,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const newTicket = req.body;

    const isTicketExisting = await knex("vw_ticket_category_user_view")
      .select("id", "verifierId", "categoryId")
      .where({
        categoryId: newTicket?.category,
        verifierId: newTicket?.verifier,
      })
      .first();

    if (!_.isEmpty(isTicketExisting)) {
      return res.status(404).json("Ticket already assigned to verifier.");
    }

    const ticket = await knex("assigned_tickets").insert({
      id: generateId(),
      category_id: newTicket?.category,
      verifier_id: newTicket.verifier,
      scope: newTicket.type,
    });

    if (_.isEmpty(ticket)) {
      return res.status(404).json("Failed! An unknown error has occurred.");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: `Assigned a ${newTicket.ticketName} to ${newTicket.verifierName}`,
      severity: "info",
    });

    res.status(201).json("Ticket successfully assigned!");
  }),
);

// Verify (scan) a ticket online.
//   body: { id: <transaction id>, ticket: <voucher id>, ticketID: <assigned ticket id>, category }
// The verifier is the signed-in user. `token` in the body is no longer
// required (old app builds still send it; it is ignored).
router.post(
  "/verify",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id: userID, isAdmin } = req.user;
    const { id, ticket, ticketID, category } = req.body ?? {};

    if (
      !isNonEmptyString(ticket) ||
      !isNonEmptyString(id) ||
      !isNonEmptyString(ticketID) ||
      !isNonEmptyString(category)
    ) {
      return res.status(400).json("Error! Ticket not available.");
    }

    const voucherId = ticket.trim();
    const transactionId = id.trim();

    // The signed-in verifier must be assigned to this ticket / category.
    let allowedTypes = null;
    if (!isAdmin) {
      const assignment = await knex("assigned_tickets")
        .select("id", "scope")
        .where({ id: ticketID, verifier_id: userID, category_id: category })
        .first();

      if (_.isEmpty(assignment)) {
        return res.status(403).json("You are not assigned to verify this ticket.");
      }

      const scope = parseJSON(assignment.scope, []);
      allowedTypes = (Array.isArray(scope) ? scope : []).map((s) => s?.type ?? s);
    }

    try {
      const outcome = await knex.transaction(async (trx) => {
        // Lock the voucher row so two scanners cannot verify it at once.
        const voucher = await trx("vouchers")
          .select("id", "type", "status")
          .where("id", voucherId)
          .forUpdate()
          .first();

        if (_.isEmpty(voucher)) {
          return { status: 400, body: "Ticket not found!" };
        }

        // Already scanned -> report who/when, do not scan again.
        const existing = await trx("scanned_tickets")
          .where({ voucher: voucherId })
          .first();
        if (!_.isEmpty(existing)) {
          return {
            status: 200,
            body: await buildVerifiedResponse(trx, voucherId, existing),
          };
        }

        if (!["sold", "used"].includes(voucher.status)) {
          return { status: 400, body: "Not a valid ticket!" };
        }

        const transaction = await trx("voucher_transactions")
          .select("id", "vouchers", "info")
          .where("id", transactionId)
          .first();

        if (_.isEmpty(transaction)) {
          return { status: 400, body: "Ticket not found!" };
        }

        const categoryId = parseJSON(transaction.info, {})?.categoryId;
        if (category !== categoryId) {
          return { status: 400, body: "Not a valid ticket!" };
        }

        // The QR carries a transaction id and a voucher id: the voucher must
        // really belong to that transaction.
        if (!transactionIncludesVoucher(transaction.vouchers, voucherId)) {
          logger.warn(
            `verify: voucher ${voucherId} is not in transaction ${transactionId} (user ${userID})`,
          );
          return { status: 400, body: "Not a valid ticket!" };
        }

        // Ticket type must be inside the verifier's assigned scope (the
        // offline flow already enforces this). Log-only unless
        // ENFORCE_TICKET_SCOPE=true.
        if (allowedTypes && !allowedTypes.includes(voucher.type)) {
          logger.warn(
            `verify: ${userID} not scoped for type ${voucher.type} (ticket ${ticketID})`,
          );
          if (flagOn("ENFORCE_TICKET_SCOPE")) {
            return {
              status: 403,
              body: `You are not authorized to verify ${voucher.type} tickets.`,
            };
          }
        }

        await trx("vouchers").update({ status: "used" }).where("id", voucherId);

        let inserted = false;
        for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
          try {
            await trx("scanned_tickets").insert({
              id: generateId(6),
              ticket: ticketID,
              verifier: userID,
              voucher: voucherId,
              category: categoryId,
              transaction: transactionId,
            });
            inserted = true;
          } catch (error) {
            if (error?.code !== "ER_DUP_ENTRY") throw error;

            // a unique index on voucher caught a concurrent scan ...
            const raced = await trx("scanned_tickets")
              .where({ voucher: voucherId })
              .first();
            if (!_.isEmpty(raced)) {
              return {
                status: 200,
                body: await buildVerifiedResponse(trx, voucherId, raced),
              };
            }
            // ... otherwise it was a primary-key clash: retry with a new id
          }
        }
        if (!inserted) throw new Error("Could not allocate a scan id");

        const scannedTicket = await trx("scanned_tickets_vouchers_view")
          .select("*")
          .where("voucherId", voucherId)
          .first();

        if (_.isEmpty(scannedTicket)) {
          throw new Error("Scan saved but not visible in scanned_tickets_vouchers_view");
        }

        // The customer's e-mail / phone number used to be returned here. The
        // app never displays them, so they are no longer sent to scanners.
        return { status: 200, body: { ...scannedTicket, isVerified: false } };
      });

      return res.status(outcome.status).json(outcome.body);
    } catch (error) {
      logger.error(`Ticket verification failed: ${error?.message}`);
      return res
        .status(500)
        .json("Error verifying your ticket! Please try again later.");
    }
  }),
);

//Enable or Disable User Ticket
router.put(
  "/account",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user;
    const { id, active } = req.body;

    const updatedUser = await knex("tickets")
      .where("id", id)
      .update({ active: active });

    if (updatedUser !== 1) {
      return res.status(400).json("Error updating user info");
    }

    //logs
    await knex("activity_logs").insert({
      id: generateId(10),
      user_id: userID,
      title: `${
        Boolean(active) === true ? "Activated a ticket!" : "Disabled a ticket!"
      }`,
      severity: "warning",
    });

    res
      .status(201)
      .json(Boolean(active) === true ? "Ticket enabled!" : "Ticket disabled!");
  }),
);

module.exports = router;
