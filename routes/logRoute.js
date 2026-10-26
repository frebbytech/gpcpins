const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const knex = require("../db/knex");
const { verifyToken } = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");
const verifyScanner = require("../middlewares/verifyScanner");
const { parseDateRange } = require("../config/dateConfigs");

// GET All Logs
// router.get(
//   "/",
//   verifyToken,
//   verifyAdmin,
//   asyncHandler(async (req, res) => {
//     const { id, isAdmin } = req.user;
//     const { startDate, endDate } = req.query;

//     const { start, end, error } = parseDateRange(startDate, endDate);
//     if (error) {
//       return res.status(400).json("error fetching logs");
//     }

//     let query = knex("vw_user_logs_view").whereBetween("createdAt", [
//       start,
//       end,
//     ]);

//     if (!isAdmin) {
//       query.where({ userId: id, isActive: true });
//     }

//     const logs = await query.orderBy("createdAt", "desc").select("*");

//     return res.status(200).json(logs);
//   }),
// );

// GET All Logs
router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id, isAdmin } = req.user;

    const { startDate, endDate, page = 1, limit = 10, search = "" } = req.query;

    const { start, end, error } = parseDateRange(startDate, endDate);
    if (error) {
 return res.status(400).json("error fetching logs");
    }

    // Convert to integers to prevent query injection and unexpected math.
    // Cap `limit` so a client can't force a full-table scan/huge payload.
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (parsedPage - 1) * parsedLimit;

    // Escape LIKE wildcards in user input so a literal "%" or "_" in the
    // search box doesn't behave as a wildcard.
    const searchTerm = String(search).trim().replace(/[%_]/g, "\\$&");

    let query = knex("vw_user_logs_view").whereBetween("createdAt", [
      start,
      end,
    ]);

    if (!isAdmin) {
      query.where({ userId: id, isActive: true });
    }

    if (searchTerm) {
      // Adjust these column names to whatever vw_user_logs_view actually
      // exposes (e.g. action, module, description, performedBy...).
      // Use `whereILike` instead of `where(...,"like",...)` if this is
      // running on Postgres, since MySQL/MariaDB LIKE is case-insensitive
      // by default but Postgres LIKE is not.
      query.where((builder) => {
        builder
          .where("severity", "like", `%${searchTerm}%`)
          .orWhere("title", "like", `%${searchTerm}%`)
          .orWhere("name", "like", `%${searchTerm}%`)
          .orWhere("email", "like", `%${searchTerm}%`)
          .orWhere("phonenumber", "like", `%${searchTerm}%`);
      });
    }

    // Clone the exact query filters to get an accurate total count
    const totalQuery = query
      .clone()
      .clearOrder()
      .count("id as total");

    // Optimize performance by running actual data fetch and total count concurrently
    const [data, totalResult] = await Promise.all([
      query
        .select(
          "id",
          "title",
          "severity",
          "name",
          "email",
          "phonenumber",
          "createdAt",
          // ...only the columns LOGS_COLUMNS actually renders
        )
        // Tiebreaker on `id` keeps pagination stable when multiple rows
        // share the same createdAt timestamp.
        .orderBy([
          { column: "createdAt", order: "desc" },
          { column: "id", order: "desc" },
        ])
        .limit(parsedLimit)
        .offset(offset),
      totalQuery.first(),
    ]);

    const total = Number(totalResult?.total ?? 0);

    return res.status(200).json({
      data,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  }),
);


//Verifier Logs
router.get(
  "/verifier",
  verifyToken,
  // verifyScanner,
  asyncHandler(async (req, res) => {
    const { id, isAdmin } = req.user;
    const { startDate, endDate } = req.query;

    const { start, end, error } = parseDateRange(startDate, endDate);
    if (error) {
      return res.status(400).json("error fetching logs");
    }

    const verifiers = await knex("vw_users_with_roles")
      .where({
        active: true,
        role: process.env.SCANNER_ID,
      })
      .pluck("id"); // 🔥 only get ids (lighter + faster)

    let query = knex("vw_user_logs_view")
      .whereIn("userId", verifiers)
      .whereBetween("createdAt", [start, end]);

    if (!isAdmin) {
      query.where({ userId: id, is_active: true });
    }

    const logs = await query.orderBy("createdAt", "desc").select("*");

    return res.status(200).json(logs);
  }),
);

// PUT Remove All Selected Logs
router.put(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { isAdmin } = req.user;
    const { logs } = req.body;
  

    if (isAdmin) {
      await knex("activity_logs").where("id", "IN", logs).del();
    } else {
      await knex("activity_logs").where("id", "IN", logs).update({
        is_active: false,
      });
    }

    return res.sendStatus(204);
  }),
);

router.put(
  "/verifier",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { logs } = req.body;
    // console.log(logs);

    await knex("verifier_activity_logs").where("_id", "IN", logs).update({
      isActive: false,
    });
    return res.sendStatus(204);
  }),
);

module.exports = router;
