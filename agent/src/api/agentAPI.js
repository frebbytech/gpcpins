// import { isMobileBrowser } from "../config/isMobileBrowser";
import axios from "axios";
import { getToken, saveToken, saveUser } from "../config/sessionHandler";
import api from "./customAxios";

const BASE_URL = import.meta.env.VITE_BASE_URL;

export const getAgent = async () => {
  const token = getToken();
  try {
    const res = await axios({
      method: "GET",
      url: `${BASE_URL}/agents/auth`,
      withCredentials: true,
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getAgentToken = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/agents/token`,
    });

    // if (isMobileBrowser()) {
    //   cookie.set("_SSID_xbAb__", JSON.stringify(res.data?.refreshToken), {
    //     secure: true,
    //     sameSite: "None",
    //     expires: ACCESS_EXPIRATION,
    //   });
    // }

    saveToken(res.data?.accessToken, res.data?.refreshToken);

    return res.data;
  } catch (error) {
    throw "an error has occurred";
  }
};

export const loginAgent = async (agentInfo) => {
  try {
    const res = await api({
      method: "POST",
      url: `/agents/login`,
      data: agentInfo,
    });

    saveToken(res.data?.accessToken, res.data?.refreshToken);
    saveUser(res.data?.accessToken);

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const logoutAgent = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/agents/logout`,
      data,
    });

    return res.status;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyAgent = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/agents/verify`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyAgentOTP = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/agents/verify-otp`,
      data,
    });

    // if (isMobileBrowser()) {
    //   cookie.set("_SSID_xbAb__", JSON.stringify(res.data?.refreshToken), {
    //     secure: true,
    //     sameSite: "None",
    //     expires: ACCESS_EXPIRATION,
    //   });
    // }

    // cookie.set("_USSID_kcYa__", JSON.stringify(res.data?.user), {
    //   secure: true,
    //   sameSite: "None",
    //   expires: ACCESS_EXPIRATION,
    // });

    saveToken(res.data?.accessToken, res.data?.refreshToken);
    saveUser(res.data?.accessToken);

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyUserIdentity = async (data) => {
  try {
    const res = await api({
      method: "GET",
      url: `/agents/verify-identity`,
      params: {
        ...data,
      },
    });

    saveToken(res.data?.accessToken, res.data?.refreshToken);
    saveUser(res.data?.accessToken);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const updateAgentProfile = async (data) => {
  const formData = new FormData();
  formData.append("id", data?.id);
  formData.append("profile", data?.profile);

  try {
    const res = await api({
      method: "PUT",
      url: `/agents/profile`,
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  } catch (error) {
    throw new Error(error.response.data || "Error Updating profile");
  }
};

export const putAgent = async (updatedAgent) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/agents`,
      data: updatedAgent,
    });

    // cookie.set("_USSID_kcYa__", JSON.stringify(res.data?.user), {
    //   secure: true,
    //   sameSite: "None",
    //   expires: ACCESS_EXPIRATION,
    // });
    saveUser(res.data?.user);

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const putAgentPassword = async (updatedAgent) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/agents/password`,
      data: updatedAgent,
    });

    // if (isMobileBrowser()) {
    //   cookie.set("_SSID_xbAb__", JSON.stringify(res.data?.refreshToken), {
    //     secure: true,
    //     sameSite: "None",
    //     expires: ACCESS_EXPIRATION,
    //   });
    // }

    // cookie.set("_USSID_kcYa__", JSON.stringify(res.data?.user), {
    //   secure: true,
    //   sameSite: "None",
    //   expires: ACCESS_EXPIRATION,
    // });
    // saveToken(res.data?.accessToken, res.data?.refreshToken);
    // saveUser(res.data?.accessToken);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteAgent = async (id) => {
  try {
    const res = await api({
      method: "DELETE",
      url: `/agents/${id}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const enableOrDisableAccount = async (info) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/agents/account`,
      data: info,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getAgentBusiness = async (id) => {
  try {
    const res = await api({
      method: "GET",
      url: `/agents/business/${id}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const updateAgentBusiness = async (data) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/agents/business`,
      data,
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
export const disableWallet = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/agents/wallet/status?action=disable`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

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
      url: `/agents/wallet/transactions`,
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

export const getAgentTransactions = async ({
  date: { startDate, endDate },
  type,
}) => {
  try {
    const res = await api({
      method: "GET",
      url: `/agents/top-up/transaction`,
      params: {
        type,
        startDate,
        endDate,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const checkAgentTransactionStatus = async ({ reference }) => {
  try {
    const res = await api({
      method: "GET",
      url: `/agents/top-up/status?reference=${reference}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const removeAgentTransactions = async ({ id }) => {
  try {
    const res = await api({
      method: "DELETE",
      url: `/agents/top-up/transaction?id=${id}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const sendTopUpRequest = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/agents/top-up/request`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const sendBundle = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/agents/top-up/bundle`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const sendAirtime = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url:
        data?.type === "single"
          ? `/agents/top-up/airtime`
          : `/agents/top-up/bulk/airtime`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const sendBulkAirtime = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/agents/top-up/bulk/airtime`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getAgentLogs = async ({ startDate, endDate }) => {
  try {
    const res = await api({
      method: "GET",
      url: `/agents/logs`,
      params: {
        startDate: startDate,
        endDate: endDate,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const removeLogs = async (data) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/agents/logs`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getPhoneNumberToken = async ({ token }) => {
  try {
    const res = await api({
      method: "GET",
      url: `/agents/phonenumber/token`,
      params: {
        code: token,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const updateAgentWalletPin = async (data) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/agents/wallet`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const downloadAirtimeTemplate = async () => {
  try {
    const response = await api({
      url: `/agents/airtime/template`,
      method: "GET",
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `bulk_airtime_template.xlsx`);

    document.body.appendChild(link);
    link.click();

    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.log(error);
  }
};
