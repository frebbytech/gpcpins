import api from "./customAxios";
import { v4 as uuid } from "uuid";

export const getWalletBalance = async (id) => {
  try {
    const res = await api({
      method: "GET",
      url: `/wallet/balance?id=${id}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const getWalletTransaction = async ({ startDate, endDate }) => {
  try {
    const res = await api({
      method: "GET",
      url: `/wallet/transactions`,
      params: {
        startDate,
        endDate,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getWalletResetToken = async ({ token }) => {
  try {
    const res = await api({
      method: "GET",
      url: `/wallet/pin-reset`,
      params: {
        code: token,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getWalletStatus = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/wallet/status`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const sendWalletTopUpRequest = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/wallet/top-up-request`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const sendWalletTopUp = async (data) => {
  try {
    const res = await api({
      method: "POST",
      headers: {
        "Idempotency-Key": uuid(),
      },
      url: `/payment/wallet-topup`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const disableWallet = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/wallet/status?action=disable`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const updateWalletPin = async (data) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/wallet`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
