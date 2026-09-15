const { v4: uuidv4 } = require("uuid");
const { brassicaPost } = require("../../services/brassicaClient");
const logger = require("../../utils/logger");

async function sendBrassicaMoney(payload) {
  try {
    const {
      institutionCode,
      accountNumber,
      accountName,
      amount,
      transaction_Id,
      debitNaration = "Purchase Prepaid Unit",
    } = payload;

    // console.log(payload)

    const code =
      institutionCode === "mtn-gh"
        ? "300591"
        : institutionCode === "vodafone-gh"
          ? "300594"
          : institutionCode === "tigo-gh"
            ? "300592"
            : "300591";

    const transactionId =
      transaction_Id || uuidv4().replace(/-/g, "").slice(0, 40);

    logger.info(
      `[DebitMoney] txId=${transactionId} amount=${amount} from=${accountNumber}`,
    );

    const data = await brassicaPost("/debitMoney", {
      channel: "mno",
      institutionCode: code,
      accountNumber,
      accountName,
      amount: ["233543772591", "0543772591"].includes(accountNumber)
        ? "0.01"
        : amount,
      debitNaration,
      transactionId,
    });

    // console.log(data)

    if (data?.statusCode !== "202" || data?.status !== "ACCEPTED") {
      throw new Error("Error processing payment");
    }


    return { success: true, data };
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
}

async function getBrassicaBalance() {
  try {
    logger.info("[GetBalance] Fetching available float balance.");

    // Brassica requires POST with no body
    const data = await brassicaPost("/GetAvailableBalance", {});

    return data;
  } catch (err) {
    throw new Error(err);
  }
}

async function getBrassicaTransactionStatus(transactionId, transactionType) {
  try {
    logger.info(
      `[GetTransactionStatus] Fetching status for  txId=${transactionId} type=${transactionType}`,
    );

    const data = await brassicaPost("/transStatusQuery", {
      transactionType,
    //  transactionId: "5365tet055520509"
      transactionId,
    });
    // console.log(data);

    return data;
  } catch (err) {
    console.log(err);
    throw new Error(err?.raw?.message || "Error fetching transaction status");
  }
}

module.exports = {
  sendBrassicaMoney,
  getBrassicaBalance,
  getBrassicaTransactionStatus,
};
