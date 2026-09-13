const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const generateId = require("../config/generateId");
const moment = require("moment");
const knex = require("../db/knex");
const { isValidUUID2 } = require("../config/validation");
const { verifyToken } = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");
const verifyScanner = require("../middlewares/verifyScanner");
const { safeJSON } = require("../config/helpers");
const { parseDateRange } = require("../config/dateConfigs");

router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id, created_at: modifiedAt } = req.user;
    const { title } = req.query;

    let notification = [];

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request!");
    }
    if (title) {
      notification = await knex("notifications")
        .where("title", title)
        .select("*");
    } else {
      notification = await knex("notifications")
        .select("*")
        .limit(50)
        .orderBy("created_at", "desc");
    }

    notification.filter(({ created_at }) => {
      return moment(created_at).isSameOrAfter(moment(modifiedAt));
    });

    const notifications = _.orderBy(notification, "created_at", "desc");

    res.status(200).json(notifications);
  }),
);

router.get(
  "/user",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id: userId, createdAt: userCreatedAt } = req.user;

    // console.log(req.user)

    // ---------- VALIDATION ----------
    if (!isValidUUID2(userId)) {
      return res.status(400).json({ message: "Invalid user identifier" });
    }

    // ---------- PAGINATION ----------
    // let { page = 1, limit = 50 } = req.query;
    // page = Math.max(1, Number(page) || 1);
    // limit = Math.min(Number(limit) || 50, 100); // enforce max 100 per page
    // const offset = (page - 1) * limit;

    // ---------- DATE FILTER ----------
    // Use the user's creation date as the lower bound for notifications
    const startDate = moment(userCreatedAt).toDate();

    // ---------- COUNT TOTAL ITEMS ----------
    // const [broadcastCount, notificationCount] = await Promise.all([
    //   knex("broadcast_messages")
    //     .where("recipient", "Customers")
    //     .where("created_at", ">=", startDate)
    //     // .count("id as count")
    //     .first(),

    //   knex("notifications")
    //     .where("user_id", userId)
    //     .where("created_at", ">=", startDate)
    //     // .count("id as count")
    //     .first(),
    // ]);

    // console.log("Broadcast Count:", broadcastCount);
    // console.log("Notification Count:", notificationCount);

    // const total =
    //   (broadcastCount?.count || 0) + (notificationCount?.count || 0);
    // const totalPages = Math.ceil(total / limit);

    // ---------- UNION QUERY (PAGINATED) ----------
    const broadcastSubquery = knex("broadcast_messages")
      .select(
        "id",
        knex.raw("? as user_id", userId), // assign current user ID to broadcasts
        "type",
        "title",
        "body",
        "info",
        "link",
        "photo",
        "active",
        "is_read",
        "created_at",
        "updated_at",
      )
      .where("recipient", "Customers")
      .where("created_at", ">=", startDate);

    const notificationsSubquery = knex("notifications")
      .select(
        "id",
        "user_id",
        "type",
        "title",
        "body",
        "info",
        "link",
        "photo",
        "active",
        "is_read",
        "created_at",
        "updated_at",
      )
      .where("user_id", userId)
      .where("created_at", ">=", startDate);

    const unionQuery = knex
      .unionAll([broadcastSubquery, notificationsSubquery])
      .orderBy("created_at", "desc")
      .limit(50);
    // .offset(offset)

    const results = await unionQuery;

    // console.log(results)

    // ---------- NORMALIZATION ----------
    // Convert snake_case to camelCase and safely parse JSON info
    const normalize = (item) => ({
      id: item.id,
      userId: item.user_id,
      type: item.type,
      title: item.title,
      body: item.body,
      info: item.info ? safeJSON(item.info) : null,
      link: item.link,
      photo: item.photo,
      active: Boolean(item.active),
      isRead: Boolean(item.is_read),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    });

    const notifications = results.map(normalize);

    // ---------- RESPONSE ----------
    res.status(200).json(notifications);
    // res.status(200).json({
    //   data: notifications,
    //   pagination: {
    //     page,
    //     limit,
    //     total,
    //     totalPages,
    //   },
    // });
  }),
);

router.get(
  "/agent",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id: userId, createdAt: userCreatedAt } = req.user;

    // ---------- VALIDATION ----------
    if (!isValidUUID2(userId)) {
      return res.status(400).json({ message: "Invalid user identifier" });
    }

    // ---------- DATE FILTER ----------
    // Use the user's creation date as the lower bound for notifications
    const { start: startDate } = parseDateRange(userCreatedAt, new Date());

    // ---------- UNION QUERY (PAGINATED) ----------
    const broadcastSubquery = knex("broadcast_messages")
      .select(
        "id",
        "type",
        "title",
        "body",
        "info",
        "link",
        "photo",
        "active",
        "created_at",
        "updated_at",
        knex.raw("? as user_id", userId), // assign current user ID to broadcasts
      )
      .where("recipient", "Customers")
      .where("created_at", ">=", startDate);

    const notificationsSubquery = knex("notifications")
      .select(
        "id",
        "type",
        "title",
        "body",
        "info",
        "link",
        "photo",
        "active",
        "created_at",
        "updated_at",
        "user_id",
      )
      .where("user_id", userId)
      .where("created_at", ">=", startDate);

    const unionQuery = knex
      .unionAll([broadcastSubquery, notificationsSubquery])
      .orderBy("created_at", "desc");
    // .offset(offset)
    // .limit(limit);

    const results = await unionQuery;

    // ---------- NORMALIZATION ----------
    // Convert snake_case to camelCase and safely parse JSON info
    const normalize = (item) => ({
      id: item.id,
      userId: item.user_id,
      type: item.type,
      title: item.title,
      body: item.body,
      info: item.info ? safeJSON(item.info) : null,
      link: item.link,
      photo: item.photo,
      active: item.active,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    });

    const notifications = results.map(normalize);

    // ---------- RESPONSE ----------

    res.status(200).json(notifications);

    // res.status(200).json({
    //   data: notifications,
    //   pagination: {
    //     page,
    //     limit,
    //     total,
    //     totalPages,
    //   },
    // });
  }),
);

router.get(
  "/verifier",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id: userId, createdAt: userCreatedAt } = req.user;

    // ---------- VALIDATION ----------
    if (!isValidUUID2(userId)) {
      return res.status(400).json({ message: "Invalid user identifier" });
    }

    // ---------- DATE FILTER ----------
    // Use the user's creation date as the lower bound for notifications
    const { start: startDate } = parseDateRange(userCreatedAt, new Date());

    // ---------- UNION QUERY (PAGINATED) ----------
    const broadcastSubquery = knex("broadcast_messages")
      .select(
        "id",
        "type",
        "title",
        "body",
        "info",
        "link",
        "photo",
        "active",
        "created_at",
        "updated_at",
        knex.raw("? as user_id", userId), // assign current user ID to broadcasts
      )
      .where("recipient", "Customers")
      .where("created_at", ">=", startDate);

    const notificationsSubquery = knex("notifications")
      .select(
        "id",
        "type",
        "title",
        "body",
        "info",
        "link",
        "photo",
        "active",
        "created_at",
        "updated_at",
        "user_id",
      )
      .where("user_id", userId)
      .where("created_at", ">=", startDate);

    const unionQuery = knex
      .unionAll([broadcastSubquery, notificationsSubquery])
      .orderBy("created_at", "desc");
    // .offset(offset)
    // .limit(limit);

    const results = await unionQuery;

    // ---------- NORMALIZATION ----------
    // Convert snake_case to camelCase and safely parse JSON info
    const normalize = (item) => ({
      id: item.id,
      userId: item.user_id,
      type: item.type,
      title: item.title,
      body: item.body,
      info: item.info ? safeJSON(item.info) : null,
      link: item.link,
      photo: item.photo,
      active: item.active,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    });

    const notifications = results.map(normalize);
    // console.log(notifications);

    // ---------- RESPONSE ----------
    res.status(200).json(notifications);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request!");
    }

    const notification = await knex("notifications")
      .select("*")
      .where("id", id)
      .limit(1);

    res.status(200).json(notification[0]);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const newNotification = req.body;
    const notification = await knex("notifications").insert({
      id: generateId(),
      ...newNotification,
    });

    if (_.isEmpty(notification)) {
      return res.status(404).json("Error saving notification!");
    }
    res.status(201).json("Notification  saved!");
  }),
);

router.post(
  "/verifier",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const newNotification = req.body;

    const verifiers = await knex("verifiers")
      .where("active", true)
      .select("id");

    const newInsertNotifications = verifiers.map((verifier) => {
      return {
        id: generateId(),
        verifier_id: verifier?.id,
        ...newNotification,
      };
    });

    const notification = await knex("verifier_notifications").insert(
      newInsertNotifications,
    );

    if (_.isEmpty(notification)) {
      return res.status(404).json("Error saving notification!");
    }
    res.status(201).json("Notification  saved!");
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (ids) {
      await knex("notifications")
        .where("id", "IN", ids)
        .update({ active: false });
      await knex("broadcast_messages")
        .where("id", "IN", ids)
        .update({ active: false });
    } else {
      await knex("broadcast_messages").update({ active: false });
      await knex("notifications").update({ active: false });
    }

    res.sendStatus(204);
  }),
);

//Mark all verifier notifications as read
router.put(
  "/mark-all-read",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    const { ids } = req.body;

    await knex("notifications")
      .where("user_id", id)
      .update({ active: false, is_read: true });

    res.sendStatus(204);
  }),
);

//Mark user notifications as read
router.put(
  "/user",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    await knex("notifications")
      .where("user_id", id)
      .update({ active: false, is_read: true });

    res.sendStatus(204);
  }),
);

//Mark agent notifications as read
router.put(
  "/agent",
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    await knex("notifications").where("user_id", id).update({ active: false });

    res.sendStatus(204);
  }),
);

//Mark all verifier notifications as read
router.put(
  "/verifier",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    await knex("verifier_notifications")
      .where("id", "IN", ids)
      .update({ active: false });

    res.sendStatus(204);
  }),
);

//Mark agent notifications as read
router.put(
  "/verifier/remove",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    await knex("verifier_notifications").where("id", "IN", ids).del();

    res.sendStatus(204);
  }),
);

// Delete a notification
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const { id, all } = req.body;

    if (all && !_.isEmpty(all)) {
      await knex("notifications").where("id", "IN", all).del();
    } else {
      await knex("notifications").where("id", id).del();
    }

    res.status(200).json("Notifications removed!");
  }),
);

router.delete(
  "/user",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    notification = await knex("notifications").where("user_id", id).del();

    if (!notification) {
      return res.status(404).json("Error removing notifications!");
    }
    res.status(200).json("Notifications removed!");
  }),
);

router.delete(
  "/agent",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    await knex("notifications").where("user_id", id).del();

    res.status(200).json("Notifications removed!");
  }),
);

router.delete(
  "/agent",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    await knex("verifier_notifications").where("verifier_id", id).del();

    res.status(200).json("Notifications removed!");
  }),
);

router.delete(
  "/user/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const broadcastMessage = await knex("broadcast_messages")
      .where("id", id)
      .del();
    const notification = await knex("notifications").where("id", id).del();

    if (!notification) {
      return res.status(404).json("Error removing notification!");
    }
    res.status(204);
  }),
);

router.delete(
  "/agent/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const notification = await knex("notifications").where("id", id).del();

    if (!notification) {
      return res.status(404).json("Error removing notification!");
    }
    res.status(200).json("Notification removed!");
  }),
);

module.exports = router;
