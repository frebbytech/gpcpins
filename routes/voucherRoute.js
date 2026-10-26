const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const moment = require("moment");

const generateId = require("../config/generateId");
const findDuplicates = require("../config/findDuplicates");
//model

const { verifyToken } = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { isValidUUID2 } = require("../config/validation");

const knex = require("../db/knex");
const { safeJSON } = require("../config/helpers");

const ALLOWED_CATEGORIES = [
  "waec",
  "stadium",
  "university",
  "cinema",
  "security",
  "bus",
];

router.get(
  "/category",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { type, id } = req.query;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid ID!");
    }

    if (!ALLOWED_CATEGORIES.includes(type)) {
      return res.status(400).json("Unknown Category");
    }

    if (id && type) {
      const vouchers = await knex("vouchers")
        .orderBy("created_at", "desc")
        .join("categories", "vouchers.category_id", "categories.id")
        .where("vouchers.category_id", id)
        .select(
          "vouchers.*",
          "categories.name as voucher",
          "categories.type as category",
        );

      const modifiedVouchers = vouchers.map(({ details, ...rest }) => {
        return {
          ...rest,
          year: rest.year || moment(rest.created_at).format("YYYY"),
          details: JSON.parse(details),
        };
      });

      return res.status(200).json(modifiedVouchers);
    }

    return res.status(200).json([]);
  }),
);

router.get(
  "/details",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.query;
    const isTicket = ["cinema", "stadium", "bus"];

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid ID!");
    }

    const vouchers = await knex("vouchers")
      .join("categories", "vouchers.category_id", "categories.id")
      .where("vouchers.category_id", id)
      .select("vouchers.status", "vouchers.created_at", "categories.type");

    if (_.isEmpty(vouchers)) {
      return res.status(200).json({
        total: 0,
        new: 0,
        sold: 0,
        reserved: 0,
        used: 0,
        expired: 0,
      });
    }

    const groupedStatus = _.groupBy(vouchers, "status");

    let expired = 0;
    if (isTicket.includes(vouchers[0]?.type)) {
      expired = vouchers?.filter(
        (voucher) =>
          voucher?.status === "new" &&
          moment().isAfter(moment(voucher?.created_at)),
      );
    }

    res.status(200).json({
      total: vouchers?.length,
      new: groupedStatus?.new?.length ?? 0,
      sold: groupedStatus?.sold?.length ?? 0,
      reserved: groupedStatus?.reserved?.length ?? 0,
      used: groupedStatus?.used?.length ?? 0,
      expired: expired?.length ?? 0,
    });
  }),
);

router.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    const { id } = req.query;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid ID!");
    }
    const category = await knex("categories")
      .where("id", id)
      .select("details")
      .first();
    const details = safeJSON(category?.details);
    const pricingTypes = details?.pricing;

    const vouchers = await knex("vw_category_voucher_view")
      .where("categoryId", id)
      .select(
        "voucherType as ticketType",
        "status",
        "createdAt",
        "categoryType",
        "categoryDetails",
      );

    //Vew Vouchers
    const newVouchers = vouchers?.filter(
      (voucher) => voucher?.status === "new",
    )?.length;

    // Recently Scanned Vouchers
    const scannedVouchers = await knex(
      "vw_scanned_ticket_voucher_verifier_view",
    )
      .select("createdAt", "voucherType", "verifierName")
      .where({ categoryId: id })
      .limit(5)
      .orderBy("createdAt", "desc");

    // console.log(scannedVouchers)

    //Assigned Verifiers
    const assignedVerifiers = await knex("vw_ticket_category_user_view")
      .select("verifierId", "verifierName", "scope")
      .where({ categoryId: id })
      .orderBy("createdAt", "desc");

    // console.log(assignedVerifiers);

    const modifiedVerifiers = assignedVerifiers.map((verifier) => {
      return {
        verifierId: verifier?.verifierId,
        verifierName: verifier.verifierName,
        type: _.map(JSON.parse(verifier.scope), "type"),
      };
    });

    //Get last seven days scanned data
    // const sevenDays = getLastSevenDaysTransactionsArray(scannedVouchers)
    // console.log(sevenDays)

    //GET ALL TICKET TYPES
    const ticketTypes = pricingTypes?.map(({ type }) => {
      const sold = vouchers?.filter(
        (voucher) => voucher?.status === "sold" && voucher?.ticketType === type,
      )?.length;

      const used = vouchers?.filter(
        (voucher) => voucher?.status === "used" && voucher?.ticketType === type,
      )?.length;
      return {
        type,
        sold,
        used,
      };
    });

    const ticketPricingTypes = {
      labels: _.map(ticketTypes, "type"),
      datasets: [
        {
          label: "Sold/Unscanned",
          data: _.map(ticketTypes, "sold"),
          backgroundColor: "#031523",
        },
        {
          label: "Used/Scanned",
          data: _.map(ticketTypes, "used"),
          backgroundColor: "#f78e2a",
        },
      ],
    };
    const groupedStatus = _.groupBy(vouchers, "status");

    // console.log(pricingTypes)
    res.status(200).json({
      total: vouchers?.length ?? 0,
      new: newVouchers ?? 0,
      sold: groupedStatus?.sold?.length ?? 0,
      used: groupedStatus?.used?.length ?? 0,
      pricingTypes: _.map(pricingTypes, "type"),
      ticketTypes: ticketPricingTypes,
      recent: scannedVouchers,
      verifiers: modifiedVerifiers,
    });
  }),
);

router.get(
  "/available",
  asyncHandler(async (req, res) => {
    const { id, type } = req.query;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid ID!");
    }

    let count;
    if (!_.isNull(type)) {
      count = await knex("vouchers")
        .count("id as total")
        .where({
          category: id,
          type,
          status: "new",
          active: 1,
        })
        .first();
    } else {
      count = await knex("vouchers")
        .count("id as total")
        .where({
          category: id,
          status: "new",
          active: 1,
        })
        .first();
    }

    const totalCount = count.total;

    res.status(200).json(totalCount);
  }),
)
router.get(
  "/available/tickets",
  asyncHandler(async (req, res) => {
    const { id } = req.query;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request Token!");
    }

    const ticketTypes = await knex("vouchers").select("id", "type").where({
      category_id: id,
      status: "new",
      active: 1,
    });

    const groupTickets = _.countBy(ticketTypes, "type");

    res.status(200).json(groupTickets);
  }),
);

router.get(
  "/count",
  asyncHandler(async (req, res) => {
    const { id } = req.query;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid ID!");
    }

    const count = await knex("vouchers")
      .count("id as total")
      .where("category", id)
      .first();
    const totalCount = count.total;

    res.status(200).json(totalCount);
  }),
);

router.get(
  "/bus/available/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid ID!");
    }

    const vouchers = await knex("vouchers").select("details", "active").where({
      category_id: id,
      status: "new",
      active: true,
    });

    const modifiedVouchers = vouchers.map(({ details, active }) => {
      return {
        seatNo: safeJSON(details)?.seatNo,
        active,
      };
    });

    res.status(200).json(_.orderBy(modifiedVouchers, "seatNo", "asc"));
  }),
);

router.post(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const newVouchers = req.body;

    if (_.isEmpty(newVouchers)) {
      return res.status(400).json("Invalid Input Request!");
    }

    const modifiedVouchers = newVouchers.map((voucher) => {
      return {
        id: generateId(4),
        category_id: voucher?.category,
        type: voucher?.type || voucher?.voucherType,
        serial: voucher?.serial,
        pin: voucher?.pin,
        details: JSON.stringify(voucher?.details),
      };
    });
    // console.log(modifiedVouchers)

    const savedVoucher = await knex("vouchers").select("pin", "serial").where({
      category_id: modifiedVouchers[0]?.category_id,
    });

    if (!_.isEmpty(savedVoucher)) {
      const arr1 = modifiedVouchers.map(({ pin, serial }) => {
        return {
          pin,
          serial,
        };
      });
      const arr2 = savedVoucher.map(({ pin, serial }) => {
        return {
          pin,
          serial,
        };
      });
      const duplicates = findDuplicates(arr1, arr2);

      if (!_.isEmpty(duplicates)) {
        return res
          .status(400)
          .json("Error! Matching Pins and Serials already loaded.");
      }
    }

    const vouchers = await knex("vouchers").insert(modifiedVouchers);
    // const vouchers = await Voucher.insertMany(modifiedVouchers);

    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: "Loaded serials and pins.",
      severity: "info",
    });

    if (!vouchers) {
      res.status(400).json("Error saving pins!");
    }

    res.status(200).json("Pins and Serials Saved!");
  }),
);

router.put(
  "/remove",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: userId } = req.user;

    if (_.isEmpty(req.body)) {
      return res.status(400).json("Invalid Input Request!");
    }

    const { id } = req.body;

    const deletedVouchers = await knex("vouchers").whereIn("id", id).del();

    if (!deletedVouchers >= 1) {
      return res.status(404).json("Error removing vouchers!");
    }

    //logs
    await knex("activity_logs").insert({
      employee_id: userId,
      title: "Deleted multiple serials and pins.",
      severity: "error",
    });

    res.status(200).json("Vouchers removed!");
  }),
);

module.exports = router;
