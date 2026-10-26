const { Worker } = require("bullmq");
const moment = require("moment");
const _ = require("lodash");

const redisClient = require("../config/redisClient");
const knex = require("../db/knex");
const { safeJSON } = require("../config/helpers");
const currencyFormatter = require("../config/currencyFormatter");
const processVouchers = require("../config/processVouchers");
const { uploadVoucherFile } = require("../config/uploadFile");
const { redisConnectionOptions } = require("../config/configurations");
const logger = require("../utils/logger");
const { emitGeneralInfo } = require("../config/emitters");
const generateQRCode = require("../config/qrcode");
const generateId = require("../config/generateId");
const { sendTicketMail } = require("../config/mail");
const { sendSMS } = require("../config/sms");
const { messageQueue } = require("../queues/message.queue");
const { getInternationalMobileFormat } = require("../config/PhoneCode");
const { formatDate, formatTime } = require("../config/dateConfigs");
const { imageUrlToBase64 } = require("../config/ImageToBase64");

const WORKER_CONCURRENCY = 10;

const ticketWorker = new Worker(
  "ticket-generation",

  async (job) => {
    const { transactionId, userID } = job.data;

    const lockKey = `ticket:worker:${transactionId}`;
    const lock = await redisClient.set(lockKey, process.pid, "NX", "EX", 600);

    if (!lock) {
      logger.info(`Ticket already being processed: ${transactionId}`);
      return;
    }

    let trx;

    try {
      trx = await knex.transaction();

      const transaction = await trx("vw_payments_voucher_transactions")
        .where("id", transactionId)
        .first();

      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      const {
        id,
        paymentId,
        paymentReference,
        info,
        email,
        phonenumber,
        vouchers,
        createdAt,
        updatedAt,
      } = transaction;

      const userInfo = safeJSON(info);
      const userVoucher = safeJSON(vouchers);

      // ----------------------------------------
      // IDEMPOTENCY CHECK
      // ----------------------------------------

      if (userInfo?.downloadLink) {
        logger.info(`Ticket already generated: ${transactionId}`);

        await trx.commit();

        return;
      }

      const { categoryType, categoryId, paymentDetails } = userInfo;

      let soldVouchers = [];
      let tickets = [];
      let ticketName = "";

      // ========================================
      // CINEMA / STADIUM
      // ========================================

      if (["stadium", "cinema"].includes(categoryType)) {
        const ticketTypes = paymentDetails.tickets.map((item) => item.type);

        soldVouchers = await trx("vw_category_voucher_view")
          .whereIn("id", userVoucher)
          .whereIn("voucherType", ticketTypes)
          .select(
            "id",
            "pin",
            "serial",
            "voucherType as type",
            "categoryId",
            "name as voucherType",
            "price",
            "categoryDetails as details",
            "year",
          );
      }

      // ========================================
      // BUS
      // ========================================

      if (categoryType === "bus") {
        soldVouchers = await trx("vw_category_voucher_view")
          .whereIn("voucherType", paymentDetails.tickets)
          .andWhere({ categoryId: categoryId })
          .select(
            "id",
            "pin",
            "serial",
            "voucherType as type",
            "categoryId",
            "name as voucherType",
            "price",
            "categoryDetails as details",
            "year",
          );
      }

      if (_.isEmpty(soldVouchers)) {
        throw new Error(`No vouchers found for transaction ${id}`);
      }

      // ========================================
      // GENERATE QR CODES
      // ========================================

      const generatedTickets = await Promise.all(
        soldVouchers.map(async (voucher) => {
          const details = safeJSON(voucher.details);

          const qrCode = await generateQRCode(voucher.id, voucher.id);

          if (categoryType === "bus") {
            return {
              id: voucher.id,
              seatNo: voucher.type || details.seatNo,
              serial: voucher.serial || voucher.pin,
              qrCode,
            };
          }

          const pricing = _.find(
            details.pricing,
            (p) => p.type === voucher.type,
          );

          return {
            id: voucher.id,
            serial: voucher.serial || voucher.pin,
            qrCode,
            type: voucher.type,
            price: currencyFormatter(pricing?.price),
          };
        }),
      );

      tickets = generatedTickets;

      ticketName = soldVouchers[0]?.voucherType || "GPC";

      // ========================================
      // GENERATE PDF
      // ========================================

      let generatedTransaction = {};
      const details = safeJSON(soldVouchers[0].details);
      switch (categoryType) {
        case "bus":
          // const busLogo = details?.logo
          //   ? await imageUrlToBase64(details?.logo)
          //   : "";

          //for bus
          generatedTransaction = {
            id,
            route: soldVouchers[0]?.voucherType,
            price: currencyFormatter(soldVouchers[0]?.price),
            origin: details.origin,
            destination: details.destination,
            vehicleNo: details.vehicleNo,
            // logo: busLogo,
            arrivalTime: formatTime(details.report),
            departureDate: formatDate(details.date),
            departureTime: formatTime(details.time),
            message: details?.message,
            companyName: details?.companyName,
            year: soldVouchers[0]?.year,
            vouchers: tickets,
            info: {
              categoryType,
            },
          };
          break;
        case "cinema":
          const movieLogo = details?.cinema
            ? await imageUrlToBase64(details?.cinema)
            : "";

          //for cinema
          generatedTransaction = {
            id,
            movie: details?.movie,
            theatre: details?.theatre,
            location: details?.location,
            date: formatDate(details?.date),
            time: formatTime(details?.time),
            message: details?.message,
            companyName: details?.companyName,
            cinema: movieLogo,
            vouchers: tickets,
            info: {
              categoryType,
            },
          };
          break;
        case "stadium":
          const homeImage = details?.homeImage
            ? await imageUrlToBase64(details?.homeImage)
            : "";
          const awayImage = details?.awayImage
            ? await imageUrlToBase64(details?.awayImage)
            : "";

          //for cinema
          generatedTransaction = {
            id,
            match: details?.match,
            homeImage,
            awayImage,
            homeTeam: details?.home,
            awayTeam: details?.away,
            matchType: details?.matchType,
            venue: details?.venue,
            date: formatDate(details?.date),
            time: formatTime(details?.time),
            message: details?.message,
            companyName: details?.companyName,
            vouchers: tickets,
            info: {
              categoryType,
            },
          };
          break;

        default:
          generatedTransaction = {
            info: {
              categoryType,
            },
            id,
            phonenumber,
            email,
            createdAt,
            updatedAt,
            formattedDate: moment(createdAt).format("LLL"),
            vouchers: tickets,
          };
      }

      const result = await processVouchers(generatedTransaction);

      if (result !== "done") {
        throw new Error("PDF generation failed");
      }

      const downloadLink = await uploadVoucherFile(`${id}.pdf`);

       if (!downloadLink) {
        throw new Error("Upload failed");
      }

      
      await emitGeneralInfo({
        emitter: "ticket-generation",
        userId: userID || phonenumber || paymentReference,
        data: downloadLink,
      });

      // ========================================
      // UPDATE DATABASE
      // ========================================

      await trx("voucher_transactions")
        .where("id", id)
        .update({
          info: JSON.stringify({
            ...userInfo,
            downloadLink,
          }),
        });

      await trx("payments").where("id", paymentId).update({
        is_processed: true,
        updated_at: knex.fn.now(),
      });

      if (userID) {
        await trx("notifications").insert({
          id: generateId(),
          user_id: userID,
          type: "ticket",
          title: `${ticketName} Ticket`,
          body: `${ticketName} tickets generated successfully.`,
          link: downloadLink,
        });
      }

      await trx.commit();

      // ========================================
      // EMAIL
      // ========================================

      if (email) {
        await sendTicketMail(id, email, `${ticketName} Tickets`);
      }

      // ========================================
      // SMS
      // ========================================

      if (phonenumber && downloadLink) {
        await sendSMS(
          `Download your ${ticketName} tickets here: ${downloadLink}`,
          phonenumber,
        );
      }

      // ========================================
      // WHATSAPP
      // ========================================

      if (phonenumber && downloadLink) {
        await messageQueue.add(
          "send-document",
          {
            sessionId: process.env.WHATSAPP_SESSION_ID,
            type: "send-document",
            phone: getInternationalMobileFormat(phonenumber),
            message: downloadLink,
            downloadLink,
            fileName: `${id}.pdf`,
            caption: `Here is your ${ticketName} ticket.`,
          },
          {
            jobId: `ticket-wa-${id}`,
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
            removeOnComplete: 100,
          },
        );
      }

      logger.info(`Ticket generated successfully: ${id}`);
    } catch (error) {
      if (trx) {
        await trx.rollback();
      }

      logger.error(error);

      throw error;
    } finally {
      await redisClient.del(lockKey);
    }
  },

  {
    connection: redisConnectionOptions,
    concurrency: WORKER_CONCURRENCY,

    removeOnComplete: {
      age: 86400,
      count: 1000,
    },

    removeOnFail: false,
  },
);

ticketWorker.on("completed", (job) => {
  logger.info(`Ticket job completed: ${job.id}`);
});

ticketWorker.on("failed", (job, error) => {
  logger.error(`Ticket job failed: ${job?.id}`, error);
});

module.exports = ticketWorker;
