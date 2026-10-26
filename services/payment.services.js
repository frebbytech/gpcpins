// ===============================
// 1. Configuration & Constants

const currencyFormatter = require("../config/currencyFormatter");
const sendElectricityMail = require("../config/ecgMail");
const generateId = require("../config/generateId");
const { mailTextShell } = require("../config/mailText");
const sendEMail = require("../config/sendEmail");
const { sendAirtime, sendBundle } = require("../config/sendMoney");
const { sendSMS } = require("../config/sms");
const { randomBytes } = require("crypto");
const moment = require("moment");

// ===============================
const NETWORK_MAP = {
  "mtn-gh": 4,
  "vodafone-gh": 6,
  "tigo-gh": 1,
  // add others as needed
};

const SUCCESS_CODES = ["00", "09"]; // from external APIs
// const ALLOWED_TYPES = ["voucher", "ticket", "prepaid", "airtime", "bundle"];

// ===============================
// 2. Service Layer
// ===============================
class TransactionService {
  constructor(knex, logger) {
    this.knex = knex;
    this.logger = logger;
  }

  // Fetch transaction based on type and ensure it belongs to the user
  async getTransaction(type, transactionId, userId) {
    let query;
    switch (type) {
      case "voucher":
      case "ticket":
        query = this.knex("voucher_transactions")
          .select("*")
          .where({ id: transactionId, user_id: userId })
          .first();
        break;
      case "prepaid":
        query = this.knex("prepaid_transactions")
          .select(
            "prepaid_transactions.id as id",
            "info",
            "meter",
            "mode",
            "email",
            "mobileNo",
            "prepaid_transactions.createdAt as CreatedAt",
            "status",
            "meters.number as number",
          )
          .join("meters", "prepaid_transactions.meter", "=", "meters.id")
          .where({
            "prepaid_transactions.id": transactionId,
            "prepaid_transactions.user_id": userId,
          })
          .first();
        break;
      case "airtime":
        query = this.knex("airtime_transactions")
          .select(
            "id",
            "type",
            "recipient",
            "email",
            "phonenumber",
            "amount",
            "mode",
            "provider as network",
            "createdAt",
            "isProcessed",
            "status",
          )
          .where({ id: transactionId, user_id: userId })
          .first();
        break;
      case "bundle":
        query = this.knex("bundle_transactions")
          .select(
            "id",
            "recipient",
            "phonenumber",
            "amount",
            "mode",
            "bundle_id as data_code",
            "provider as network",
            "createdAt",
            "isProcessed",
            "status",
          )
          .where({ id: transactionId, user_id: userId })
          .first();
        break;
      default:
        return null;
    }
    return query;
  }

  // Confirm voucher/ticket transaction
  async confirmVoucherTicket(transaction, confirm, userInfo, transx) {
    const { id, info } = transaction;
    const userDetails = JSON.parse(info);
    let selectedVouchers = [];

    // Fetch vouchers based on type
    if (["stadium", "cinema"].includes(userDetails?.type)) {
      const vouchers = await Promise.all(
        userDetails.paymentDetails.tickets.flatMap(async (ticket) => {
          return transx("vouchers")
            .join("categories", "vouchers.category", "=", "categories.id")
            .where({
              "vouchers.category_id": userDetails.categoryId,
              "vouchers.type": ticket.type,
              "vouchers.status": "new",
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
            .limit(ticket.quantity);
        }),
      );
      selectedVouchers = vouchers.flat();
    } else if (userDetails?.type === "bus") {
      selectedVouchers = await transx("vouchers")
        .join("categories", "vouchers.category_id", "=", "categories.id")
        .whereIn("vouchers.type", userDetails.paymentDetails.tickets)
        .andWhere({
          "vouchers.category_id": userDetails.categoryId,
          "vouchers.status": "new",
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
    } else {
      selectedVouchers = await transx("vouchers")
        .join("categories", "vouchers.category_id", "=", "categories.id")
        .where({
          "vouchers.category_id": userDetails.categoryId,
          "vouchers.status": "new",
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
        .limit(userDetails.quantity);
    }

    const soldVoucherIds = selectedVouchers.map((v) => v.id);

    // Update transaction with voucher IDs
    await transx("voucher_transactions")
      .where("id", id)
      .update({ vouchers: JSON.stringify(soldVoucherIds) });

    // Mark vouchers as sold
    await transx("vouchers")
      .whereIn("id", soldVoucherIds)
      .update({ active: 0, status: "sold" });

    // Send SMS notifications (fire-and-forget)
    if (selectedVouchers.length > 0) {
      this.sendVoucherSMS(
        selectedVouchers,
        userDetails,
        transaction.type,
      ).catch((err) => this.logger.error("SMS sending failed", err));
    }

    return soldVoucherIds;
  }

  async sendVoucherSMS(vouchers, userDetails, type) {
    const firstVoucher = vouchers[0];
    const details = JSON.parse(firstVoucher.details || "{}");

    if (type === "voucher") {
      const smsInfo = vouchers.map((v) => `[${v.pin}--${v.serial}]`).join(" ");
      await sendSMS(
        `${firstVoucher.voucherType} ${details.voucherURL || ""}\n[Pin--Serial]\n${smsInfo}.`,
        userDetails.agentPhoneNumber,
      );
    } else if (type === "ticket") {
      const smsInfo = vouchers
        .map((v) => `[${v.type}--${v.serial || v.pin}]`)
        .join(" ");
      await sendSMS(
        `${firstVoucher.voucherType}\n[Seat No./Type--Serial]\n${smsInfo},\n\n${moment(
          details.date,
        ).format(
          "dddd, Do MMMM, YYYY",
        )}, ${moment(details.time).format("hh:mm a")},\n${
          userDetails.agentEmail || ""
        }, ${userDetails.agentPhoneNumber}. Please visit https://www.gpcpins.com/evoucher to print your tickets.`,
        userDetails.agentPhoneNumber,
      );
    }
  }

  // Confirm bulk airtime
  async confirmBulkAirtime(transaction) {
    const recipients = JSON.parse(transaction.recipient);
    const recipientList = recipients.map(
      (r) => `${r.type}(${r.recipient}) – ${currencyFormatter(r.price)}`,
    );
    const formatter = new Intl.ListFormat("en", {
      style: "long",
      type: "conjunction",
    });
    const formattedList = formatter.format(recipientList);

    // Notify customer
    await sendSMS(
      `Your request to buy bulk airtime has been received. Transaction ID: ${transaction.id}. Thank you!`,
      transaction.phonenumber,
    );

    // Notify admin (fire-and-forget)
    const message = `The number ${transaction.phonenumber} (Email: ${
      transaction.email || ""
    }) has successfully made payment to transfer bulk airtime to: ${formattedList}.`;

    if (process.env.NODE_ENV === "production") {
      Promise.all([
        sendEMail(
          process.env.MAIL_CLIENT_USER,
          mailTextShell(`<p>${message}</p>`),
          "BULK AIRTIME REQUEST",
        ),
        sendSMS(message, process.env.CLIENT_PHONENUMBER),
      ]).catch((err) => this.logger.error("Admin notification failed", err));
    }

    // Insert notification
    await this.knex("notifications").insert({
      id: generateId(),
      title: "Bulk Airtime Transfer",
      message,
    });
  }

  // Confirm bundle (data) transaction
  async confirmBundle(transaction, userId) {
    const bundleInfo = {
      recipient: transaction.recipient,
      data_code: transaction.data_code,
      network: NETWORK_MAP[transaction.network] || 0,
      transaction_reference: randomBytes(24).toString("hex"),
    };

    const response = await sendBundle(bundleInfo);

    if (SUCCESS_CODES.includes(response["status-code"])) {
      await this.knex("bundle_transactions")
        .where("id", transaction.id)
        .update({ isProcessed: 1 });

      await this.knex("user_notifications").insert({
        id: generateId(),
        user_id: userId,
        type: "bundle",
        title: "Data Bundle Transfer",
        message: `You have successfully recharged ${bundleInfo.recipient} with data bundle "${bundleInfo.data_code}". You were charged GHS ${transaction.amount}. Transaction ID: ${transaction.id}`,
      });

      const balance = Number(response.balance_after);
      if (balance < 1000) {
        this.notifyLowBalance(balance);
      }
    } else {
      throw new Error("Bundle transfer failed");
    }
  }

  // Confirm single airtime
  async confirmSingleAirtime(transaction, userId) {
    const airtimeInfo = {
      recipient: transaction.recipient,
      amount: transaction.amount,
      network: NETWORK_MAP[transaction.network] || 0,
      transaction_reference: randomBytes(24).toString("hex"),
    };

    const response = await sendAirtime(airtimeInfo);

    if (SUCCESS_CODES.includes(response["status-code"])) {
      await this.knex("airtime_transactions")
        .where("id", transaction.id)
        .update({ isProcessed: 1 });

      await this.knex("user_notifications").insert({
        id: generateId(),
        user_id: userId,
        type: "airtime",
        title: "Airtime Transfer",
        message: `You have successfully recharged ${airtimeInfo.recipient} with GHS ${airtimeInfo.amount} of airtime. Transaction ID: ${transaction.id}`,
      });

      const balance = Number(response.balance_after);
      if (balance < 1000) {
        this.notifyLowBalance(balance);
      }
    } else {
      throw new Error("Airtime transfer failed");
    }
  }

  // Confirm prepaid electricity
  async confirmPrepaid(transaction, info) {
    const message = `The number ${transaction.mobileNo} with METER NO. '${transaction.number}' has successfully made payment to buy PREPAID UNITS at an amount of ${currencyFormatter(
      info.amount,
    )}.`;

    await this.knex("notifications").insert({
      id: generateId(),
      title: "Prepaid Units",
      message,
    });

    if (transaction.email) {
      // Fire-and-forget email
      sendElectricityMail(transaction.id, transaction.email, "pending").catch(
        (err) => this.logger.error("Electricity mail failed", err),
      );
    }

    // Notify customer and admin (fire-and-forget)
    Promise.all([
      sendSMS(
        `Thank you for your purchase! You will be notified shortly after your transaction is complete. Transaction ID: ${transaction.id}`,
        transaction.mobileNo,
      ),
      sendEMail(
        process.env.MAIL_CLIENT_USER,
        mailTextShell(`<p>${message}</p>`),
        "Prepaid Units",
      ),
    ]).catch((err) => this.logger.error("Prepaid notifications failed", err));
  }

  async notifyLowBalance(balance) {
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
}

module.exports = TransactionService;
