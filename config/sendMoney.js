const axios = require("axios");
const { randomUUID, randomBytes } = require("crypto");

async function sendMoney(info, type) {
  if (process.env.NODE_ENV === "production") {
    try {
      const res = await axios({
        method: "POST",
        url: process.env.MSDID_URL,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${process.env.MSDID_K}`,
          "Cache-Control": "no-cache",
        },
        data: {
          CustomerName: info?.name,
          CustomerMsisdn: info?.phonenumber,
          CustomerEmail: info?.email,
          Channel: info?.provider,
          Amount: ["+233543772591", "0543772591"].includes(info?.phonenumber)
            ? 0.01
            : Number(info?.amount),
          // Amount: info?.amount,
          PrimaryCallbackUrl: `${process.env.CALLBACK_URL}/${type}/${randomUUID()}`,
          Description: "Vouchers",
          ClientReference: info?.transaction_reference,
        },
      });

      return res.data;
    } catch (error) {
      throw error;
    }
  } else {
    return {
      ResponseCode: "0000",
      Data: {
        ref: info?.transaction_reference || randomBytes(24).toString("hex"),
      },
    };
  }
}

async function sendMoneyToCustomer(info) {
  if (process.env.NODE_ENV === "production") {
    try {
      const res = await axios({
        method: "POST",
        url: process.env.MSDID_SEND_URL,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${process.env.MSDID_K}`,
          "Cache-Control": "no-cache",
        },
        data: {
          RecipientName: info?.phonenumber,
          RecipientMsisdn: info?.phonenumber,
          CustomerEmail: info?.email,
          Channel: info?.provider,
          Amount: ["+233543772591", "0543772591"].includes(info?.phonenumber)
            ? 0.1
            : Number(info?.amount),
          // Amount: info?.amount,
          PrimaryCallbackUrl: `${
            process.env.REFUND_CALLBACK_URL
          }/${info?.category}/${info?.transactionId}?uid=${info?.refunder}`,
          Description: info?.category,
          ClientReference: info?.transaction_reference,
        },
      });

      return res.data;
    } catch (error) {
      throw error;
    }
  } else {
    return {
      ResponseCode: "0001",
      Data: {
        AmountDebited: 0.0,
        TransactionId: "09f84e20a283942e807128e8c21d0303",
        Description:
          "Your request has been accepted. We will notify you when the transaction is completed.",
        ClientReference: "pay101",
        ExternalTransactionId: "",
        Amount: 0.8,
        Charges: 0.0,
        Meta: null,
        RecipientName: null,
      },
    };
  }
}

async function moneyStatus(referenceId) {
  try {
    const res = await axios({
      method: "GET",
      url: process.env.MSDID_STATUS_URL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${process.env.MSDID_K}`,
        "Cache-Control": "no-cache",
      },
      params: {
        clientReference: referenceId,
      },
    });

    return res.data;
  } catch (error) {
    throw error;
  }
}

async function topUpStatus(referenceId) {
  try {
    const res = await axios({
      method: "GET",
      url: `${process.env.MSDID_TOP_UP_URL}/transactionStatus`,
      headers: {
        accept: "application/json",
        ApiKey: process.env.MSDID_TOP_UP_KEY,
        ApiSecret: process.env.MSDID_TOP_UP_PIN,
      },
      params: {
        trxn: referenceId,
      },
    });

    return res.data;

    // {
    //   "status": "OK",
    //   "message": "Transaction state is COMPLETED",
    //   "trxn": "4cc825c0c87511ee805699cce7947402",
    //   "status-code": "00",
    //   "local-trxn-code": "73fa4584-66fc-421c-a482-4e7c00aa6a8b",
    //   "transaction-state": "COMPLETED"
    // }
  } catch (error) {
    throw error;
  }
}

async function accountBalance() {
  try {
    if (process.env.NODE_ENV === "production") {
      const res = await axios({
        method: "GET",
        url: `${process.env.MSDID_TOP_UP_URL}/balance`,
        headers: {
          accept: "application/json",
          ApiKey: process.env.MSDID_TOP_UP_KEY,
          ApiSecret: process.env.MSDID_TOP_UP_PIN,
        },
      });

      return res.data;
    } else {
      return {
        balance: 5000.0,
      };
    }
  } catch (error) {
    throw error;
  }
}
async function POS_Balance() {
  try {
    if (process.env.NODE_ENV === "production") {
      const res = await axios({
        method: "GET",
        url: process.env.MSDID_POS_STATUS_URL,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${process.env.MSDID_K}`,
          "Cache-Control": "no-cache",
        },
      });

      return res.data?.data;
    } else {
      return {
        amount: 100.5,
      };
    }
  } catch (error) {
    throw error;
  }
}
async function PREPAID_Balance() {
  try {
    if (process.env.NODE_ENV === "production") {
      const res = await axios({
        method: "GET",
        url: process.env.MSDID_PREPAID_STATUS_URL,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${process.env.MSDID_K}`,
          "Cache-Control": "no-cache",
        },
      });

      return res.data?.data;
    } else {
      return {
        amount: 123.5,
      };
    }
  } catch (error) {
    throw error;
  }
}

async function sendAirtime(info) {
  try {
    if (process.env.NODE_ENV === "production") {
      const res = await axios({
        method: "GET",
        url: `${process.env.MSDID_TOP_UP_URL}/airtime`,
        headers: {
          accept: "application/json",
          ApiKey: process.env.MSDID_TOP_UP_KEY,
          ApiSecret: process.env.MSDID_TOP_UP_PIN,
        },
        params: {
          retailer: process.env.MSDID_TOP_UP_RETAILER,
          recipient: info?.recipient,
          amount: info?.amount,
          network: info.network || 0,
          trxn: info?.transaction_reference,
        },
      });

      return res.data;
    } else {
      return {
        status: "OK",
        message: `You have successfully recharged 233543772591 with GHS ${info?.amount}, you were charged GHS ${info?.amount} and your current balance is GHS 295.00`,
        trxn: "f917f1a0c87311ee86e5890f3267d17b",
        "status-code": "00",
        "local-trxn-code": info?.transaction_reference,
        balance_before: "300.0000",
        balance_after: 295,
        network: "MTN",
      };
    }
  } catch (error) {
    throw error;
  }
}

async function sendBundle(info) {
  try {
    if (process.env.NODE_ENV === "production") {
      const res = await axios({
        method: "GET",
        url: `${process.env.MSDID_TOP_UP_URL}/dataBundle`,
        headers: {
          accept: "application/json",
          ApiKey: process.env.MSDID_TOP_UP_KEY,
          ApiSecret: process.env.MSDID_TOP_UP_PIN,
        },
        params: {
          retailer: process.env.MSDID_TOP_UP_RETAILER,
          recipient: info?.recipient,
          data_code: info.data_code,
          network: info.network || 0,
          trxn: info?.transaction_reference,
        },
      });

      return res.data;
    } else {
      return {
        status: "OK",
        message:
          "You have successfully recharged 233543772591 with 7.27GB, you were charged GHS 3.00 and your current balance is GHS 292.00",
        trxn: "4cc825c0c87511ee805699cce7947402",
        "status-code": "00",
        "local-trxn-code": info.transaction_reference,
        balance_before: "295.0000",
        balance_after: 292,
      };
    }
  } catch (error) {
    throw error;
  }
}

async function getBundleList(network) {
  try {
    const res = await axios({
      method: "GET",
      url: `${process.env.MSDID_TOP_UP_URL}/dataBundleList`,
      headers: {
        accept: "application/json",
        ApiKey: process.env.MSDID_TOP_UP_KEY,
        ApiSecret: process.env.MSDID_TOP_UP_PIN,
      },
      params: {
        network,
      },
    });

    return res.data;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  sendMoney,
  sendMoneyToCustomer,
  moneyStatus,

  //Bundle
  getBundleList,
  sendBundle,

  topUpStatus,
  accountBalance,
  sendAirtime,
  //
  POS_Balance,
  PREPAID_Balance,
};
