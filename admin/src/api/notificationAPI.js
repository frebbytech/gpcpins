import api from "./customAxios";

export const getAllNotifications = async (data) => {
  try {
    const res = await api({
      method: "GET",
      url: `/notifications/user`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getNotification = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/notifications`,
      timeout: 10000,
      timeoutErrorMessage: "Error connecting to the server",
      headers: {
        "Content-Type": "application/json",
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const updateNotification = async (ids) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/notifications`,
      data: { ids },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const markAllNotificationsAsRead = async (ids) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/notifications/mark-all-read`,
      data: { ids },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteNotifications = async (id) => {
  try {
    const res = await api({
      method: "DELETE",
      url: `/notifications/user/${id}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
