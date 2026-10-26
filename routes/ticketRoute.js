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
      .join("categories", "vouchers.category", "categories.id")
      .where("vouchers.category", category);

    res.status(200).json(vouchers);
  }),
);

router.get(
  "/scanned_tickets",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    let tickets = [];

    tickets = await knex("scanned_tickets")
      .select("*")
      .orderBy("createdAt", "desc");

    if (_.isEmpty(tickets)) {
      return res.status(200).json([]);
    }
    const modifiedTickets = tickets.map(({ type, ...rest }) => {
      return {
        ...rest,
        type: JSON.parse(type),
      };
    });

    res.status(200).json(modifiedTickets);
  }),
);

router.post(
  "/scanned_tickets/sync",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const tickets = req.body;

    if (_.isEmpty(tickets)) {
      return res.sendStatus(204);
    }

    const transx = await knex.transaction();
    try {
      //check if ticket has already been synced
      const unSyncedTickets = tickets?.map(async (unSyncedTicket) => {
        const {
          id,
          ticket,
          verifier,
          voucher,
          category,
          tranxaction,
          active,
          createdAt,
          updatedAt,
        } = unSyncedTicket;

        const itExists = await transx("scanned_tickets")
          .select("*")
          .where({
            voucher,
            category,
          })
          .limit(1)
          .first();
        if (!_.isEmpty(itExists)) {
          return null;
        } else {
          //check if voucher exists in the system
          return {
            id,
            ticket,
            verifier,
            voucher,
            category,
            transaction: tranxaction,
            active,
            createdAt,
            updatedAt,
          };
        }
      });

      const rawTickets = await Promise.all(unSyncedTickets);
      //remove null values from array

      const newTickets = _.compact(rawTickets);
      if (!_.isEmpty(newTickets)) {
        await transx("scanned_tickets").insert(newTickets);

        const vouchers = _.map(newTickets, "voucher");

        //update vouchers to used
        await transx("vouchers")
          .update({
            status: "used",
          })
          .where("id", "IN", vouchers);

        const scannedTickets = await transx("scanned_tickets")
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
          .whereNot("voucher", "IN", vouchers)
          .orderBy("createdAt", "desc");

        await transx.commit();

        return res
          .status(200)
          .json({ message: "Synced successfully", tickets: scannedTickets });
      } else {
        await transx.commit();

        return res.status(200).json({
          message: "No new tickets to sync",
          tickets: [],
        });
      }
    } catch (error) {
      await transx.rollback();
      console.log(error);
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
    
    const { sort, startDate, endDate ,verifier} = req.query;


    let scannedTickets = [];

    if (verifier) {
      // GET ALL SCANNED TICKETS BY VERIFIER
      scannedTickets = await knex("vw_scanned_ticket_voucher_verifier_view")
        .where("verifierId", verifier)
        .select("*");
    } else {
      if (user?.isAdmin) {
        // GET ALL SCANNED TICKETS
        scannedTickets = await knex("vw_scanned_ticket_voucher_verifier_view").select(
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

      case "week":
        modifiedTransaction = getLastSevenDaysTransactionsArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "month":
        modifiedTransaction = getThisMonthTransactionArray(
          modifiedscannedTicketsWithRange,
        );

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
    const { verifier } = req.query;

    const transx = await knex.transaction();

    let assignedTickets = [];
    let scannedTickets = [];

    if (verifier) {
      //GET ALL ASSIGNED TICKETS BY VERIFIER
      assignedTickets = await transx("vw_ticket_category_user_view")
        .where("verifierId", verifier)
        .select("*");

      // GET ALL SCANNED TICKETS BY VERIFIER
      scannedTickets = await transx("vw_scanned_ticket_voucher_verifier_view")
        .where("verifierId", verifier)
        .select("*");
    } else {
      if (user?.isAdmin) {
        //GET ALL ASSIGNED TICKETS
        assignedTickets = await transx("vw_ticket_category_user_view").select(
          "*",
        );

        // GET ALL SCANNED TICKETS
        scannedTickets = await transx(
          "vw_scanned_ticket_voucher_verifier_view",
        ).select("*");
      }
    }
    await transx.commit();

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
    const { sort, startDate, endDate, verifier } = req.query;

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

      case "week":
        modifiedTransaction = getLastSevenDaysTransactionsArray(
          modifiedscannedTicketsWithRange,
        );

        break;
      case "month":
        modifiedTransaction = getThisMonthTransactionArray(
          modifiedscannedTicketsWithRange,
        );

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

    if (_.isEmpty(ticket)) res.status(200).json({});

    const { scope, ...rest } = ticket;
    const modifiedTicket = {
      ...rest,
      type: JSON.parse(scope),
    };

    res.status(200).json(modifiedTicket);
  }),
);

router.get(
  "/:id/recent",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const scannedTickets = await knex("scanned_tickets_vouchers_view")
      .select("createdAt", "voucherType", "type", "verifierName")
      .where({ caetgoryId: id })
      .limit(5)
      .orderBy("createdAt", "desc");

    if (_.isEmpty(scannedTickets)) {
      return res.status(200).json({
        total: 0,
        scanned: _.repeat("0", ticketTypes?.length),
      });
    }

    res.status(200).json(modifiedTicket);
  }),
);

router.get(
  "/:id/scanned_tickets",
  verifyToken,
  // verifyScanner,
  asyncHandler(async (req, res) => {
    const { scanner } = req.query;
    const { id } = req.params;

    const transx = await knex.transaction();

    const ticket = await transx("assigned_tickets")
      .select("scope", "category_id")
      .where({ id: id })
      .first();

    if (_.isEmpty(ticket)) {
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
    const vouchers = await transx("vouchers")
      .select("id", "type")
      .where({ category_id: ticket?.category_id, status: "sold" })
      .orWhere({ category_id: ticket?.category_id, status: "used" });

    // GET ALL TICKETS ASSIGNED TO VERIFIER
    // const assignedVouchers = vouchers.filter(voucher => stripedTicketTypes.includes(voucher?.type))
    //  console.log(assignedVouchers)

    //GET ALL TICKETS SCANNED  BY CATEGORY
    const scannedTicketsByCategory = await transx(
      "vw_scanned_ticket_voucher_verifier_view",
    )
      .select("*")
      .where({ categoryId: ticket?.category_id })
      .orderBy("createdAt", "desc");

    await transx.commit();

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

router.post(
  "/verify",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user;
    const { id, ticket, ticketID, category, token } = req.body;

    if (!ticket || !id || !token) {
      return res.status(400).json("Error! Ticket not available.");
    }

    //find transaction with voucher id
    const scannedTicket = await knex("scanned_tickets").where({
      voucher: ticket?.toString(),
    });

    if (!_.isEmpty(scannedTicket)) {
      const verifiedTicket = await knex("scanned_tickets_vouchers_view")
        .where({
          voucherId: ticket,
        })
        .first();
      verifiedTicket.isVerified = true;
      return res.status(200).json(verifiedTicket);
    }

    const transx = await knex.transaction();
    try {
      //find transaction with  id
      const transaction = await transx("voucher_transactions")
        .select("id", "email", "phonenumber", "vouchers", "info")
        .where("id", id)
        .limit(1)
        .first();

      if (_.isEmpty(transaction)) {
        await transx.commit();
        return res.status(400).json("Ticket not found!");
      }
      //update transaction with voucher id
      const categoryId = JSON.parse(transaction?.info)?.categoryId;

      if (category !== categoryId) {
        await transx.commit();
        return res.status(400).json("Not a valid ticket!");
      }

      await transx("vouchers")
        .update({
          status: "used",
        })
        .where("id", ticket);

      await transx("scanned_tickets").insert({
        id: generateId(6),
        ticket: ticketID,
        verifier: userID,
        voucher: ticket,
        category: categoryId,
        transaction: id,
      });

      //find tranasction with specific payment id
      const scannedTicket = await transx("scanned_tickets_vouchers_view")
        .select("*")
        .where("voucherId", ticket)
        .limit(1)
        .first();

      const modifiedVoucher = {
        ...scannedTicket,
        phonenumber: transaction.phonenumber,
        email: transaction.email,
        isVerified: false,
      };

      await transx.commit();

      return res.status(200).json(modifiedVoucher);
    } catch (error) {
      await transx.rollback();
      console.log(error);
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
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id: id } = req.user;
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
      user_d: id,
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
