// src/hooks/useSiteSettings.js
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_BASE_URL;

export const useSiteSettings = () =>
  useQuery({
    queryKey: ["site-settings-public"],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/site-settings/public`);
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });