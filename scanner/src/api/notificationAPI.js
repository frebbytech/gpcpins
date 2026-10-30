import api from './customAxios';

export const getAllNotifications = async (title) => {
  try {
    const res = await api({
      method: 'GET',
      url: `/notifications/user`,
      params: {
        title
      }
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


export const getNotification = async (id) => {
  try {
    const res = await api({
      method: 'GET',
      url: `/notifications/verifier/${id}`,
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

export const updateNotification = async (ids) => {
  try {
    const res = await api({
      method: 'PUT',
      url: `/notifications/verifier`,
      data: { ids },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteNotifications = async (ids) => {
  try {
    const res = await api({
      method: 'PUT',
      url: `/notifications/verifier/remove`,
      data: { ids },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};


