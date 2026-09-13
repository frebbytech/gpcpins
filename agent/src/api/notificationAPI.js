import api from './customAxios';

export const getAllNotifications = async () => {
  try {
    const res = await api({
      method: 'GET',
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
      method: 'GET',
      url: `/notifications`,
      timeout: 10000,
      timeoutErrorMessage: 'Error connecting to the server',
      headers: {
        'Content-Type': 'application/json',
      },
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

export const updateNotification = async () => {
  try {
    const res = await api({
      method: 'PUT',
      url: `/notifications/agent`,

    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteNotifications = async ({ id, all }) => {
  try {
    const res = await api({
      method: 'DELETE',
      url: `/notifications`,
      params: { id, all },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const removeAllNotifications = async () => {
  try {
    const res = await api({
      method: 'DELETE',
      url: `/notifications/agent`,

    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};