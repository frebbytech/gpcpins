import api from "./customAxios";




export const getPayment = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/payment`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};



// airtime
export const getTopUpBalance = async () => {
  try {
    const res = await api({
      method: "GET",
      url: `/payment/top-up/balance`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};


export const getAllBulkAirtimePayment = async ({ startDate, endDate }) => {
  try {
    const res = await api({
      method: "GET",
      url: `/payment/airtime`,
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

export const ConfirmPayment = async ({ id, serviceType }) => {
  try {
    const res = await api({
      method: "GET",
      url: `/payment/confirm/${id}/${serviceType}`,
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const reConfirmPayment = async ({ paymentReference, type }) => {
  try {
    const res = await api({
      method: "POST",
      url: `/payment/re-confirm`,
      data: {
        type,
        paymentReference,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};


// airtime
export const completeBulkAirtimePayment = async ({ id }) => {
  try {
    const res = await api({
      method: "PUT",
      url: `/payment/airtime`,
      params: {
        id,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getBundleList = async (id) => {
  try {
    const res = await api({
      method: "GET",
      url: `/payment/top-up/bundlelist`,
      params: {
        network: id || 0,
      },
    });

    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
