import { useContext, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  TextField,
  Stack,
  CircularProgress,
  Typography,
  Button,
  IconButton,
  Paper,
  Chip,
  useTheme,
  alpha,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import LoadingButton from "@mui/lab/LoadingButton";
import {
  ArrowBackRounded,
  WarningAmberRounded,
  LockRounded,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CustomDialogTitle from "@/components/dialogs/CustomDialogTitle";
import { useSearchParams } from "react-router-dom";
import {
  getInternationalMobileFormat,
  isValidPartner,
} from "@/constants/PhoneCode";
import ServiceProvider from "@/components/ServiceProvider";
import { disableWallet, getWalletStatus, sendBundle } from "@/api/agentAPI";
import { useCustomContext } from "@/context/providers/CustomProvider";
import { globalAlertType } from "@/components/alert/alertType";
import { getBundleList } from "@/api/paymentAPI";
import { currencyFormatter } from "@/constants";
import { useAuth } from "@/context/providers/AuthProvider";
import { verifyPin } from "@/config/validation";

const MAX_PIN_ATTEMPTS = 3;

const NETWORK_CODES = { MTN: "4", Vodafone: "6", AirtelTigo: "1" };

/* ------------------------------------------------------------------ *
 * Validation schema
 * ------------------------------------------------------------------ */
const bundleTransferSchema = yup.object({
  provider: yup
    .string()
    .test("required-provider", "Select a network", (v) => !!v && v !== "None"),
  bundle: yup
    .object()
    .nullable()
    .test("has-plan", "Please select a plan", (v) => !!v?.plan_id),
  phoneNumber: yup
    .string()
    .required("Recipient number is required")
    .test("valid-partner", function validPartner(value) {
      const { provider } = this.parent;
      if (!value || !provider || provider === "None") return true;
      const international = getInternationalMobileFormat(value);
      if (!isValidPartner(provider, international)) {
        return this.createError({ message: `Invalid ${provider} number` });
      }
      return true;
    }),
  confirmPhoneNumber: yup
    .string()
    .required("Please confirm the recipient number")
    .test(
      "numbers-match",
      "Recipient numbers do not match",
      function numbersMatch(value) {
        const { phoneNumber } = this.parent;
        if (!value || !phoneNumber) return true;
        return (
          getInternationalMobileFormat(value) ===
          getInternationalMobileFormat(phoneNumber)
        );
      },
    ),
});

const pinSchema = yup.object({
  token: yup
    .string()
    .trim()
    .required("PIN is required")
    .test("len", "PIN must be 4 digits", (v) => !v || v.length === 4)
    .test("valid", "Please enter a valid PIN", (v) => !v || verifyPin(v)),
});

const bundleLabel = (option) =>
  option?.plan_name
    ? `${option.plan_name} • ${option.volume} • ${currencyFormatter(option.price)}`
    : "";

const NewBundleTransfer = () => {
  const theme = useTheme();
  const { customDispatch } = useCustomContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showPinPage, setShowPinPage] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_PIN_ATTEMPTS);
  const [serverErr, setServerErr] = useState("");

  const form = useForm({
    resolver: yupResolver(bundleTransferSchema),
    defaultValues: {
      provider: "",
      bundle: null,
      phoneNumber: "",
      confirmPhoneNumber: "",
    },
  });

  const pinForm = useForm({
    resolver: yupResolver(pinSchema),
    defaultValues: { token: "" },
  });

  const provider = form.watch("provider");

  const { data, isLoading: isLoadingWalletStatus } = useQuery({
    queryKey: ["wallet-status"],
    queryFn: getWalletStatus,
    enabled: !!user?.id,
  });

  const bundles = useQuery({
    queryKey: ["bundle-list", provider],
    queryFn: () => getBundleList(NETWORK_CODES[provider] ?? 0),
    enabled: !!provider && provider !== "None",
    initialData: [],
  });

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const confirmationMessage = "Are you sure you want to leave?";
      e.returnValue = confirmationMessage;
      return confirmationMessage;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const { mutateAsync, isLoading } = useMutation({
    mutationFn: sendBundle,
    retry: false,
  });

  const handleClearFields = () => {
    form.reset();
    pinForm.reset();
    setAttemptsLeft(MAX_PIN_ATTEMPTS);
    setServerErr("");
    setShowPinPage(false);
  };

  const handleClose = () => {
    Swal.fire({
      title: "Exiting",
      text: "Cancel Transaction?",
      showCancelButton: true,
    }).then(({ isConfirmed }) => {
      if (isConfirmed) {
        setSearchParams((params) => {
          params.delete("data");
          params.delete("bundle-prompt");
          return params;
        });
        handleClearFields();
      }
    });
  };

  const handleGoback = () => setShowPinPage(false);

  const handleSubmitPayload = ({ token }) => {
    const { phoneNumber, provider: net, bundle } = form.getValues();
    const internationalNumber = getInternationalMobileFormat(phoneNumber);

    const walletBalance = queryClient.getQueryData(["wallet-balance"], {
      exact: true,
    });

    if (Number(walletBalance) < Number(bundle.price)) {
      customDispatch(
        globalAlertType(
          "error",
          "Insufficient Wallet Balance. Please request a top up.",
        ),
      );
      return;
    }

    const payload = {
      recipient: internationalNumber,
      network: net,
      bundle,
      token,
    };

    Swal.fire({
      title: "Processing",
      text: "Proceed with transaction?",
      showCancelButton: true,
    }).then(({ isConfirmed }) => {
      if (!isConfirmed) return;

      mutateAsync(payload, {
        onSettled: () => {
          pinForm.reset();
          queryClient.invalidateQueries(["agent-bundle-transactions"]);
          queryClient.invalidateQueries(["wallet-balance"]);
          queryClient.invalidateQueries(["notifications", user?.id]);
        },
        onSuccess: (result) => {
          setSearchParams((params) => {
            params.delete("data");
            params.delete("bundle-prompt");
            return params;
          });
          handleClearFields();
          Swal.fire({
            icon: "success",
            title: "Transfer Successful",
            text: result || "Transaction Completed!",
            showCancelButton: false,
          });
        },
        onError: async (error) => {
          if (error === "Invalid pin!") {
            setAttemptsLeft((prev) => {
              const next = prev - 1;
              if (next <= 0) {
                setServerErr("Invalid PIN. Your wallet has been disabled.");
                disableWallet();
              } else {
                setServerErr(`Invalid PIN. ${next} attempt(s) left.`);
              }
              return next;
            });
          } else {
            setSearchParams((params) => {
              params.delete("data");
              params.delete("bundle-prompt");
              return params;
            });
            handleClearFields();
            Swal.fire({
              icon: "error",
              title: "Transfer Failed!",
              text:
                typeof error === "string"
                  ? error
                  : error?.message || "An unknown error has occurred!",
              showCancelButton: false,
            });
          }
        },
      });
    });
  };

  return (
    <Dialog
      open={Boolean(searchParams.get("bundle-prompt"))}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <CustomDialogTitle
        title={showPinPage ? "Confirm Pin" : "New Transfer"}
        subtitle="Transfer data bundles to all networks with ease"
        onClose={handleClose}
      />

      <DialogContent sx={{ px: 2 }}>
        {showPinPage ? (
          isLoadingWalletStatus ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                Checking wallet status…
              </Typography>
            </Stack>
          ) : attemptsLeft <= 0 || !data?.active ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: "center",
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                bgcolor: alpha(theme.palette.warning.main, 0.06),
              }}
            >
              <WarningAmberRounded
                color="warning"
                sx={{ fontSize: 40, mb: 1 }}
              />
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Wallet Account Disabled
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Please contact us for further assistance.
              </Typography>
              {data?.timeOut && (
                <Chip
                  label={`Try again in ${data.timeOut}`}
                  color="warning"
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
              )}
              <Box>
                <Button
                  variant="outlined"
                  onClick={handleGoback}
                  sx={{ textTransform: "none" }}
                >
                  Go Back
                </Button>
              </Box>
            </Paper>
          ) : (
            <Stack py={2} spacing={2.5} alignItems="center">
              <IconButton
                sx={{ alignSelf: "flex-start" }}
                onClick={() => {
                  setShowPinPage(false);
                  pinForm.reset();
                  setServerErr("");
                }}
              >
                <ArrowBackRounded />
              </IconButton>

              <Box sx={{ textAlign: "center" }}>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: "primary.main",
                    mb: 1.5,
                  }}
                >
                  <LockRounded />
                </Box>
                <Typography variant="h6" fontWeight={700}>
                  Enter Wallet PIN
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Confirm your 4-digit PIN to complete this transfer.
                </Typography>
              </Box>

              <Controller
                name="token"
                control={pinForm.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      if (serverErr) setServerErr("");
                    }}
                    size="small"
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    error={!!fieldState.error || !!serverErr}
                    helperText={fieldState.error?.message || serverErr}
                    sx={{
                      width: 220,
                      "& input": {
                        textAlign: "center",
                        letterSpacing: 8,
                        fontSize: "1.2rem",
                      },
                    }}
                  />
                )}
              />

              <LoadingButton
                variant="contained"
                loading={isLoading}
                onClick={pinForm.handleSubmit(handleSubmitPayload)}
                fullWidth
                sx={{ maxWidth: 220, textTransform: "none" }}
              >
                Make Transfer
              </LoadingButton>
            </Stack>
          )
        ) : (
          <Stack spacing={2} sx={{ py: 2, maxWidth: 420, mx: "auto" }}>
            <Controller
              name="provider"
              control={form.control}
              render={({ field, fieldState }) => (
                <ServiceProvider
                  label="Network Type"
                  size="small"
                  value={field.value}
                  setValue={(val) => {
                    field.onChange(val);
                    form.setValue("bundle", null);
                  }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="bundle"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={bundles.data}
                  loading={bundles.isFetching}
                  size="small"
                  closeText=" "
                  disableClearable
                  disabled={!provider || provider === "None"}
                  value={field.value}
                  fullWidth
                  onChange={(e, value) => field.onChange(value)}
                  isOptionEqualToValue={(option, value) =>
                    !value?.plan_id || option?.plan_id === value?.plan_id
                  }
                  getOptionLabel={bundleLabel}
                  noOptionsText={
                    !provider || provider === "None"
                      ? "Select a network first"
                      : bundles.isError
                        ? "Couldn't load bundles"
                        : "No bundles available"
                  }
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.plan_id}>
                      <Stack sx={{ py: 0.25 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {option.plan_name} — {option.volume}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {currencyFormatter(option.price)}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Available Bundle Plan"
                      size="small"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />

            <Controller
              name="phoneNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  size="small"
                  type="tel"
                  inputMode="tel"
                  variant="outlined"
                  label="Recipient Number"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="confirmPhoneNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  size="small"
                  type="tel"
                  inputMode="tel"
                  variant="outlined"
                  label="Confirm Recipient Number"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <LoadingButton
              variant="contained"
              onClick={form.handleSubmit(() => setShowPinPage(true))}
              fullWidth
              size="large"
              sx={{ mt: 1, textTransform: "none" }}
            >
              Transfer Now
            </LoadingButton>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewBundleTransfer;

// import {
//   Dialog,
//   DialogContent,
//   Box,
//   TextField,
//   Stack,
//   CircularProgress,
//   Typography,
//   Button,
//   IconButton,
// } from "@mui/material";
// import { ArrowBack } from "@mui/icons-material";
// import Swal from "sweetalert2";
// import Autocomplete from "@mui/material/Autocomplete";
// import LoadingButton from "@mui/lab/LoadingButton";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import CustomDialogTitle from "@/components/dialogs/CustomDialogTitle";
// import { useSearchParams } from "react-router-dom";
// import {  useState } from "react";
// import {
//   getInternationalMobileFormat,
//   isValidPartner,
// } from "@/constants/PhoneCode";
// import ServiceProvider from "@/components/ServiceProvider";
// import { disableWallet, getWalletStatus, sendBundle } from "@/api/agentAPI";
// import { useCustomContext } from "@/context/providers/CustomProvider";
// import { globalAlertType } from "@/components/alert/alertType";
// import { getBundleList } from "@/api/paymentAPI";
// import { currencyFormatter } from "@/constants";
// import { useEffect } from "react";
// import { useAuth } from "@/context/providers/AuthProvider";
// import { verifyPin } from "@/config/validation";

// const NewBundleTransfer = () => {
//   const { customDispatch } =useCustomContext();
//   const queryClient = useQueryClient();
//   const { user } =useAuth();
//   const [searchParams, setSearchParams] = useSearchParams();
//   const [confirmPhoneNumber, setConfirmPhoneNumber] = useState("");
//   const [phoneNumber, setPhoneNumber] = useState("");
//   const [provider, setProvider] = useState("");
//   const [bundle, setBundle] = useState({
//     plan_id: "",
//     plan_name: "",
//     type: "",
//     volume: "",
//     price: "",
//   });

//   const [providerErr, setProviderErr] = useState("");
//   const [phoneNumberErr, setPhoneNumberErr] = useState("");
//   const [confirmPhoneNumberErr, setConfirmPhoneNumberErr] = useState("");
//   const [bundleErr, setBundleErr] = useState("");
//   const [token, setToken] = useState("");
//   const [err, setErr] = useState("");
//   const [failureCount, setFailCount] = useState(3);
//   const [showPinPage, setShowPinPage] = useState(false);

//   // Get wallet status and non-user information
//   const { data, isLoading: isLoadingWalletStatus } = useQuery({
//     queryKey: ["wallet-status"],
//     queryFn: getWalletStatus,
//     enabled: !!user?.id,
//   });

//   const bundles = useQuery({
//     queryKey: ["bundle-list", provider],
//     queryFn: () =>
//       getBundleList(
//         provider === "MTN"
//           ? "4"
//           : provider === "Vodafone"
//           ? "6"
//           : provider === "AirtelTigo"
//           ? "1"
//           : 0
//       ),
//     enabled: !!provider,
//     initialData: [],
//   });

//   useEffect(() => {
//     const handleBeforeUnload = (e) => {
//       const confirmationMessage = "Are you sure you want to leave?";
//       e.returnValue = confirmationMessage; // For IE and Firefox prior to version 4
//       return confirmationMessage; // For Safari and modern browsers
//     };

//     window.addEventListener("beforeunload", handleBeforeUnload);

//     return () => {
//       window.removeEventListener("beforeunload", handleBeforeUnload);
//     };
//   }, []);

//   useEffect(() => {
//     setBundle({
//       plan_id: "",
//       plan_name: "",
//       type: "",
//       volume: "",
//       price: "",
//     });
//   }, [provider]);

//   const { mutateAsync, isLoading } = useMutation({
//     mutationFn: sendBundle,
//     retry:false,

//   });
//   const handleSubmit = () => {
//     setProviderErr("");
//     setConfirmPhoneNumberErr("");
//     setPhoneNumberErr("");
//     setBundleErr("");
//     if (provider === "None") {
//       setProviderErr("Required*");
//       return;
//     }

//     if (!bundle.plan_name) {
//       setBundleErr("Please select a plan*");
//       return;
//     }

//     if (phoneNumber === "") {
//       setPhoneNumberErr("Required*");
//       return;
//     }

//     const internationalNumber = getInternationalMobileFormat(phoneNumber);
//     const internationalConfirmNumber =
//       getInternationalMobileFormat(confirmPhoneNumber);
//     if (!isValidPartner(provider, internationalNumber)) {
//       setPhoneNumberErr(`Invalid ${provider} number`);
//       return;
//     }

//     if (internationalNumber !== internationalConfirmNumber) {
//       setConfirmPhoneNumberErr(`Recipient numbers do not match!`);
//       return;
//     }

//     setShowPinPage(true);
//   };

//   const handleSubmitPayload = () => {
//     setErr("");
//     if (token.trim() === "") {
//       return setErr("Pin is required*");
//     }
//     if (token.trim().length !== 4 || !verifyPin(token?.trim())) {
//       return setErr("Please enter a valid pin!");
//     }

//     const internationalNumber = getInternationalMobileFormat(phoneNumber);

//     const values = {
//       recipient: internationalNumber,
//       network: provider,
//       bundle,
//       token,
//     };

//     const walletBalance = queryClient.getQueryData(["wallet-balance"], {
//       exact: true,
//     });

//     if (Number(walletBalance) < values.amount) {
//       customDispatch(
//         globalAlertType(
//           "error",
//           "Insufficient Wallet Balance.Please request for a top up."
//         )
//       );
//       return;
//     }

//     Swal.fire({
//       title: "Processing",
//       text: `Proceed with transaction?`,
//       showCancelButton: true,
//     }).then(({ isConfirmed }) => {
//       if (isConfirmed) {
//         mutateAsync(values, {
//           onSettled: () => {
//             setToken("");
//             queryClient.invalidateQueries(["agent-bundle-transactions"]);
//             queryClient.invalidateQueries(["wallet-balance"]);
//             queryClient.invalidateQueries(["notifications"]);
//           },
//           onSuccess: (data) => {
//             handleClearFields();

//             Swal.fire({
//               icon: "success",
//               title: "Transfer Successful",
//               text: data || "Transaction Completed!",
//               showCancelButton: false,
//             });

//             setSearchParams((params) => {
//               params.delete("data");
//               params.delete("bundle-prompt");
//               return params;
//             });
//             setShowPinPage(false);
//           },
//           onError: async (error) => {
//             if (error === "Invalid pin!") {
//               setFailCount((prevState) => prevState - 1);

//               if (failureCount <= 3) {
//                 setErr(`${error} ${failureCount - 1} attempt(s) left.`);
//                 if (failureCount <= 1) {
//                   await disableWallet();
//                 }
//               } else {
//                 setErr(error);
//               }
//             } else {
//               handleClearFields();
//               Swal.fire({
//                 icon: "error",
//                 title: "Transfer Failed!",
//                 text: error || "An unknown error has occurred!",
//                 showCancelButton: false,
//               });
//               // customDispatch(globalAlertType("error", error));
//             }
//           },
//         });
//       }
//     });
//   };

//   const handleClose = () => {
//     Swal.fire({
//       title: "Exiting",
//       text: `Cancel Transaction?`,
//       showCancelButton: true,
//     }).then(({ isConfirmed }) => {
//       if (isConfirmed) {
//         setSearchParams((params) => {
//           params.delete("data");
//           params.delete("bundle-prompt");
//           return params;
//         });

//         handleClearFields();
//       }
//     });
//   };

//   const handleGoback = () => setShowPinPage(false);

//   const handleClearFields = () => {
//     setShowPinPage(false);
//     setSearchParams((params) => {
//       params.delete("data");
//       params.delete("bundle-prompt");
//       return params;
//     });
//     setPhoneNumber("");
//     setConfirmPhoneNumber("");
//     setProvider("");
//     setToken("");
//     setFailCount(3);
//     setToken("");
//     setBundle({
//       plan_id: "",
//       plan_name: "",
//       type: "",
//       volume: "",
//       price: "",
//     });
//   };
//   return (
//     <Dialog
//       open={Boolean(searchParams.get("bundle-prompt"))}
//       maxWidth="sm"
//       fullWidth
//     >
//       <CustomDialogTitle
//         title={showPinPage ? "Confirm Pin" : "New Transfer"}
//         subtitle="Transfer bundle to all networks with ease"
//         onClose={handleClose}
//       />

//       <DialogContent sx={{ px: 2 }}>
//         {showPinPage ? (
//           <>
//             {isLoadingWalletStatus ? (
//               <Stack justifyContent="center" alignItems="center" height={200}>
//                 <CircularProgress />
//               </Stack>
//             ) : failureCount <= 0 || !data?.active ? (
//               <Stack p={4} alignItems="center" spacing={1}>
//                 <Typography variant="h6" paragraph>
//                   Wallet Account Disabled
//                 </Typography>
//                 <Typography variant="caption">
//                   Please contact us for further assistance.
//                 </Typography>
//                 {data?.timeOut && (
//                   <>
//                     <span>OR</span>
//                     <Typography variant="caption">
//                       Try again in{" "}
//                       <span style={{ color: "red" }}>{data?.timeOut}</span>
//                     </Typography>
//                   </>
//                 )}
//                 <Button onClick={handleGoback}>Go Back</Button>
//               </Stack>
//             ) : (
//               <Stack py={2} spacing={2}>
//                 <IconButton
//                   sx={{ alignSelf: "flex-start" }}
//                   onClick={() => setShowPinPage(false)}
//                 >
//                   <ArrowBack />
//                 </IconButton>

//                 <Typography variant="h6">Wallet Pin</Typography>

//                 <TextField
//                   size="small"
//                   type="password"
//                   inputMode="numeric"
//                   placeholder="Enter 4-digit pin"
//                   value={token}
//                   onChange={(e) => setToken(e.target.value)}
//                   error={Boolean(err)}
//                   helperText={err}
//                   margin="dense"
//                   sx={{ textAlign: "center", width: 200 }}
//                 />
//                 <LoadingButton
//                   type="submit"
//                   variant="contained"
//                   loading={isLoading}
//                   onClick={handleSubmitPayload}
//                   fullWidth
//                   size="small"
//                 >
//                   Make Transfer
//                 </LoadingButton>
//               </Stack>
//             )}
//           </>
//         ) : (
//           <Box
//             sx={{
//               display: "flex",
//               flexDirection: "column",
//               alignItems: "center",
//               justifyContent: "center",
//               gap: 2,
//               py: 2,
//             }}
//           >
//             <ServiceProvider
//               label="Network Type"
//               size="small"
//               value={provider}
//               setValue={setProvider}
//               error={providerErr !== ""}
//               helperText={providerErr}
//             />
//             <Autocomplete
//               options={bundles.data}
//               loading={bundles?.isLoading}
//               size="small"
//               closeText=" "
//               disableClearable
//               value={bundle}
//               fullWidth
//               onChange={(e, value) => setBundle(value)}
//               isOptionEqualToValue={(option, value) =>
//                 value?.plan_id === undefined ||
//                 value?.plan_id === null ||
//                 value?.plan_id === "" ||
//                 option?.plan_id === value?.plan_id
//               }
//               getOptionLabel={(option) =>
//                 `${option?.plan_name}---${option?.volume}---${currencyFormatter(
//                   option?.price
//                 )}` || ""
//               }
//               renderInput={(params) => {
//                 return (
//                   <TextField
//                     {...params}
//                     label="Available Bundle Plan"
//                     size="small"
//                     fullWidth
//                     error={bundleErr ? true : false}
//                     helperText={bundleErr}
//                   />
//                 );
//               }}
//             />
//             <TextField
//               size="small"
//               type="tel"
//               inputMode="tel"
//               variant="outlined"
//               label="Recipient Number"
//               fullWidth
//               required
//               value={phoneNumber}
//               onChange={(e) => setPhoneNumber(e.target.value)}
//               error={phoneNumberErr ? true : false}
//               helperText={phoneNumberErr}
//               margin="dense"
//             />
//             <TextField
//               size="small"
//               type="tel"
//               inputMode="tel"
//               variant="outlined"
//               label="Confirm Recipient Number"
//               fullWidth
//               required
//               value={confirmPhoneNumber}
//               onChange={(e) => setConfirmPhoneNumber(e.target.value)}
//               error={confirmPhoneNumberErr ? true : false}
//               helperText={confirmPhoneNumberErr}
//               margin="dense"
//             />

//             <LoadingButton
//               type="submit"
//               variant="contained"
//               loading={isLoading}
//               onClick={handleSubmit}
//               fullWidth
//               size="large"
//               sx={{ mt: 2 }}
//             >
//               Transfer Now
//             </LoadingButton>
//           </Box>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// };

// export default NewBundleTransfer;
