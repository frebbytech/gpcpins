import React, {
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  useState,
} from "react";
import { CustomReducer } from "../reducers/CustomReducer";
import { useQuery } from "@tanstack/react-query";
import { getAllNotifications } from "../../api/notificationAPI";
import { useAuth } from "./AuthProvider";
import Swal from "sweetalert2";
import tone from "../../assets/sound/tone.wav";
import { useNavigate } from "react-router-dom";
import { useSocket } from "./SocketProvider";

export const CustomContext = React.createContext();

export const useCustomContext = () => {
  const context = useContext(CustomContext);
  if (!context) {
    throw new Error("An unknown error has occurred.");
  }
  return context;
};

function CustomProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { onEvent, offEvent } = useSocket();
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [transactionStatus, setTransactionStatus] = useState(null);

  const initialValues = {
    ecgNotifications: {
      open: false,
      messages: [],
    },

    loading: {
      open: false,
      message: "",
    },
    alertData: {
      open: false,
      severity: "",
      message: "",
    },
    openSidebar: false,

    ///vouchers
    transaction: {},

    verifyMeter: {
      open: false,
      details: {},
    },
    ecgTransactionInfo: {
      open: false,
      details: {},
    },
    ecgTransactionInfoEdit: {
      open: false,
      details: {},
    },

    verifyPrepaid: {
      open: false,
      details: {},
    },
    ticketDetails: {},

    viewMessage: {
      open: false,
      data: {
        _id: "",
        type: "",
        recipient: "",
        body: "",
        createdAt: "",
      },
    },
  };

  const [customState, customDispatch] = useReducer(
    CustomReducer,
    initialValues,
  );

  // 1. Fetching notifications
  const { data: notificationsData, isLoading } = useQuery({
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
      sessionStorage.getItem("agent_notification_alert_dismissed") === "true";

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
        sessionStorage.setItem("agent_notification_alert_dismissed", "true");

        if (result.isConfirmed) {
          navigate("/notifications");
        }
      });
    }
  }, [notificationsData, user?.id, navigate]);

  // const isInitializing = isLoading;

  const resetPaymentStatus = useCallback(() => {
    // console.log('payment status resetted')
    setPaymentStatus(null);
  }, []);

  const values = useMemo(
    () => ({
      customState,
      customDispatch,
      notifications: notificationsData || [],
      paymentStatus,
      resetPaymentStatus,
    }),
    [
      customState,
      customDispatch,
      notificationsData,
      paymentStatus,
      resetPaymentStatus,
    ],
  );

  // Socket success listener
  useEffect(() => {
    const handleSuccess = (payload) => {
      setPaymentStatus(payload);
    };
    onEvent("payment-success", handleSuccess);
    return () => {
      offEvent("payment-success", handleSuccess);
    };
  }, [onEvent, offEvent]);

  // Socket failed listener
  useEffect(() => {
    const handleFailed = (payload) => {
      setPaymentStatus(payload);
    };
    onEvent("payment-failed", handleFailed);
    return () => offEvent("payment-failed", handleFailed);
  }, [onEvent, offEvent]);

  // Socket success listener
  useEffect(() => {
    const handleSuccess = (payload) => {
      console.log(payload);
      setTransactionStatus(payload);
    };
    onEvent("send-bundle", handleSuccess);
    return () => {
      offEvent("senfd-bundle", handleSuccess);
    };
  }, [onEvent, offEvent]);



  // if (isInitializing) {
  //   return <GlobalSpinner />;
  // }

  return (
    <CustomContext.Provider value={values}>{children}</CustomContext.Provider>
  );
}

export default CustomProvider;
