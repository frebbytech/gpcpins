// PaymentOption.jsx

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Box,
  FormControl,
  FormHelperText,
  RadioGroup,
  Typography,
  IconButton,
  Stack,
  FormLabel,
  TextField,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowBackIosNewRounded } from "@mui/icons-material";
import MobileMoneyOption from "./tabs/MobileMoneyOption";
import WalletOption from "./WalletOption";
import { paymentValidationSchema } from "../config/validationSchema";
import { LoadingButton } from "@mui/lab";

const defaultValues = {
  fullName: "",
  email: "",
  paymentMethod: "",
  mobilePartner: "",
  phonenumber: "",
  confirmPhonenumber: "",
  token: "",
};

function useShouldShowComponent() {
  const { pathname } = useLocation();
  const excludedPaths = ["airtime", "prepaid",'movie','bus-ticket','match'];

  // Splits path into segments to avoid partial word matching errors
  const pathSegments = pathname.toLowerCase().split("/");

  return !excludedPaths.some((path) => pathSegments.includes(path));
}

function PaymentOption({
  showWallet = false,
  showMomo = true,
  onSubmit,
  initialValues = {},
}) {
  const shouldShow = useShouldShowComponent();

  const methods = useForm({
    resolver: yupResolver(paymentValidationSchema),
    defaultValues: {
      ...defaultValues,
      ...initialValues,
    },
    mode: "onChange",
    reValidateMode: "onChange",
    criteriaMode: "all",
    shouldFocusError: true,
  });

  const {
    watch,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = methods;



  const paymentMethod = watch("paymentMethod");

  // Clear unrelated fields when payment method changes
  useEffect(() => {
    if (paymentMethod === "wallet") {
      setValue("mobilePartner", "");
      setValue("phonenumber", "");
      setValue("confirmPhonenumber", "");
    }

    if (paymentMethod === "momo") {
      setValue("token", "");
    }
  }, [paymentMethod, setValue]);

  const submitHandler = async (values) => {
    await onSubmit?.(values);
  };

  return (
    <FormProvider {...methods}>
      <Box component="form" noValidate onSubmit={handleSubmit(submitHandler)}>
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {shouldShow && (
              <Link
                to={-1}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <IconButton>
                  <ArrowBackIosNewRounded fontSize="small" />
                </IconButton>
              </Link>
            )}
            <Typography variant="h6" fontWeight="bold" textTransform='uppercase'>
              Payment Information
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, mb: 3 }}
          >
            Choose the payment method you want to use for this transaction.
            {/* You can also provide your name and email address to receive a receipt for your purchase. */}
          </Typography>
        </Box>

        {/* PERSONAL DETAILS */}

        <FormControl fullWidth sx={{ py: 2 }}>
          <FormLabel sx={{ pb: 1 }}>Personal Details (optional)</FormLabel>

          <Stack spacing={2}>
            <TextField
              size="small"
              fullWidth
              label="Full Name"
              placeholder="Enter your full name"
              inputMode="text"
              autoComplete="name"
              {...methods.register("fullName")}
              error={!!errors.fullName}
              helperText={errors.fullName?.message}
            />

            <TextField
              size="small"
              fullWidth
              type="email"
              label="Email Address"
              inputMode="email"
              autoComplete="email"
              {...methods.register("email")}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
          </Stack>
        </FormControl>

        {/* PAYMENT METHODS */}

        <FormControl
          fullWidth
          error={!!errors.paymentMethod}
          sx={
            errors.paymentMethod
              ? {
                  border: "red 1px solid",
                  borderRadius: 2,
                  p: 1,
                }
              : null
          }
        >
          {/* <FormLabel sx={{ pb: 1 }}>Select Payment Method</FormLabel> */}
          <FormHelperText>{errors.paymentMethod?.message}</FormHelperText>

          <RadioGroup
            value={paymentMethod}
            onChange={(e) =>
              setValue("paymentMethod", e.target.value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          >
            {showMomo && <MobileMoneyOption />}

            {/* {showWallet && <WalletOption />} */}
          </RadioGroup>
        </FormControl>

        {/* SUBMIT BUTTON */}

        <LoadingButton
          type="submit"
          variant="contained"
          fullWidth
          loading={isSubmitting}
          // disabled={!isValid}
          sx={{ py: 1.5, mt: 3 }}
        >
          Review Order & Pay
        </LoadingButton>
      </Box>
    </FormProvider>
  );
}

export default PaymentOption;

// import {
//   Box,
//   FormControl,
//   FormLabel,
//   RadioGroup,
//   Stack,
//   TextField,
// } from "@mui/material";
// import WalletOption from "./WalletOption";
// import MobileMoneyOption from "./tabs/MobileMoneyOption";
// function PaymentOption({
//   showWallet,
//   showMomo,
//   setPaymentMethod,
//   error,
//   helperText,
//   value,
//   walletDetails,
//   mobileMoneyDetails,
//   fullNameDetails,
//   emailDetails,
// }) {
//   return (
//     <Box>
//       <FormControl sx={{ width: "100%", py: 2 }}>
//         <FormLabel sx={{ pb: 1 }}>Personal Details (optional)</FormLabel>
//         <Stack spacing={2} pb={2}>
//           <TextField
//             size="small"
//             placeholder="Enter your Name"
//             label="Full Name"
//             inputMode="text"
//             fullWidth
//             value={fullNameDetails?.fullName}
//             onChange={(e) => fullNameDetails?.setFullName(e.target?.value)}
//             error={fullNameDetails?.fullNameErr}
//             helperText={fullNameDetails?.fullNameHelperText}
//           />

//           <TextField
//             size="small"
//             type="email"
//             inputMode="email"
//             label="Email Address"
//             fullWidth
//             value={emailDetails?.email}
//             onChange={(e) => emailDetails?.setEmail(e.target?.value)}
//             error={emailDetails?.emailErr}
//             helperText={emailDetails?.emailHelperText}
//           />
//         </Stack>
//       </FormControl>
//       <FormControl sx={{ width: "100%", py: 2 }}>
//         <FormLabel sx={{ pb: 1 }}>Select Payment Method</FormLabel>
//         <RadioGroup
//           value={value}
//           onChange={(e) => setPaymentMethod(e.target.value)}
//         >
//           {showMomo && (
//             <MobileMoneyOption {...mobileMoneyDetails} value={value} />
//           )}
//           {showWallet && <WalletOption {...walletDetails} value={value} />}
//         </RadioGroup>
//         {error && <small style={{ color: "#B72136" }}>{helperText}</small>}
//       </FormControl>
//     </Box>
//   );
// }

// export default PaymentOption;
