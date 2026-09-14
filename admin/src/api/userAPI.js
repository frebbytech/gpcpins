import api from "./customAxios";

//Get all Users
export const getAllUsers = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/users`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getUserToken = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/users/auth/token`,
    });

    return res.data;
  } catch (error) {
    throw "an error ahs occurred";
  }
};

// export const getUser = async () => {
//   try {
//     const res = await api({
//       method: 'GET',
//       url: `/users/auth`,
//     });

//     return res.data;
//   } catch (error) {
//     throw error.response.data;
//   }
// };
export const getNonUser = async () => {
  try {
    const res = await api({
      method: "POST",
      url: `/users/sample`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const loginUser = async (userInfo) => {
  try {
    const res = await api({
      method: "POST",
      url: `/users/login`,
      data: userInfo,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const loginGoogleUser = async (userInfo) => {
  try {
    const res = await api({
      method: "POST",
      url: `/users/login-google`,
      data: userInfo,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const logoutUser = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/users/logout`,
      data,
    });

    return res.status;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyUserOTP = async (data) => {
  try {
    const res = await api({
      method: "POST",
      url: `/users/verify-otp`,
      data,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const updateUserProfile = async (data) => {
  const formData = new FormData();
  formData.append("id", data?.id);
  formData.append("profile", data?.profile);

  try {
    const res = await api({
      method: "PUT",
      url: `/users/profile`,
      data: formData,
      // timeout: 15000,
      // timeoutErrorMessage:'Error! Time out',
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  } catch (error) {
    throw new Error(error.response.data || "Error Updating profile");
  }
};

export const createNewUser = async (userInfo) => {
  try {
    const res = await api({
      method: "POST",
      url: `/users`,
      data: userInfo,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const putUser = async (updatedUser) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/users`,
      data: updatedUser,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteUser = async ({ id }) => {
  try {
    const res = await api({
      method: "DELETE",
      url: `/users/${id}`,
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

export const getUser = async (id) => {
  try {
    const res = await api({
      method: "GET",
      url: `/users/${id}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getWalletTransaction = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/users/wallet/transactions`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};


