import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Dialog,
  DialogContent,
  Stack,
  TextField,
  InputAdornment,
  Typography,
  Paper,
  Divider,
  Box,
  alpha,
  useTheme,
  Button,
  IconButton,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { globalAlertType } from "../../components/alert/alertType";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { sendWalletTopUp } from "../../api/walletAPI";
import MobilePartner from "../../components/MobilePartner";
import CustomDialogTitle from "../../components/dialogs/CustomDialogTitle";
import { topUpSchema } from "../../config/validationSchema";
import {
  Close as CloseIcon,
  Receipt,
  Phone,
  AccountBalance,
} from "@mui/icons-material";
import { currencyFormatter } from "../../constants";
import { useSocket } from "../../context/providers/SocketProvider";
import { useAuth } from "../../context/providers/AuthProvider";

function TopUpRequest() {
  const { user } = useAuth();
  const theme = useTheme();

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { customDispatch } = useCustomContext();
  const { joinPaymentRoom, leavePaymentRoom } = useSocket();

  const [searchParams, setSearchParams] = useSearchParams();
  const open = Boolean(searchParams.get("add-money"));

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    if (user?.id) {
      joinPaymentRoom(user?.id);
      return;
    }

    if (user?.phonenumber) {
      joinPaymentRoom(user?.phonenumber);
    }

    return () => {
      leavePaymentRoom(user?.id);
      leavePaymentRoom(user?.phonenumber);
    };
  }, [user?.id, user?.phonenumber, joinPaymentRoom, leavePaymentRoom]);

  // React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({
    resolver: yupResolver(topUpSchema),
    defaultValues: {
      mobilePartner: "",
      phoneNumber: "",
      amount: 1,
    },
  });

  // Mutation
  const { mutateAsync, isPending } = useMutation({
    mutationFn: sendWalletTopUp,
    onError: (error) => {
      customDispatch(
        globalAlertType("error", error?.message || "An error occurred."),
      );
    },
    onSuccess: (data) => {
      if (data) {
        navigate(`/confirm`, {
          replace: true,
          state: {
            id: data?.transactionId,
            transactionReference: data?.reference,
            categoryType: "wallet",
            path: pathname,
            isWallet: false,
          },
        });
        // Close preview and reset
        // setPreviewOpen(false);
        // setPreviewData(null);
        // handleClose();
      }
    },
  });

  // Submit form → open preview
  const onFormSubmit = (data) => {
    setPreviewData(data);
    setPreviewOpen(true);
  };

  // Confirm after preview
  const handleConfirm = async () => {
    if (!previewData) return;

    // SweetAlert confirmation
    const result = await Swal.fire({
      title: "Confirm Top-Up",
      html: `
        <p>You are about to top up your wallet with:</p>
        <p style="font-size: 1.5rem; font-weight: 700; color: ${theme.palette.primary.main};">
        ${currencyFormatter(previewData.amount)}
        </p>
        <p>via <strong>${previewData.mobilePartner}</strong> to <strong>${previewData.phoneNumber}</strong></p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, proceed",
      cancelButtonText: "Cancel",
      confirmButtonColor: theme.palette.secondary.main,
      cancelButtonColor: theme.palette.grey[500],
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      try {
        await mutateAsync({ ...previewData, userId: user?.id });
        // Success handled by onSuccess
      } catch (error) {
        // Error handled by onError
        // Close preview on error? Leave it open so user can retry.
      }
    }
  };

  const handleClose = () => {
    setSearchParams((params) => {
      params.delete("add-money");
      return params;
    });
    reset();
    setPreviewOpen(false);
    setPreviewData(null);
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setPreviewData(null);
  };

  return (
    <>
      {/* Main dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <CustomDialogTitle
          title="Wallet Top-Up"
          subtitle="Fill in the details to top-up your wallet via Mobile Money."
          onClose={handleClose}
        />

        <DialogContent sx={{ p: 3 }}>
          <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
            <Stack spacing={3}>
              <Controller
                name="mobilePartner"
                control={control}
                render={({ field, fieldState }) => (
                  <MobilePartner
                    size="small"
                    value={field.value}
                    setValue={field.onChange}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />

              <Controller
                name="phoneNumber"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="tel"
                    inputMode="tel"
                    variant="outlined"
                    label="Mobile Money Number"
                    fullWidth
                    required
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Phone fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              <Typography
                variant="caption"
                fontStyle="italic"
                color="text.secondary"
              >
                Enter the amount you want to top up.
              </Typography>

              <Controller
                name="amount"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    inputMode="numeric"
                    placeholder="Amount"
                    label="Top Up Amount"
                    size="small"
                    fullWidth
                    required
                    autoFocus
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AccountBalance fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">GHS</InputAdornment>
                      ),
                    }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    onChange={(e) =>
                      field.onChange(e.target.valueAsNumber || "")
                    }
                    value={field.value || ""}
                  />
                )}
              />

              <LoadingButton
                type="submit"
                variant="contained"
                loading={isSubmitting}
                disabled={isSubmitting}
                fullWidth
                color="secondary"
                size="large"
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 700,
                  boxShadow: `0 8px 24px ${alpha(theme.palette.secondary.main, 0.25)}`,
                  "&:hover": {
                    boxShadow: `0 12px 32px ${alpha(theme.palette.secondary.main, 0.35)}`,
                  },
                }}
              >
                Preview & Confirm
              </LoadingButton>
            </Stack>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog
        open={previewOpen}
        onClose={handlePreviewClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          elevation: 8,
          sx: {
            borderRadius: 4,
            overflow: "hidden",
            background: theme.palette.background.paper,
            boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.15)}`,
          },
        }}
      >
        {/* Preview header */}
        <Box
          sx={{
            p: 3,
            pb: 1.5,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  bgcolor: "secondary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "common.white",
                }}
              >
                <Receipt fontSize="small" />
              </Box>
              <Typography variant="h6" fontWeight="700" letterSpacing={-0.5}>
                Confirm Top-Up
              </Typography>
            </Stack>
            <IconButton
              onClick={handlePreviewClose}
              size="small"
              sx={{
                color: "text.secondary",
                bgcolor: alpha(theme.palette.common.black, 0.04),
                "&:hover": { bgcolor: alpha(theme.palette.common.black, 0.08) },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          {previewData && (
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.background.default, 0.6),
                borderColor: alpha(theme.palette.divider, 0.6),
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight="700"
                    color="secondary.main"
                  >
                    GH₵ {previewData.amount}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Mobile Partner
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {previewData.mobilePartner}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Phone Number
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {previewData.phoneNumber}
                  </Typography>
                </Stack>
                <Divider />
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.warning.main, 0.08),
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    <strong>Note:</strong> Funds will be credited to your wallet
                    after successful payment.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          )}
        </DialogContent>

        <Box
          sx={{
            p: 3,
            pt: 0,
            display: "flex",
            gap: 1.5,
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.background.default, 0.4),
          }}
        >
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            onClick={handlePreviewClose}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <LoadingButton
            fullWidth
            variant="contained"
            color="secondary"
            onClick={handleConfirm}
            loading={isPending}
            disabled={isPending}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              boxShadow: `0 8px 24px ${alpha(theme.palette.secondary.main, 0.25)}`,
              "&:hover": {
                boxShadow: `0 12px 32px ${alpha(theme.palette.secondary.main, 0.35)}`,
              },
            }}
          >
            Confirm & Top Up
          </LoadingButton>
        </Box>
      </Dialog>
    </>
  );
}

export default TopUpRequest;

// import { useContext } from "react";
// import { useForm, Controller } from "react-hook-form";
// import { yupResolver } from "@hookform/resolvers/yup";
// import {
//   Dialog,
//   DialogContent,
//   Stack,
//   TextField,
//   InputAdornment,
//   Typography,
// } from "@mui/material";
// import { LoadingButton } from "@mui/lab";
// import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
// import { useMutation } from "@tanstack/react-query";
// import { globalAlertType } from "../../components/alert/alertType";
// import { CustomContext, useCustomContext } from "../../context/providers/CustomProvider";
// import { sendWalletTopUp } from "../../api/walletAPI";
// import MobilePartner from "../../components/MobilePartner";
// import CustomDialogTitle from "../../components/dialogs/CustomDialogTitle";
// import { topUpSchema } from "../../config/validationSchema";

// // Form values interface

// // Yup validation schema

// function TopUpRequest() {
//   const { pathname } = useLocation();
//   const navigate = useNavigate();
//   const { customDispatch } = useCustomContext();
//   const [searchParams, setSearchParams] = useSearchParams();
//   const open = Boolean(searchParams.get("add-money"));

//   // React Hook Form setup
//   const {
//     control,
//     handleSubmit,
//     reset,
//     formState: { isSubmitting },
//   } = useForm({
//     resolver: yupResolver(topUpSchema),
//     defaultValues: {
//       mobilePartner: "",
//       phoneNumber: "",
//       amount: 1,
//     },
//   });

//   // Mutation for submitting top-up request
//   const { mutateAsync, isPending } = useMutation({
//     mutationFn: sendWalletTopUp,
//     onError: (error) => {
//       customDispatch(
//         globalAlertType("error", error?.message || "An error occurred."),
//       );
//     },
//     onSuccess: (data) => {

//       if (data) {
//         navigate(`/confirm`, {
//           replace: true,
//           state: {
//             id: data?.paymentId,
//             categoryType: "wallet",
//             path: pathname,
//             isWallet: true,
//           },
//         });
//         // handleClose();
//       }
//     },
//   });

//   const onSubmit = async (data) => {
//     const payload = {
//       amount: data.amount,
//       mobilePartner: data.mobilePartner,
//       phoneNumber: data.phoneNumber,
//     };

//     try {
//       await mutateAsync(payload);
//     } catch (error) {
//       customDispatch(
//         globalAlertType("error", "Failed to send request. Please try again."),
//       );
//     }
//   };

//   const handleClose = () => {
//     setSearchParams((params) => {
//       params.delete("add-money");
//       return params;
//     });
//     reset(); // Reset form when dialog closes
//   };

//   return (
//     <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
//       <CustomDialogTitle
//         title="Wallet Top-Up"
//         subtitle="Fill in the details to top-up wallet via Mobile Money."
//         onClose={handleClose}
//       />

//       <DialogContent sx={{ p: 2 }}>
//         <form onSubmit={handleSubmit(onSubmit)} noValidate>
//           <Stack spacing={2}>
//             {/* Mobile Partner (custom component with Controller) */}
//             <Controller
//               name="mobilePartner"
//               control={control}
//               render={({ field, fieldState }) => (
//                 <MobilePartner
//                   size="small"
//                   value={field.value}
//                   setValue={field.onChange}
//                   error={!!fieldState.error}
//                   helperText={fieldState.error?.message}
//                 />
//               )}
//             />

//             {/* Phone Number */}
//             <Controller
//               name="phoneNumber"
//               control={control}
//               render={({ field, fieldState }) => (
//                 <TextField
//                   {...field}
//                   type="tel"
//                   inputMode="tel"
//                   variant="outlined"
//                   label="Mobile Money Number"
//                   fullWidth
//                   required
//                   size="small"
//                   error={!!fieldState.error}
//                   helperText={fieldState.error?.message}
//                 />
//               )}
//             />

//             <Typography
//               variant="caption"
//               fontStyle="italic"
//               color="secondary"
//               paragraph
//             >
//               Enter the amount you want to top up.
//             </Typography>

//             {/* Amount */}
//             <Controller
//               name="amount"
//               control={control}
//               render={({ field, fieldState }) => (
//                 <TextField
//                   {...field}
//                   type="number"
//                   inputMode="numeric"
//                   placeholder="Amount"
//                   label="Top Up Amount"
//                   size="small"
//                   fullWidth
//                   required
//                   autoFocus
//                   InputProps={{
//                     startAdornment: (
//                       <InputAdornment position="start">GH¢</InputAdornment>
//                     ),
//                     endAdornment: (
//                       <InputAdornment position="end">p</InputAdornment>
//                     ),
//                   }}
//                   error={!!fieldState.error}
//                   helperText={fieldState.error?.message}
//                   onChange={(e) => field.onChange(e.target.valueAsNumber || "")}
//                   value={field.value || ""}
//                 />
//               )}
//             />

//             <LoadingButton
//               type="submit"
//               variant="contained"
//               loading={isPending || isSubmitting}
//               disabled={isPending || isSubmitting}
//               fullWidth
//               color="secondary"
//               size="large"
//             >
//               Top Up Now
//             </LoadingButton>
//           </Stack>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }

// export default TopUpRequest;
