/*
|--------------------------------------------------------------------------
| PAYMENT SUCCESS EMITTER
|--------------------------------------------------------------------------
|
| Use this after:
| - payment webhook verification
| - DB update
| - wallet credit
|
*/

const logger = require("../utils/logger");
const { getIO } = require("./socket");

const emitPaymentSuccess = async ({ userId, txRef, amount, transaction }) => {
  try {
    /*
        |--------------------------------------------------------------------------
        | EMIT TO USER ROOM
        |--------------------------------------------------------------------------
        */
    const io = getIO();

    if (userId) {
      io.to(`user:${userId}`).emit("payment-success", {
        success: true,
        txRef,
        amount,
        transaction,
      });

      io.to(`payment:${userId}`).emit("payment-success", {
        success: true,
        txRef,
        amount,
        transaction,
      });
      logger.log(`Payment success emitted from: user:payment:${userId} `);
    }

    /*
    |--------------------------------------------------------------------------
    | EMIT TO PAYMENT ROOM
    |--------------------------------------------------------------------------
    |
    | For guest users
    |
    */

    io.to(`payment:${txRef}`).emit("payment-success", {
      success: true,
      txRef,
      amount,
      transaction,
    });

    logger.log(`Payment success emitted:from payment:payment:${txRef}`);
  } catch (error) {
    console.error(error);
  }
};

/*
|--------------------------------------------------------------------------
| PAYMENT FAILED EMITTER
|--------------------------------------------------------------------------
*/

const emitPaymentFailure = async ({ userId, txRef, reason }) => {
  const io = getIO();
  try {
    if (userId) {
      io.to(`user:${userId}`).emit("payment-failed", {
        success: false,
        txRef,
        reason,
      });

      io.to(`payment:${userId}`).emit("payment-failed", {
        success: false,
        txRef,
        reason,
      });
    }

    io.to(`user:${txRef}`).emit("payment-failed", {
      success: false,
      txRef,
      reason,
    });

    io.to(`payment:${txRef}`).emit("payment-failed", {
      success: false,
      txRef,
      reason,
    });
  } catch (error) {
    console.error(error);
  }
};

/*
|--------------------------------------------------------------------------
| WALLET UPDATE EMITTER
|--------------------------------------------------------------------------
*/

const emitWalletUpdate = async ({ userId, balance }) => {
  const io = getIO();
  try {
    io.to(`user:${userId}`).emit("wallet-updated", {
      balance,
    });
  } catch (error) {
    console.error(error);
  }
};

const emitCheckerUpdate = async ({ userId, data }) => {
  const io = getIO();
  try {
    io.to(`user:${userId}`).emit("general", {
      data,
    });
  } catch (error) {
    console.error(error);
  }
};

const emitGeneralInfo = async ({ emitter, userId, data }) => {
  const io = getIO();
  try {
    io.to(`user:${userId}`).emit(emitter, {
      data,
    });

    io.to(`payment:${userId}`).emit(emitter, {
      data,
    });
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  emitPaymentSuccess,
  emitPaymentFailure,
  emitWalletUpdate,
  emitCheckerUpdate,
  emitGeneralInfo,
};
