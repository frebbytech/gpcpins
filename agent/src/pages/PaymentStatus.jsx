
import { useCallback, useEffect, useState } from "react";
import { IMAGES } from "@/constants";
import { useCustomContext } from "@/context/providers/CustomProvider";
import _ from "lodash";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmPayment, reConfirmPayment } from "@/api/paymentAPI";
import { useLocation, useNavigate, Link } from "react-router-dom";
import MomoGuide from "@/components/momo-guide";

import {
  Container,
  Paper,
  Box,
  Typography,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { useAuth } from "@/context/providers/AuthProvider";


// ──────────────────────────────────────────────────────────────────────
// Keyframes for animations
// ──────────────────────────────────────────────────────────────────────
const pulseRing = keyframes`
  0%   { transform: scale(1);   opacity: 0.6; }
  70%  { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1.5); opacity: 0; }
`;
const gentleBob = keyframes`
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-6px); }
`;
const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// Spinner component using MUI CircularProgress
export const Spinner = ({ size = 20, color = "#F78E2A" }) => (
  <CircularProgress
    size={size}
    sx={{ color, animation: `${spin} 0.9s linear infinite` }}
  />
);

function PaymentStatus() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state } = useLocation();
  const { customDispatch, paymentStatus, resetPaymentStatus } =
    useCustomContext();

  const [status, setStatus] = useState("pending");

  const txRef =
    user?.id || state?.phonenumber || state?.transactionReference || null;

  // 1. DEFINE SUCCESS HANDLER FIRST (With complete dependency array)
  const handlePaymentSuccess = useCallback(
    (data) => {
      if (!data?.id || data?.status !== "completed") return;
      console.log("Payment confirmed:", data);
      setStatus("success");

      if (state?.isWallet) {
        queryClient.invalidateQueries({
          queryKey: ["wallet-balance", user?.id],
        });
      }
      // customDispatch(globalAlertType("info", "Transaction Confirmed!"));

      const serviceType = ["airtime", "prepaid", "bundle", "wallet"];
      if (serviceType.includes(state?.categoryType)) {
        setTimeout(() => {
          navigate("/payment/success", {
            replace: true,
            state: { path: state?.path, id: data?.id },
          });
        }, 3000);
      } else {
        customDispatch({ type: "loadVouchers", payload: data });
        setTimeout(() => {
          navigate("/checkout", {
            replace: true,
            state: {
              id: data?.id,
              categoryType: data?.categoryType,
              path: state?.path,
            },
          });

          resetPaymentStatus();
        }, 3000);
      }
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
    [state, navigate, queryClient, customDispatch, user?.id],
  );

  const handlePaymentError = useCallback(
    (error) => {
      // console.log(error);
      if (!error) return;
      setStatus("failed");
      // customDispatch(
      //   globalAlertType("error", error?.reason || "Transaction failed"),
      // );
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      setTimeout(() => {
        navigate("/payment/failed", {
          replace: true,
          state: { path: state?.path },
        });
        resetPaymentStatus();
      }, 3000);
    },
    [queryClient, user?.id],
  );

  // Redirect if no state (safety)
  useEffect(() => {
    if (!state?.id || !state?.categoryType) {
      navigate("/", { replace: true });
    }
  }, [state, navigate]);

  // Block accidental navigation
  useEffect(() => {
    const handler = (e) => {
      const msg = "Are you sure you want to leave?";
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Polling query (fallback)
  const confirmPayment = useQuery({
    queryKey: ["confirm-payment", state?.id, state?.categoryType],
    queryFn: () =>
      ConfirmPayment({ id: state?.id, serviceType: state?.categoryType }),
    // enabled: false,
    enabled: !!state?.id && !!state?.categoryType && status === "pending",
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    retry: 3,
    refetchOnWindowFocus: false,
  });

  const {
    isLoading,
    isSuccess: isDone,
    isError,
    data,
    error,
    failureReason,
  } = confirmPayment;

  // Socket success listener
  useEffect(() => {
    if (!_.isEmpty(paymentStatus) && paymentStatus?.success === true) {
      handlePaymentSuccess(paymentStatus?.transaction);
      return;
    }
    if (isDone) {
      handlePaymentSuccess(data);
    }
  }, [isDone, paymentStatus, data, handlePaymentSuccess]);

  // Socket success listener
  useEffect(() => {
    if (!_.isEmpty(paymentStatus) && paymentStatus?.success === false) {
      handlePaymentError(paymentStatus);
      return;
    }
    if (
      isError &&
      (error === "Payment failed!" || failureReason === "Payment failed!")
    ) {
      handlePaymentError(paymentStatus);
    }
  }, [isError, error, failureReason, paymentStatus, handlePaymentError]);

  // const { mutateAsync, isPending } = useMutation({
  //   mutationFn: reConfirmPayment,
  // });

  // const handleReConfirmPayment = () => {
  //   mutateAsync({
  //     paymentReference: state?.transactionReference,
  //     type: state?.categoryType,
  //   });
  // };

  // Derived states
  const isCancelled =
    // status === "failed" ||
    paymentStatus?.success === false ||
    (isError && error === "Payment failed!");

  const isSuccess =
    // status === "success" ||
    (!!data && !isCancelled) || paymentStatus?.success === true;

  const isPolling =
    // status === "pending"||
    (isLoading || paymentStatus === null) && !isSuccess && !isCancelled;

  const statusType = isCancelled ? "error" : isSuccess ? "success" : "waiting";

  if (!txRef) {
    return (
      <Container maxWidth="sm" sx={{ mt: 10 }}>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Alert severity="error">Invalid transaction reference.</Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: "24px 20px",
          gap: 0,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: "420px",
            background: "#ffffff",
            borderRadius: "24px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            animation: `${fadeIn} 0.4s ease both`,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              width: "100%",
              background: isPolling
                ? "linear-gradient(135deg, #fabb7f 0%, #F78E2A 100%)"
                : isCancelled
                  ? "#B72136"
                  : "#229A16",
              p: "28px 24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: "-30px",
                right: "-30px",
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.07)",
                pointerEvents: "none",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                bottom: "-40px",
                left: "-20px",
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.05)",
                pointerEvents: "none",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              Payment Confirmation
            </Typography>
            {state?.amount && (
              <Typography
                variant="h4"
                sx={{
                  color: "#ffffff",
                  fontWeight: 700,
                  letterSpacing: "-0.5px",
                }}
              >
                {state?.currency ?? "GHS"} {parseFloat(state.amount).toFixed(2)}
              </Typography>
            )}
          </Box>

          {/* Body */}
          <Box
            sx={{
              width: "100%",
              p: "28px 28px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
              boxSizing: "border-box",
            }}
          >
            {/* Animated image with pulse rings */}
            <Box
              sx={{
                position: "relative",
                width: "100px",
                height: "100px",
                mb: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {statusType === "waiting" && (
                <>
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "2.5px solid #fabb7f",
                      animation: `${pulseRing} 2s ease-out infinite`,
                      opacity: 0.6,
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      inset: "-12px",
                      borderRadius: "50%",
                      border: "2px solid #fabb7f",
                      animation: `${pulseRing} 2s ease-out infinite 0.6s`,
                      opacity: 0.35,
                    }}
                  />
                </>
              )}
              {/* <Box
                component="img"
                src={IMAGES.pending}
                alt="Payment status"
                sx={{
                  width: "100px",
                  height: "100px",
                  objectFit: "contain",
                  animation: `${gentleBob} 3s ease-in-out infinite`,
                  position: "relative",
                  zIndex: 1,
                  mt: "18px",
                  ml: "36px",
                }}
              /> */}
            </Box>
            {/* Polling / waiting state */}
            {isPolling ? (
              <>
                <Box
                  sx={{
                    width: "100%",
                    height: "1px",
                    bgcolor: "#f3f4f6",
                    my: "2px",
                  }}
                />

                {state?.isWallet ? (
                  <Stack direction="row" alignItems="center" gap="10px">
                    {/* <Spinner size={20} /> */}
                    <Typography
                      variant="caption"
                      sx={{ color: "#6b7280", fontWeight: 500 }}
                    >
                      Processing payment…
                    </Typography>
                  </Stack>
                ) : (
                  <>
                    <Box
                      sx={{
                        width: "100%",
                        bgcolor: "#f5f3ff",
                        borderRadius: "14px",
                        p: "16px 18px",
                        boxSizing: "border-box",
                      }}
                    >
                      <Typography
                        variant="caption"
                        textAlign="center"
                        sx={{
                          mb: "10px",
                          textAlign: "center",

                          fontWeight: 500,
                        }}
                      >
                        A prompt has been sent to your mobile phone. Enter your
                        Mobile Money PIN to complete the payment.
                      </Typography>
                    </Box>

                    {/* <LoadingButton
                      variant="contained"
                      onClick={handleReConfirmPayment}
                      loading={isPending}
                      sx={{ my: 2 }}
                    >
                      Click here to confirm if paid
                    </LoadingButton> */}
                    <MomoGuide mobilePartner={state?.mobilePartner} />
                    {/* <Stack direction="row" alignItems="center" gap="10px">
                      <Spinner size={16} />
                      <Typography
                        variant="caption"
                        sx={{ color: "#6b7280", fontWeight: 500 }}
                      >
                        Waiting for payment confirmation…
                      </Typography>
                    </Stack> */}
                  </>
                )}
              </>
            ) : isCancelled ? (
              <>
                <Typography
                  variant="h6"
                  sx={{
                    textAlign: "center",
                    color: "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  Payment was not completed
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: "center",
                    color: "#6b7280",
                    lineHeight: 1.6,
                  }}
                >
                  This may have been caused by{" "}
                  <Box
                    component="span"
                    sx={{
                      bgcolor: "#fee2e2",
                      color: "#991b1b",
                      borderRadius: "4px",
                      px: "6px",
                      py: "1px",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    insufficient funds
                  </Box>
                  ,{" "}
                  <Box
                    component="span"
                    sx={{
                      bgcolor: "#fee2e2",
                      color: "#991b1b",
                      borderRadius: "4px",
                      px: "6px",
                      py: "1px",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    processing failure
                  </Box>
                  , or exceeding your{" "}
                  <Box
                    component="span"
                    sx={{
                      bgcolor: "#fee2e2",
                      color: "#991b1b",
                      borderRadius: "4px",
                      px: "6px",
                      py: "1px",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    daily limit
                  </Box>
                  .
                </Typography>
                <Link
                  to={state?.path}
                  style={{
                    textDecoration: "none",
                    display: "inline-block",
                    padding: "10px 24px",
                    backgroundColor: "var(--secondary)",
                    color: "white",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                >
                  Try Again
                </Link>
              </>
            ) : (
              <>
                <Typography
                  variant="h6"
                  sx={{
                    textAlign: "center",
                    color: "#15803d",
                    fontWeight: 700,
                  }}
                >
                  Payment done!
                </Typography>
                {/* <Typography
                  variant="body2"
                  sx={{ textAlign: "center", color: "#6b7280" }}
                >
                  Your transaction is being finalized…
                </Typography>
                <Typography variant="body2">
                  Transaction ID: {transaction?.id}
                </Typography>
                <Typography variant="body2">
                  Date:{" "}
                  {transaction
                    ? new Date(transaction.createdAt).toLocaleString()
                    : ""}
                </Typography> */}
                <Stack direction="row" alignItems="center" gap="10px">
                  <Spinner size={18} />
                  <Typography
                    variant="caption"
                    sx={{ color: "#6b7280", fontWeight: 500 }}
                  >
                    Confirming transaction
                  </Typography>
                </Stack>
              </>
            )}
          </Box>
        </Box>
      </Box>
      <Box
        component="footer"
        sx={{
          textAlign: "center",
          p: "16px 20px",
          fontSize: "12px",
          color: "#9ca3af",
        }}
      >
        &copy; {new Date().getFullYear()} Gab Powerful Consult
      </Box>
    </Box>
  );
}

export default PaymentStatus;
