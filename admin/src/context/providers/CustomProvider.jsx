import React, { useContext, useReducer, useEffect, useMemo } from "react";
import { CustomReducer } from "../reducers/CustomReducer";
import { useQuery } from "@tanstack/react-query";
import { getAllNotifications } from "../../api/notificationAPI";
import { useAuth } from "./AuthProvider";
import Swal from "sweetalert2";
import tone from "../../assets/sound/tone.wav";
import { useNavigate } from "react-router-dom";

export const CustomContext = React.createContext();

export const useCustomContext = () => {
  const context = useContext(CustomContext);
  if (!context) {
    throw new Error("An unknown error has occurred.");
  }
  return context;
};


export function CustomProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const initialValues = {
    allCategory: [],
    loading: { open: false, message: "" },
    alertData: { open: false, severity: "", message: "" },
    openSidebar: false,
    openPreviewChecker: false,
    loadedChecker: { meta: [], data: [] },
    newCheckers: [],
    category: { open: false, category: "" },
    securityCategory: { open: false, category: "" },
    universityCategory: { open: false, category: "" },
    cinemaCategory: { open: false, category: "" },
    stadiumCategory: { open: false, category: "" },
    busCategory: { open: false, category: "" },
    editWaecCategory: { open: false, id: "" },
    editSecurityCategory: { open: false, id: "" },
    editUniversityCategory: { open: false, id: "" },
    editCinemaCategory: { open: false, id: "" },
    editStadiumCategory: { open: false, id: "" },
    editBusCategory: { open: false, id: "" },
    ticketDetails: {},
    ecgTransactionInfoEdit: { open: false, details: {} },
  };

  const [customState, customDispatch] = useReducer(
    CustomReducer,
    initialValues,
  );

  // 1. Fetching notifications
  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: getAllNotifications,
    enabled: !!user?.id,
    staleTime: 1000 * 30,
    cacheTime: 1000 * 60 * 5,
    retry: 2,
    refetchOnWindowFocus: false,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  // 2. Notification Side Effects (Sound & Alert)
  useEffect(() => {
    if (!notificationsData || !user?.id) return;

    const activeNotifications = notificationsData.filter(
      (item) => item?.isRead === false,
    );
    const hasActiveNotifications = activeNotifications.length > 0;

    // Check if the user already dismissed the alert during this session
    const isAlertDismissedInSession =
      sessionStorage.getItem("notification_alert_dismissed") === "true";

    if (hasActiveNotifications && !isAlertDismissedInSession) {
      // Safe Audio Playback (handles browser autoplay blocks)
      const notificationSound = new Audio(tone);
      notificationSound.play().catch((err) => {
        console.warn("Audio autoplay blocked or failed:", err);
      });

      // Display Alert
      Swal.fire({
        icon: "info",
        title: "Notifications",
        text: "You have active notifications available.",
        position: "top-end",
        toast: true,
        showConfirmButton: true,
        confirmButtonText: "View",
        showCancelButton: true,
        cancelButtonText: "Dismiss",
        backdrop: false,
      }).then((result) => {
        // Save state so it won't show again this session regardless of action
        sessionStorage.setItem("notification_alert_dismissed", "true");

        if (result.isConfirmed) {
          navigate("/notifications");
        }
      });
    }
  }, [notificationsData, user?.id, navigate]);



  const values = useMemo(
    () => ({
      customState,
      customDispatch,
      notifications: notificationsData || [],
    }),
    [customState, customDispatch, notificationsData],
  );

  return (
    <CustomContext.Provider value={values}>{children}</CustomContext.Provider>
  );
}
export default CustomProvider;
