import axios from "axios";
import { saveAccessToken, saveToken, getToken } from "../config/sessionHandler";
import api from "./customAxios";

const BASE_URL = import.meta.env.VITE_BASE_URL;

export const getVerifier = async () => {
  const token = getToken();
  try {
    const res = await axios({
      method: "GET",
      url: `${BASE_URL}/verifiers/auth`,
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

export const getAllVerifiers = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/verifiers`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const getVerifierByID = async (id) => {
  try {
    const res = await api({
      method: "GET",
      url: `/verifiers/${id}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const addVerifier = async (verifier) => {
  const formData = new FormData();
  formData.append("profile", verifier.profile);
  formData.append("firstname", verifier.firstname);
  formData.append("lastname", verifier.lastname);
  formData.append("username", verifier.username);
  formData.append("email", verifier.email);
  formData.append("dob", verifier.dob);
  formData.append("residence", verifier.residence);
  formData.append("nid", verifier.nid);
  formData.append("phonenumber", verifier.phonenumber);
  formData.append("role", verifier.role);
  formData.append("isAdmin", verifier.isAdmin);
  formData.append("password", verifier.password);

  try {
    const res = await api({
      method: "POST",
      url: `/verifiers`,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      data: formData,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const loginVerifier = async (verifierInfo) => {
  try {
    const res = await api({
      method: "POST",
      url: `/verifiers/login`,
      data: verifierInfo,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const logoutVerifier = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/verifiers/logout`,
      data,
    });

    return res.status;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyVerifier = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/verifiers/verify`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyVerifierOTP = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/verifiers/verify-otp`,
      data,
    });

    saveToken(res.data?.accessToken, res.data?.refreshToken);

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const updateVerifierProfile = async (data) => {
  const formData = new FormData();
  formData.append("id", data?.id);
  formData.append("profile", data?.profile);

  try {
    const res = await api({
      method: "PUT",
      url: `/verifiers/profile`,
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

export const putVerifier = async (updatedVerifier) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/verifiers`,
      data: updatedVerifier,
    });

    saveAccessToken(res.data?.accessToken);

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const resetVerifierPassword = async (updatedVerifier) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/verifiers/password/reset`,
      data: updatedVerifier,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const putVerifierPassword = async (updatedVerifier) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/verifiers/password`,
      data: updatedVerifier,
    });

    saveToken(res.data?.accessToken, res.data?.refreshToken);

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const putVerifierResetPasswordLink = async (data) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/verifiers/reset`,
      data,
    });

    saveToken(res.data?.accessToken, res.data?.refreshToken);

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteVerifier = async (id) => {
  try {
    const res = await api({
      method: "DELETE",
      url: `/verifiers/${id}`,
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
      url: `/verifiers/account`,
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
      url: `/verifiers/phonenumber/token`,
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
      url: `/verifiers/verify-identity`,
      body:data
    });

    saveToken(res.data?.accessToken, res.data?.refreshToken);
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const removeVerifier = async ({ id }) => {
  try {
    const res = await api({
      method: "DELETE",
      url: `/verifiers/${id}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
