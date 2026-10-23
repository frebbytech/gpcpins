import api from "./customAxios";

export const getAllMeters = async (meterNo) => {
  try {
    const res = await api({
      url: `/meters`,
      method: "GET",
      params: {
        meterNo,
      },
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getAllMetersById = async (meterId) => {
  try {
    const res = await api({
      url: `/meters/${meterId}`,
      method: "GET",
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
export const getAllMetersByUserId = async (userId) => {
  try {
    const res = await api({
      url: `/meters/user/${userId}`,
      method: "GET",
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getMeterById = async (meterId) => {
  try {
    const res = await api({
      url: `/meters/${meterId}`,
      method: "GET",
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
// export const getMeterByNumber = async (meterNumber, meterName) => {
//   try {
//     const res = await api({
//       url: `/ecg/meter-info`,
//       method: "POST",
//       data: {
//         accountNumber: meterNumber,
//         name: meterName,
//         accountCategory: "PREPAID",
//       },
//     });
//     return res.data;
//   } catch (error) {
//     throw error.response.data;
//   }
// };
export const getMeterByNumber = async (meterNumber, meterName) => {
  try {
    const res = await api({
      url: `/ecg/meter-info`,
      method: "POST",
      data: {
        meterNumber,
        name: meterName,
        meterCategory: "prepaid",
      },
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

///
export const postMeter = async (newMeter) => {
  try {
    const res = await api({
      url: `/meters`,
      method: "POST",
      data: newMeter,
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

///
export const putMeter = async (updatedMeter) => {
  try {
    const res = await api({
      url: `/meters`,
      method: "PUT",
      data: updatedMeter,
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};

///DELETE METER
export const deleteMeter = async (id) => {
  try {
    const res = await api({
      url: `/meters`,
      method: "DELETE",
      params: {
        id,
      },
    });
    return res.data;
  } catch (error) {
    throw error.response.data;
  }
};
