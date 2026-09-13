import axios from "axios";
import {  getToken, saveAccessToken } from "../config/sessionHandler";
import api from "./customAxios";


const BASE_URL = import.meta.env.VITE_BASE_URL;

export const getAdmin = async () => {


  const token = getToken();
  try {

   const res = await axios({
    method:"GET",
     url: `${BASE_URL}/admin/auth`,
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

export const loginAdmin = async (adminInfo) => {
  try {
    const res = await api({
      method: "POST",
      url: `/admin/login`,
      data: adminInfo,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const logoutAdmin = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/admin/logout`,
      data,
    });

    return res.status;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyAdmin = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/admin/verify`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyAdminOTP = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/admin/verify-otp`,
      data,
    });

    saveAccessToken(res.data?.accessToken);

    return res.data;
  } catch (error) {
    throw error?.response?.data;
  }
};

export const updateAdminProfile = async (data) => {
  // const formData = new FormData();
  // formData.append("id", data?.id);
  // formData.append("profile", data?.profile);

  try {
    const res = await api({
      method: "PUT",
      url: `/admin/profile`,
      data: data,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  } catch (error) {
    throw new Error(error.response.data || "Error Updating profile");
  }
};

export const putAdmin = async (updatedAdmin) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/admin`,
      data: updatedAdmin,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const resetAdminPassword = async (updatedAdmin) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/admin/password-reset`,
      data: updatedAdmin,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const putAdminPassword = async (updatedAdmin) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/admin/password`,
      data: updatedAdmin,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const putAdminResetPasswordLink = async (data) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/employees/reset`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteAdmin = async (id) => {
  try {
    const res = await api({
      method: "DELETE",
      url: `/admin/${id}`,
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
      url: `/users/account`,
      data: info,
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

export const verifyUserIdentity = async (data) => {
  try {
    const res = await api({
      method: "GET",
      url: `/users/verify-identity`,
      params: {
        ...data,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

///SMS API
export const getSMSAPI = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/admin/sms`,
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

///SMS API
export const postSMSAPI = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/admin/sms`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
