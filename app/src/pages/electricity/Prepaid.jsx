import { useState } from "react";
import {
  Typography,
  TextField,
  Paper,
  Stack,
  Divider,
  Alert,
  AlertTitle,
} from "@mui/material";

import { LoadingButton } from "@mui/lab";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import AnimatedContainer from "../../components/animations/AnimatedContainer";
import { prepaidMeterValidationSchema } from "../../config/validationSchema";
import { getMeterByNumber } from "@/api/meterAPI"; // assuming this API exists
import MeterDetailsDialog from "./MeterDetailsDialog";


function Prepaid() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [submittedNumber, setSubmittedNumber] = useState("");

  // React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(prepaidMeterValidationSchema),
    defaultValues: {
      number: "",
      name: "",
    },
  });

  const watchedName = watch("name");

  // Query to fetch meter details (enabled only when modal opens)
  const {
    data: meter,
    isLoading: meterLoading,
    // isError: meterError,
    error: meterError,
    refetch: refetchMeter,
  } = useQuery({
    queryKey: ["meter-by-id", submittedNumber],
    queryFn: () => getMeterByNumber(submittedNumber, watchedName),
    enabled: !!submittedNumber, // manual trigger
    retry: 1,
  });

  console.log(meter)

  const onVerify = (values) => {
    const meterNumber = values?.number?.toUpperCase();
    setSubmittedNumber(meterNumber);
    setModalOpen(true);
    // We'll refetch after modal opens, but we'll call refetch in useEffect when modal opens and number changes.
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    // Optionally reset meter data
    setSubmittedNumber(null);
  };

  const handleProceedToVerify = () => {
    if (meter) {
      navigate(`prepaid/${submittedNumber}/buy`, {
        state: {
          meterDetails: {
            number: submittedNumber,
            name: meter.name,
            address: meter.address,
            type: meter.type,
            provider_name: meter.provider_name,
          },
        },
      });
    }
  };

  return (
    <>
      {/* Hero Banner */}
      {/* <PageHero
        title="Prepaid Units"
        subtitle=" Buy electricity units for all online meters instantly."
        bgImage={IMAGES.ecg}
      /> */}


        <AnimatedContainer>
          <Paper>
            <Typography
              variant="h5"
              color="primary"
              fontWeight="bold"
              gutterBottom
            >
              Buy Your Prepaid Units Online
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              We&apos;ve simplified things for easy & quick buying of your home
              and office prepaid units.
            </Typography>

            <Divider sx={{ my: 3 }} />

            <Alert severity="info"  sx={{ mb: 2 }}>
              <AlertTitle sx={{ fontWeight: "bold" }}>Verification</AlertTitle>
              You can verify your meter using your <strong>Meter Number</strong>
              , <strong>STs Number</strong>, or <strong>SPN Number</strong>.
            </Alert>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              Before proceeding, please ensure the displayed info matches your{" "}
              <strong>Meter Name</strong> or <strong>Customer Name</strong>{" "}
              exactly as it appears on your physical meter or bill.
            </Typography>

            <form onSubmit={handleSubmit(onVerify)} noValidate>
              <Stack
                spacing={2}
                maxWidth="sm"
                alignItems="center"
                py={4}
                mx="auto"
              >
                <Controller
                  name="number"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Meter Number/STs Number /SPN Number"
                      placeholder="e.g. 12788798766"
                      fullWidth
                      required
                      error={!!errors.number}
                      helperText={errors.number?.message}
                      inputProps={{ style: { textTransform: "uppercase" } }}
                      sx={{
                        width: "100%",
                        mx: "auto",
                        maxWidth: 380,
                      }}
                    />
                  )}
                />

                <LoadingButton
                  type="submit"
                  variant="contained"
                  loading={isSubmitting}
                  size="large"
                  sx={{
                    py: 1.5,
                    mt: 1,
                    width: "100%",
                    mx: "auto",
                    maxWidth: 380,
                  }}
                >
                  Verify Meter
                </LoadingButton>
              </Stack>
            </form>
       
          </Paper>
        </AnimatedContainer>
        <MeterDetailsDialog
          open={modalOpen}
          onClose={handleCloseModal}
          meter={meter}
          meterLoading={meterLoading}
          meterError={meterError}
          submittedNumber={submittedNumber}
          refetchMeter={refetchMeter}
          handleProceedToVerify={handleProceedToVerify}
        />

    </>
  );
}

export default Prepaid;
