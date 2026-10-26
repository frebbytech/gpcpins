const router = require("express").Router();
const moment = require("moment");
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const sendEMail = require("../config/sendEmail");
const { mailTextShell } = require("../config/mailText");
const { sendBatchSMS, sendSMS } = require("../config/sms");

//model
const verifyAdmin = require("../middlewares/verifyAdmin");

//db
const knex = require("../db/knex");
const { isValidUUID2 } = require("../config/validation");
const generateId = require("../config/generateId");
const { verifyToken } = require("../middlewares/verifyToken");
const logger = require("../utils/logger");

router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { role, createdAt } = req.user;

    const broadcastMessages = await knex("broadcast_messages")
      .select("*", "is_delivered as isDelivered", "created_at as createdAt")
      .orderBy("created_at", "desc");

    if (role === process.env.USER_ID) {
      const filteredMessages = broadcastMessages.filter((message) =>
        moment(message.createdAt).isAfter(createdAt),
      );
      return res.status(200).json(filteredMessages);
    }

    res.status(200).json(broadcastMessages);
  }),
);

router.get(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request!");
    }

    const broadcastMessage = await knex("broadcast_messages")
      .select("*", "is_delivered as isDelivered", "created_at as createdAt")
      .where("id", id)
      .first();

    res.status(200).json(broadcastMessage);
  }),
);

router.post(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user;
    const { phoneNumber, email, group, ...newBroadcastMessage } = req.body;
    const { recipient, type, title, body: message } = req.body || {};

    const transx = await knex.transaction();
    const id = generateId();

    try {
      // 1. Determine recipient data structure safely
      const isBulkRecipient = ["Customers", "Employees", "Group"].includes(
        recipient,
      );
      const recipientValue = isBulkRecipient
        ? newBroadcastMessage?.recipient
        : type === "SMS"
          ? phoneNumber
          : email;
      const groupedValue =
        recipient === "Group" ? JSON.stringify(group) : JSON.stringify([]);

      // 2. Perform DB operations inside the transaction
      const insertedMessage = await transx("broadcast_messages").insert({
        id,
        ...newBroadcastMessage,
        recipient: recipientValue,
        grouped: groupedValue,
      });

      if (!insertedMessage) {
        console.error("Transaction failed:", "Failed to insert broadcast message.");
        await transx.rollback();
        return res.status(400).json("Message Failed. An error has occurred.");
      }

      await transx("activity_logs").insert({
        user_id: userID,
        title: "Broadcasted a message!",
        severity: "info",
      });

      // 3. Commit early to release database locks
      await transx.commit();

   
      // 4. Respond instantly to the user
      res.status(201).json("Message processing started!");
    } catch (error) {
      await transx.rollback();
      logger.error("Message failed:", {cause: error.message, stack: error.stack});
      console.error("Transaction failed:", error);
      return res.status(500).json("Message Failed. An error has occurred.");
    }

    // 5. Fire-and-forget notification block (Runs safely in the background)
    try {
      const MAIL_TEXT = `<div><h2>${title}</h2><div style='text-align:left;'><div>${message}</div></div></div>`;
      const targetColumn = type === "Email" ? "email" : "phonenumber";

      let contacts = [];

      if (recipient === "Individual") {
        contacts = [type === "Email" ? email : phoneNumber];
      } else if (recipient === "Group") {
        contacts = group || [];
      } else if (recipient === "Customers") {
        // Query only the specific field required using standard Knex
        const elec = await knex("electricity_transactions").distinct(
          targetColumn,
        );
        const vouch = await knex("voucher_transactions").distinct(targetColumn);
        const users = await knex("vw_users_with_roles")
          .distinct(targetColumn)
          .where("role", process.env.USER_ID);

        contacts = [
          ...new Set(
            [...elec, ...vouch, ...users].map((item) => item[targetColumn]),
          ),
        ].filter(Boolean);
      } else if (recipient === "Employees") {
        const employees = await knex("vw_users_with_roles")
          .distinct(targetColumn)
          .where("role", process.env.EMPLOYEE_ID);
        contacts = employees.map((item) => item[targetColumn]).filter(Boolean);
      }

      if (contacts.length === 0) return;

      // 6. Execute external communications
      if (type === "Email") {
        // Send individually or pass array depending on your mail client capability
        await sendEMail(contacts, mailTextShell(MAIL_TEXT));
      } else if (type === "SMS") {
        if (recipient === "Individual") {
          await sendSMS(message, contacts[0]);
        } else {
          await sendBatchSMS(message, contacts);
        }
      }
    } catch (bgError) {
      logger.error("Background delivery failed:", {cause: bgError.message, stack: bgError.stack});
      // Soft-update failure without crashing the active client response
      await knex("broadcast_messages")
        .where("id", id)
        .update({ is_delivered: false });
    }
  }),
);

router.put(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.body;

    const newBroadcastMessage = await knex("broadcast_messages")
      .select("*")
      .where("id", id)
      .first();

    const MAIL_TEXT = `<div>
    <h2>${newBroadcastMessage?.title}</h2>
    <div style='text-align:left;'> 
    <div>${newBroadcastMessage.message}</div>
    </div>
   
     </div>`;

    const MESSAGE_TEXT = `${newBroadcastMessage.message}`;

    let info = [];

    try {
      if (
        !["Customers", "Employees", "Group"].includes(
          newBroadcastMessage?.recipient,
        )
      ) {
        if (newBroadcastMessage?.type === "Email") {
          await sendEMail(
            newBroadcastMessage?.recipient,
            mailTextShell(MAIL_TEXT),
          );
        }
        if (newBroadcastMessage?.type === "SMS") {
          await sendSMS(MESSAGE_TEXT, newBroadcastMessage?.recipient);
        }

        return res.status(201).json("Message sent!!!");
      }

      if (newBroadcastMessage?.recipient === "Group") {
        if (newBroadcastMessage?.type === "Email") {
          await sendEMail(
            JSON.parse(newBroadcastMessage?.grouped),
            mailTextShell(MAIL_TEXT),
          );
        }
        if (newBroadcastMessage?.type === "SMS") {
          await sendBatchSMS(
            MESSAGE_TEXT,
            JSON.parse(newBroadcastMessage?.grouped),
          );
        }

        return res.status(201).json("Message sent!!!");
      }

      if (newBroadcastMessage?.recipient === "Customers") {
        const electricityTransactions = await knex(
          "prepaid_transactions",
        ).select("email", "mobileNo as phonenumber");
        const transactions = await knex("voucher_transactions").select(
          "email",
          "phonenumber",
        );

        const users = await knex("users").select("email", "phonenumber");
        const employees = await knex("employees").select(
          "email",
          "phonenumber",
        );

        info = [
          ...electricityTransactions,
          ...transactions,
          ...users,
          ...employees,
        ];
      }

      if (newBroadcastMessage?.recipient === "Employees") {
        info = await knex("employees").select("email", "phonenumber");
      }

      if (newBroadcastMessage?.type === "Email") {
        const emails = _.uniqWith(_.compact(_.map(info, "email")), _.isEqual);
        await sendEMail(emails, mailTextShell(MAIL_TEXT));
      }

      if (newBroadcastMessage?.type === "SMS") {
        const numbers = _.uniqWith(
          _.compact(_.map(info, "phonenumber")),
          _.isEqual,
        );

        await sendBatchSMS(MESSAGE_TEXT, numbers);
      }
      await knex("broadcast_messages")
        .where("id", id)
        .update({ isDelivered: true });
      return res.status(201).json("Message sent!!!");
    } catch (error) {
      console.error("Message sending failed:", error);
      return res.status(404).json("Message Failed. An error has occurred.");
    }
  }),
);

router.put(
  "/delete-all",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { messages } = req.body;

    await knex("broadcast_messages").where("id", "IN", messages).del();

    res.sendStatus(204);
  }),
);

router.delete(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.query;

    if (!isValidUUID2(id)) {
      return res.status(400).json("An unknown error has occurred!");
    }

    const broadcastMessage = await knex("broadcast_messages")
      .where("id", id)
      .del();

    if (broadcastMessage !== 1) {
      return res.status(404).json("An error has occurred!");
    }
    res.status(200).json("Message removed.");
  }),
);

module.exports = router;
