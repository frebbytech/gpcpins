import api from "./customAxios";

export const getSiteSettings = async () => {
  const res = await api.get("/site-settings");
  return res.data;
};

export const updateSiteSettings = async (data) => {
  const res = await api.patch("/site-settings", data);
  return res.data;
};