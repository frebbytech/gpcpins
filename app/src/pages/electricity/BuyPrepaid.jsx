import { useState } from "react";
import {
  Container,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Grid,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ReceiptIcon from "@mui/icons-material/Receipt";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useNavigate,
  useLocation,
  useParams,
  Navigate,
} from "react-router-dom";
import Swal from "sweetalert2";
import { currencyFormatter } from "@/constants";
import { prepaidPaymentValidationSchema } from "@/config/validationSchema";
import { globalAlertType } from "@/components/alert/alertType";
import { makeElectricityPayment } from "@/api/paymentAPI";
import { useAuth } from "@/context/providers/AuthProvider";
import { useCustomContext } from "@/context/providers/CustomProvider";
import PaymentOption from "@/components/PaymentOption";
import AnimatedContainer from "@/components/animations/AnimatedContainer";
import CheckOutItem from "@/components/items/CheckOutItem";
import PaymentPolling from "../payment/PaymentPolling";

function BuyPrepaid() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { meterNo } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { customDispatch } = useCustomContext();
  const [prepaidPayload, setPrepaidPayload] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [activePaymentId, setActivePaymentId] = useState(null);
  const [transactionId, setTransactionId] = useState(null);

  // Meter details from previous page state
  const meterDetails = state?.meterDetails || {
    number: meterNo || "",
    name: "",
    address: "",
    type: "",
    provider_name: "",
    spn: "",
  };

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: makeElectricityPayment,
    retry: false,
  });

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isValid },
  } = useForm({
    resolver: yupResolver(prepaidPaymentValidationSchema),
    defaultValues: {
      amount: "",
    },
  });

  const amount = watch("amount");

  // Wallet balance check
  const walletBalance = user?.id
    ? queryClient.getQueryData(["wallet-balance", user?.id])
    : 0;
  const isInsufficientBalance =
    prepaidPayload?.paymentMethod === "wallet" &&
    user?.id &&
    (Number(walletBalance) === 0 || Number(walletBalance) < amount);

  // Form validation for review button

  const handleOpenSummary = () => setSummaryOpen(true);
  const handleCloseSummary = () => setSummaryOpen(false);

  const onSubmit = async () => {
    const payload = {
      meter: meterDetails.number,
      type: "prepaid",
      service: "prepaid",
      info: {
        amount: amount,
        email: prepaidPayload?.email || user?.email,
        phonenumber: prepaidPayload?.phonenumber || user?.phonenumber,
        provider: prepaidPayload?.mobilePartner || "wallet",
      },
      topup: amount,
      charges: 0,
      amount: amount,
      isWallet: prepaidPayload?.paymentMethod === "wallet",
    };
    if (prepaidPayload?.paymentMethod === "wallet") {
      payload.token = prepaidPayload?.token;
    }

    Swal.fire({
      title: "Confirm Payment",
      text: "Proceed with payment?",
      icon: "question",
      showCancelButton: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        // console.log(payload);
        // return;

        paymentMutation.mutate(payload, {
          onSettled: () => {
            handleCloseSummary();
          },
          onSuccess: (data) => {
            if (data?.paymentId) {
              setActivePaymentId(data.paymentId);
              setTransactionId(data.transactionId);
            }
          },
          onError: (error) => {
            customDispatch(globalAlertType("error", error));
          },
        });
      }
    });
  };

  if (!meterNo && !meterDetails.number) {
    return <Navigate to="/electricity" />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}>
        <IconButton
          aria-label="back"
          onClick={() => navigate(-1)}
          sx={{ mb: 2, p: 0 }}
        >
          <ArrowBackIosNewIcon />
        </IconButton>

        <Grid container spacing={4}>
          {/* Left column: Meter details */}
          <Grid item xs={12} md={6}>
            <AnimatedContainer>
              <Container
                sx={{
                  borderRadius: 2,
                  padding: 3,
                  display: "flex",
                  flexDirection: "column",
                  rowGap: 1,
                  bgcolor: "secondary.main",
                  color: "secondary.contrastText",
                }}
              >
                <>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    // marginY={1}
                    bgcolor="#fff"
                    color="#333"
                    padding={2}
                  >
                    <Typography variant="body2">Top Up Amount</Typography>
                    <Typography variant="body2">
                      {currencyFormatter(amount || 0)}
                    </Typography>
                  </Stack>
                  {/* <small style={{ color: "var(--primary)" }}>
                    NOTE: Minimum amount you can buy is <b> GHS 50</b>.
                  </small> */}
                  <CheckOutItem
                    color="secondary.contrastText"
                    title="Meter No."
                    value={meterDetails?.number || meterNo}
                  />
                  <CheckOutItem
                    color="secondary.contrastText"
                    title="Name"
                    value={meterDetails?.name}
                  />
                  <CheckOutItem
                    color="secondary.contrastText"
                    title="Type"
                    value={meterDetails?.type}
                  />
                  <CheckOutItem
                    color="secondary.contrastText"
                    title="Meter Provider "
                    value={meterDetails?.provider_name || "N/A"}
                  />

                  <CheckOutItem
                    color="secondary.contrastText"
                    title="Address"
                    value={
                      meterDetails?.address ? `${meterDetails.address}` : "N/A"
                    }
                  />
                  <CheckOutItem
                    color="secondary.contrastText"
                    title="Mobile No."
                    value={
                      prepaidPayload?.phonenumber ||
                      meterDetails?.phonenumber ||
                      user?.phonenumber ||
                      "N/A"
                    }
                  />
                </>
                {meterDetails.isLoading && (
                  <Typography>Loading Meter Information.....</Typography>
                )}
              </Container>
            </AnimatedContainer>
          </Grid>

          {/* Right column: Payment form */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Payment Details
            </Typography>

            <Stack spacing={2}>
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Top-up Amount (GHS)"
                    required
                    placeholder="0.00"
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">GH¢</InputAdornment>
                      ),
                    }}
                    error={!!errors.amount}
                    helperText={errors.amount?.message}
                  />
                )}
              />

              <PaymentOption
                showMomo
                showWallet={!!user?.id}
                initialValues={{
                  fullName: user?.name || "",
                  email: user?.email || "",
                }}
                onSubmit={(values) => {
                  // clearErrors("amount");
                  //validate amount before proceeding
                  if (!isValid) {
                    //validate amount here
                    // if (amount < 1) {
                    //   customDispatch(
                    //     globalAlertType(
                    //       "error",
                    //       "Minimum amount you can buy is GHS 1.",
                    //     ),
                    //   );
                    //   setError("amount", {
                    //     type: "manual",
                    //     message: "Minimum amount you can buy is GHS 1.",
                    //   });
                    //   return;
                    // }
                  }

                  if (
                    values.paymentMethod === "wallet" &&
                    isInsufficientBalance
                  ) {
                    customDispatch(
                      globalAlertType("error", "Insufficient wallet balance"),
                    );
                    return;
                  }

                  setPrepaidPayload(values);
                  handleOpenSummary();
                  clearErrors("amount");
                }}
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Order Summary Dialog */}
      <Dialog
        open={summaryOpen}
        onClose={handleCloseSummary}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "primary.lighter",
            color: "primary.contrastText",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 1.5,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <ReceiptIcon />
            <Typography variant="h6" component="span" fontWeight={600}>
              Confirm Checkout
            </Typography>
          </Stack>
          <IconButton
            size="small"
            onClick={handleCloseSummary}
            sx={{ color: "primary.contrastText" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2, bgcolor: "background.default" }}>
          <Stack spacing={1}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: "background.paper",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={1}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Payment Summary
                </Typography>
                <CheckOutItem
                  title="Meter Number"
                  value={meterDetails.number || meterNo}
                />
                <CheckOutItem title="Name" value={meterDetails.name || "N/A"} />
                <CheckOutItem
                  title="Meter Type"
                  value={meterDetails.type || "N/A"}
                />
           
           
            {/* Ticket Summary */}
          
           
            
                <CheckOutItem
                  title="Payment Method"
                  value={
                    prepaidPayload?.paymentMethod === "wallet"
                      ? "Wallet"
                      : "Mobile Money"
                  }
                />

                {prepaidPayload?.paymentMethod !== "wallet" && (
                  <>
                    <CheckOutItem
                      title="Mobile Number"
                      value={prepaidPayload?.phonenumber}
                    />
                  </>
                )}

                <CheckOutItem
                  title="Total"
                  value={currencyFormatter(amount)}
                  bold
                  color="primary.main"
                />
              </Stack>
            </Paper>
            {/* Additional info / disclaimer */}
            <Typography
              variant="caption"
              color="text.secondary"
              textAlign="center"
            >
              By confirming, you agree to our terms and conditions.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleCloseSummary}>Cancel</Button>
          <LoadingButton
            variant="contained"
            onClick={handleSubmit(onSubmit)}
            loading={paymentMutation.isPending}
            sx={{
              px: 3,
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            Confirm Payment
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {activePaymentId && (
        <PaymentPolling
          paymentId={activePaymentId}
          transactionId={transactionId}
          onClose={() => setActivePaymentId(null)}
          isWallet={prepaidPayload?.paymentMethod === "wallet"}
        />
      )}
    </Container>
  );
}

export default BuyPrepaid;
