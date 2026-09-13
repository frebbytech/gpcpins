import {  useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  TextField,
  InputAdornment,
  Tab,
  Typography,
  Stack,
  Alert,
  Box,
  CircularProgress,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  useTheme,
  alpha,
} from "@mui/material";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import LoadingButton from "@mui/lab/LoadingButton";
import {
  ArrowBackRounded,
  DeleteRounded,
  SearchRounded,
  CloudUploadRounded,
  InsertDriveFileRounded,
  WarningAmberRounded,
  LockRounded,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import _ from "lodash";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CustomDialogTitle from "@/components/dialogs/CustomDialogTitle";
import { useSearchParams } from "react-router-dom";
import {
  getInternationalMobileFormat,
  isValidPartner,
} from "@/constants/PhoneCode";
import ServiceProvider from "@/components/ServiceProvider";
import {
  getWalletStatus,
  disableWallet,
  sendAirtime,
  downloadAirtimeTemplate,
} from "@/api/agentAPI";
import { useCustomContext } from "@/context/providers/CustomProvider";
import { globalAlertType } from "@/components/alert/alertType";
import { readXLSX } from "@/config/readXLSX";
import { readCSV } from "@/config/readCSV";
import { currencyFormatter } from "@/constants";
import { useAuth } from "@/context/providers/AuthProvider";
import { verifyPin } from "@/config/validation";

const CSV_FILE_TYPE = "text/csv";
const XLSX_FILE_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_FILE_TYPE = "application/vnd.ms-excel";
const MAX_PIN_ATTEMPTS = 3;

/* ------------------------------------------------------------------ *
 * Validation schemas
 * ------------------------------------------------------------------ */

const singleTransferSchema = yup.object({
  provider: yup
    .string()
    .test("required-provider", "Select a network", (v) => !!v && v !== "None"),
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
  amount: yup
    .number()
    .transform((value, original) =>
      String(original).trim() === "" ? undefined : value,
    )
    .typeError("Enter a valid amount")
    .required("Amount is required")
    .min(1, "Minimum amount you can transfer is GH₵1"),
});

const bulkTransferSchema = yup.object({
  content: yup
    .array()
    .min(1, "Load a file with at least one recipient to continue")
    .test(
      "valid-amounts",
      "Some rows have an amount below GH₵1 — fix or remove them to continue",
      (list) => (list || []).every((item) => Number(item?.amount) >= 1),
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

const applySearchFilter = (list, query) => {
  if (!query) return list;
  return list.filter((row) =>
    Object.values(row).some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(query),
    ),
  );
};

const NewTransfer = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { customDispatch } = useCustomContext();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState("single");
  const [showPinPage, setShowPinPage] = useState(false);
  const [dataPath, setDataPath] = useState("");
  const [content, setContent] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_PIN_ATTEMPTS);
  const [serverErr, setServerErr] = useState("");

  const singleForm = useForm({
    resolver: yupResolver(singleTransferSchema),
    defaultValues: {
      provider: "",
      phoneNumber: "",
      confirmPhoneNumber: "",
      amount: searchParams.get("type") === "Bundle" ? "1" : "",
    },
  });

  const bulkForm = useForm({
    resolver: yupResolver(bulkTransferSchema),
    defaultValues: { content: [] },
  });

  const pinForm = useForm({
    resolver: yupResolver(pinSchema),
    defaultValues: { token: "" },
  });

  const { data, isLoading: isLoadingWalletStatus } = useQuery({
    queryKey: ["wallet-status"],
    queryFn: getWalletStatus,
    enabled: !!user?.id,
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

  const handleClearFields = () => {
    singleForm.reset();
    bulkForm.reset();
    pinForm.reset();
    setContent([]);
    setFilteredData([]);
    setDataPath("");
    setSearchQuery("");
    setAttemptsLeft(MAX_PIN_ATTEMPTS);
    setServerErr("");
    setShowPinPage(false);
    setTab("single");
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
          params.delete("airtime-prompt");
          return params;
        });
        handleClearFields();
      }
    });
  };

  const handleGoback = () => setShowPinPage(false);

  // Keeps `content`, the search-filtered view, and the RHF-validated
  // bulk form field all in sync from one place instead of three.
  const syncContent = (newContent) => {
    setContent(newContent);
    setFilteredData(applySearchFilter(newContent, searchQuery));
    bulkForm.setValue("content", newContent, {
      shouldValidate: bulkForm.formState.isSubmitted,
    });
  };

  // Load recipients from an Excel/CSV file
  function handleLoadFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    Swal.fire({
      title: "Loading Pins & Serials",
      text: "Please Wait!",
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    const reader = new FileReader();

    reader.onerror = () => {
      Swal.close();
      customDispatch(globalAlertType("error", "Couldn't read that file."));
    };

    reader.onload = (event) => {
      try {
        let details = [];
        if (file.type === XLSX_FILE_TYPE || file.type === XLS_FILE_TYPE) {
          details = readXLSX(event.target.result);
        } else if (file.type === CSV_FILE_TYPE) {
          details = readCSV(event.target.result);
        }

        setDataPath(file.name);
        setSearchQuery("");
        syncContent(details);
        Swal.close();
      } catch (error) {
        Swal.close();
        customDispatch(
          globalAlertType(
            "error",
            "Couldn't parse that file. Please check the format and try again.",
          ),
        );
      }
    };

    if (file.type === CSV_FILE_TYPE) {
      reader.readAsText(file, "utf-8");
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  const { mutateAsync, isPending } = useMutation({
    mutationFn: sendAirtime,
    retry: false,
  });

  const handleSubmitPayload = ({ token }) => {
    let payload;
    if (tab === "single") {
      const values = singleForm.getValues();
      payload = {
        recipient: getInternationalMobileFormat(values.phoneNumber),
        network: values.provider,
        amount: Number(values.amount).toFixed(2),
        token,
        type: "single",
      };
    } else {
      payload = { content: bulkForm.getValues("content"), token, type: "bulk" };
    }

  

    // return

    Swal.fire({
      title: "Processing Airtime",
      text: "Airtime sent cannot be reversed. Please check that all details are correct. Proceed with transaction?",
      showCancelButton: true,
    }).then(({ isConfirmed }) => {
      if (!isConfirmed) return;

      mutateAsync(payload, {
        onSettled: () => {
          pinForm.reset();
          queryClient.invalidateQueries({
            queryKey: ["agent-airtime-transactions"],
          });
          queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
        onSuccess: (result) => {
          setSearchParams((params) => {
            params.delete("data");
            params.delete("airtime-prompt");
            return params;
          });
          handleClearFields();
          Swal.fire({
            icon: "success",
            title: "Transaction Successful",
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
              params.delete("airtime-prompt");
              return params;
            });
            setShowPinPage(false);
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

  const handleDeleteFile = (recipient) => {
    syncContent(content.filter((item) => item?.recipient !== recipient));
  };

  const handleClearAll = () => {
    syncContent([]);
    setDataPath("");
  };

  const handleSearch = (event) => {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);
    setFilteredData(applySearchFilter(content, query));
  };

  const bulkTotal = _.sumBy(content, (item) => Number(item?.amount) || 0);

  return (
    <Dialog
      open={Boolean(searchParams.get("airtime-prompt"))}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <CustomDialogTitle
        title={showPinPage ? "Confirm Pin" : "New Transfer"}
        subtitle="Transfer airtime to all networks with ease"
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
                loading={isPending}
                onClick={pinForm.handleSubmit(handleSubmitPayload)}
                fullWidth
                sx={{ maxWidth: 220, textTransform: "none" }}
              >
                Make Transfer
              </LoadingButton>
            </Stack>
          )
        ) : (
          <TabContext value={tab}>
            <TabList
              centered
              onChange={(e, value) => setTab(value)}
              sx={{
                "& .MuiTab-root": { textTransform: "none", fontWeight: 500 },
              }}
            >
              <Tab value="single" label="Airtime" sx={{ width: "50%" }} />
              <Tab value="bulk" label="Bulk" sx={{ width: "50%" }} />
            </TabList>

            {/* Single transfer */}
            <TabPanel value="single" sx={{ px: 0 }}>
              <Stack spacing={2} sx={{ py: 2, maxWidth: 420, mx: "auto" }}>
                <Controller
                  name="provider"
                  control={singleForm.control}
                  render={({ field, fieldState }) => (
                    <ServiceProvider
                      label="Network Type"
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
                  control={singleForm.control}
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
                  control={singleForm.control}
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

                <Controller
                  name="amount"
                  control={singleForm.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      size="small"
                      type="number"
                      inputMode="numeric"
                      label="Top Up Amount"
                      fullWidth
                      required
                      focused
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">GH¢</InputAdornment>
                        ),
                        readOnly: searchParams.get("type") === "Bundle",
                        sx: { fontWeight: "bold" },
                      }}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />

                <LoadingButton
                  variant="contained"
                  onClick={singleForm.handleSubmit(() => setShowPinPage(true))}
                  fullWidth
                  size="small"
                  sx={{ mt: 1, textTransform: "none" }}
                >
                  Proceed
                </LoadingButton>
              </Stack>
            </TabPanel>

            {/* Bulk transfer */}
            <TabPanel value="bulk" sx={{ px: 0 }}>
              {bulkForm.formState.errors.content && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {bulkForm.formState.errors.content.message}
                </Alert>
              )}

              <Box sx={{ py: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  Load your transfer data from an Excel or CSV file. Columns
                  should be labeled:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    size="small"
                    label="RECIPIENT"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label="AMOUNT"
                    color="primary"
                    variant="outlined"
                  />
                  <Button
                    size="small"
                    onClick={downloadAirtimeTemplate}
                    sx={{ textTransform: "none", ml: "auto !important" }}
                  >
                    Download template
                  </Button>
                </Stack>

                <input
                  id="airtime-file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={handleLoadFile}
                  onClick={(e) => {
                    e.target.value = null;
                  }}
                />
                <label htmlFor="airtime-file-upload">
                  <Paper
                    variant="outlined"
                    component="span"
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.5,
                      py: 4,
                      px: 2,
                      width: "100%",
                      borderStyle: "dashed",
                      borderRadius: 3,
                      borderColor: alpha(theme.palette.divider, 0.8),
                      cursor: "pointer",
                      textAlign: "center",
                      "&:hover": {
                        borderColor: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                      },
                    }}
                  >
                    <CloudUploadRounded color="action" sx={{ fontSize: 36 }} />
                    <Typography variant="body2" fontWeight={600}>
                      Click to upload Excel or CSV file
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Accepted formats: .xlsx, .xls, .csv
                    </Typography>
                  </Paper>
                </label>

                {dataPath && (
                  <Chip
                    icon={<InsertDriveFileRounded />}
                    label={dataPath}
                    onDelete={handleClearAll}
                    sx={{ mt: 1.5 }}
                  />
                )}

                {content.length > 0 && (
                  <>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mt: 3, mb: 1.5 }}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>
                          Transfer List
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {content.length} recipient(s) •{" "}
                          {currencyFormatter(bulkTotal)} total
                        </Typography>
                      </Box>
                      <Button
                        onClick={handleClearAll}
                        variant="outlined"
                        color="error"
                        size="small"
                        sx={{ textTransform: "none" }}
                      >
                        Clear All
                      </Button>
                    </Stack>

                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      placeholder="Search…"
                      onChange={handleSearch}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRounded fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ mb: 2 }}
                    />

                    <TableContainer
                      component={Paper}
                      elevation={0}
                      sx={{
                        maxHeight: 400,
                        overflowY: "auto",
                        borderRadius: 3,
                        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                      }}
                    >
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Recipient</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredData.map((item, index) => {
                            const invalid = Number(item?.amount) < 1;
                            return (
                              <TableRow key={index}>
                                <TableCell>{item?.recipient}</TableCell>
                                <TableCell>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                  >
                                    <Typography
                                      variant="body2"
                                      color={
                                        invalid ? "error.main" : "text.primary"
                                      }
                                    >
                                      {currencyFormatter(item?.amount)}
                                    </Typography>
                                    {invalid && (
                                      <Chip
                                        label="Below minimum"
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: "0.65rem" }}
                                      />
                                    )}
                                  </Stack>
                                </TableCell>
                                <TableCell align="right">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleDeleteFile(item?.recipient)
                                    }
                                  >
                                    <DeleteRounded fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}

                <LoadingButton
                  variant="contained"
                  disabled={content.length === 0}
                  onClick={bulkForm.handleSubmit(() => setShowPinPage(true))}
                  fullWidth
                  size="small"
                  sx={{ mt: 3, textTransform: "none" }}
                >
                  Proceed
                </LoadingButton>
              </Box>
            </TabPanel>
          </TabContext>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewTransfer;

// import {
//   Dialog,
//   DialogContent,
//   TextField,
//   InputAdornment,
//   Tab,
//   Input,
//   Typography,
//   Stack,
//   Alert,
//   InputLabel,
//   Box,
//   CircularProgress,
//   Button,
//   IconButton,
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   Paper,
// } from "@mui/material";
// import { ArrowBack } from "@mui/icons-material";
// import {
//   Delete as DeleteIcon,
//   Search as SearchIcon,
// } from "@mui/icons-material";
// import { TabContext, TabList, TabPanel } from "@mui/lab";
// import Swal from "sweetalert2";
// import _ from "lodash";
// import LoadingButton from "@mui/lab/LoadingButton";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import CustomDialogTitle from "@/components/dialogs/CustomDialogTitle";
// import { useSearchParams } from "react-router-dom";
// import { useContext, useState } from "react";
// import {
//   getInternationalMobileFormat,
//   isValidPartner,
// } from "@/constants/PhoneCode";
// import ServiceProvider from "@/components/ServiceProvider";
// import {
//   getWalletStatus,
//   disableWallet,
//   sendAirtime,
//   downloadAirtimeTemplate,
// } from "@/api/agentAPI";
// import { CustomContext } from "@/context/providers/CustomProvider";
// import { globalAlertType } from "@/components/alert/alertType";
// import { readXLSX } from "@/config/readXLSX";
// import { readCSV } from "@/config/readCSV";
// import { currencyFormatter } from "@/constants";
// import { useEffect } from "react";
// import { AuthContext } from "@/context/providers/AuthProvider";
// import { verifyPin } from "@/config/validation";

// const CSV_FILE_TYPE = "text/csv";
// const XLSX_FILE_TYPE =
//   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// const XLS_FILE_TYPE = "application/vnd.ms-excel";
// const NewTransfer = () => {
//   const [dataPath, setDataPath] = useState("");
//   const [content, setContent] = useState([]);
//   const [filteredData, setFilteredData] = useState([]);
//   const [contentErr, setContentErr] = useState("");
//   const { user } = useContext(AuthContext);
//   const { customDispatch } = useContext(CustomContext);
//   const queryClient = useQueryClient();
//   const [tab, setTab] = useState(
//     "ab1bb991cea626082307742d77772268dbf4d9c5194b8bc5d09c81a5fc0a5ce5"
//   );
//   const [airtimeType, setAirtimeType] = useState("single");
//   const [showPinPage, setShowPinPage] = useState(false);
//   const [searchParams, setSearchParams] = useSearchParams();
//   const [phoneNumber, setPhoneNumber] = useState("");
//   const [confirmPhoneNumber, setConfirmPhoneNumber] = useState("");
//   const [provider, setProvider] = useState("");
//   const [providerErr, setProviderErr] = useState("");
//   const [phoneNumberErr, setPhoneNumberErr] = useState("");
//   const [confirmPhoneNumberErr, setConfirmPhoneNumberErr] = useState("");
//   const [amount, setAmount] = useState(1);
//   const [amountErr, setAmountErr] = useState("");
//   const [token, setToken] = useState("");
//   const [err, setErr] = useState("");
//   const [failureCount, setFailCount] = useState(3);
//   const [searchQuery, setSearchQuery] = useState("");

//   // Get wallet status and non-user information
//   const { data, isLoading: isLoadingWalletStatus } = useQuery({
//     queryKey: ["wallet-status"],
//     queryFn: getWalletStatus,
//     enabled: !!user?.id,
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

//   const handleClose = () => {
//     Swal.fire({
//       title: "Exiting",
//       text: `Cancel Transaction?`,
//       showCancelButton: true,
//     }).then(({ isConfirmed }) => {
//       if (isConfirmed) {
//         setSearchParams((params) => {
//           params.delete("data");
//           params.delete("airtime-prompt");
//           return params;
//         });

//         handleClearFields();
//       }
//     });
//   };

//   const handleGoback = () => setShowPinPage(false);

//   //LOAD Checkers from file excel,csv
//   function handleLoadFile(e) {
//     Swal.fire({
//       title: "Loading Pins & Serials",
//       text: "Please Wait!",
//       showConfirmButton: false,
//     });
//     // setIsLoading(true);
//     const files = e.target.files[0];

//     try {
//       const reader = new FileReader();
//       files.type === CSV_FILE_TYPE
//         ? reader.readAsText(files, "utf-8")
//         : reader.readAsArrayBuffer(files);

//       reader.onload = function (event) {
//         let details = [];

//         if (files.type === XLSX_FILE_TYPE || files.type === XLS_FILE_TYPE) {
//           details = readXLSX(event.target.result);
//         }

//         if (files.type === CSV_FILE_TYPE) {
//           details = readCSV(event.target.result);
//         }

//         // console.log({
//         //   meta: _.uniq(details?.flatMap(Object.keys)),
//         //   data: details,
//         // });

//         setDataPath(files.name);
//         setContent(details);
//         setFilteredData(details);
//       };

//       Swal.close();
//     } catch (error) {
//       customDispatch(globalAlertType("error", error));
//     }
//   }

//   const handleSubmit = () => {
//     setAirtimeType("single");
//     setProviderErr("");
//     setPhoneNumberErr("");
//     setConfirmPhoneNumberErr("");
//     setAmountErr("");
//     if (provider === "None") {
//       setProviderErr("Required*");
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

//     if (amount === "") {
//       setAmountErr("Required*");
//       return;
//     }
//     if (Number(amount) < 1) {
//       setAmountErr("Minimum amount you can transfer is GH₵1 ");
//       return;
//     }

//     setShowPinPage(true);
//   };

//   // Bulk Transfer
//   const handleSubmitBulkAirtime = () => {
//     setAirtimeType("bulk");
//     if (content?.length === 0) {
//       setContentErr("List Empty*");
//       return;
//     }

//     const isAmountLessThanOne = content.some(
//       (item) => Number(item?.amount) < 1
//     );

//     if (isAmountLessThanOne) {
//       setContentErr(
//         "Minimum amount of airtime you can transfer is GHS 1. Some of your fields have amount less than GHS 1!"
//       );
//       return;
//     }

//     setShowPinPage(true);
//   };

//   const { mutateAsync, isLoading } = useMutation({
//     mutationFn: sendAirtime,
//     retry:false,
//   });

//   const handleSubmitPayload = () => {
//     setErr("");
//     if (token.trim() === "") {
//       return setErr("Pin is required*");
//     }
//     if (token.trim().length !== 4 || !verifyPin(token?.trim())) {
//       return setErr("Please enter a valid pin!");
//     }

//     let payload;
//     if (airtimeType === "single") {
//       const internationalNumber = getInternationalMobileFormat(phoneNumber);

//       payload = {
//         recipient: internationalNumber,
//         network: provider,
//         amount: Number(amount).toFixed(2),
//         token,
//         type: "single",
//       };
//     } else {
//       payload = {
//         content,
//         token,
//         type: "bulk",
//       };
//     }

//     Swal.fire({
//       title: "Processing Airtime",
//       text: `Airtime sent cannot be reverse.Please check if all details are correct.Proceed with transaction?`,
//       showCancelButton: true,
//     }).then(({ isConfirmed }) => {
//       if (isConfirmed) {
//         mutateAsync(payload, {
//           onSettled: () => {
//             setToken("");
//             queryClient.invalidateQueries(["agent-airtime-transactions"]);
//             queryClient.invalidateQueries(["wallet-balance"]);
//             queryClient.invalidateQueries(["notifications"]);
//           },
//           onSuccess: (data) => {
//             handleClearFields();
//             setSearchParams((params) => {
//               params.delete("data");
//               params.delete("airtime-prompt");
//               return params;
//             });
//             setShowPinPage(false);

//             Swal.fire({
//               icon: "success",
//               title: "Transaction Successful",
//               text: data || "Transaction Completed!",
//               showCancelButton: false,
//             });
//             // customDispatch(
//             //   globalAlertType("info", data || "Transaction Completed!")
//             // );
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
//               setSearchParams((params) => {
//                 params.delete("data");
//                 params.delete("airtime-prompt");
//                 return params;
//               });
//               setShowPinPage(false);
//               handleClearFields();
//               //
//               Swal.fire({
//                 icon: "error",
//                 title: "Transfer Failed!",
//                 text: error || "An unknown error has occurred!",
//                 showCancelButton: false,
//               });

//               //
//             }
//           },
//         });
//       }
//     });
//   };

//   const handleClearFields = () => {
//     setPhoneNumber("");
//     setConfirmPhoneNumber("");
//     setProvider("");
//     setAmount("");
//     setToken("");
//     setFailCount(3);
//     setToken("");
//     setContent([]);
//     setShowPinPage(false);
//     setDataPath("");
//   };

//   // Delete a file from the list
//   const handleDeleteFile = (recipient) => {
//     const details = content.filter((item) => item?.recipient !== recipient);
//     setFilteredData(details);
//     setContent(details);
//   };

//   // Clear all uploaded data
//   const handleClearAll = () => {
//     setContent([]);
//   };

//   // Handle Search Functionality
//   const handleSearch = (event) => {
//     const query = event.target.value.toLowerCase();
//     setSearchQuery(query);

//     if (!query) {
//       setFilteredData(content);
//     } else {
//       const filteredResults = content.filter((row) =>
//         Object.values(row).some((value) =>
//           value.toString().toLowerCase().includes(query)
//         )
//       );
//       setFilteredData(filteredResults);
//     }
//   };

//   return (
//     <Dialog
//       open={Boolean(searchParams.get("airtime-prompt"))}
//       maxWidth='md'

//       fullWidth
//     >
//       <CustomDialogTitle
//         title={showPinPage ? "Confirm Pin" : "New Transfer"}
//         subtitle="Transfer airtime to all networks with ease"
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
//           <TabContext value={tab}>
//             <TabList centered onChange={(e, value) => setTab(value)}>
//               <Tab
//                 value="ab1bb991cea626082307742d77772268dbf4d9c5194b8bc5d09c81a5fc0a5ce5"
//                 label="Airtime"
//                 style={{ width: "50%" }}
//               />
//               <Tab
//                 value="bc458dd2cf0e7223a51319f98cc8e2c8ea27d6dc66e048cd1b4434f6aae90fc2a"
//                 label="Bulk"
//                 style={{ width: "50%" }}
//               />
//             </TabList>

//             <TabPanel
//               value="ab1bb991cea626082307742d77772268dbf4d9c5194b8bc5d09c81a5fc0a5ce5"
//               sx={{ px: 0 }}
//             >
//               <Box
//                 sx={{
//                   py: 2,
//                   display: "flex",
//                   flexDirection: "column",
//                   alignItems: "center",
//                   justifyContent: "center",
//                   gap: 1,
//                   // boxShadow: "20px 20px 60px #d9d9d9,-20px -20px 60px #ffffff",
//                   // borderRadius: 2,
//                 }}
//               >
//                 <ServiceProvider
//                   label="Network Type"
//                   size="small"
//                   value={provider}
//                   setValue={setProvider}
//                   error={providerErr !== ""}
//                   helperText={providerErr}
//                 />
//                 <TextField
//                   size="small"
//                   type="tel"
//                   inputMode="tel"
//                   variant="outlined"
//                   label="Recipient Number"
//                   fullWidth
//                   required
//                   value={phoneNumber}
//                   onChange={(e) => setPhoneNumber(e.target.value)}
//                   error={phoneNumberErr ? true : false}
//                   helperText={phoneNumberErr}
//                   margin="dense"
//                 />

//                 <TextField
//                   size="small"
//                   type="tel"
//                   inputMode="tel"
//                   variant="outlined"
//                   label="Confirm Recipient Number"
//                   fullWidth
//                   required
//                   value={confirmPhoneNumber}
//                   onChange={(e) => setConfirmPhoneNumber(e.target.value)}
//                   error={confirmPhoneNumberErr ? true : false}
//                   helperText={confirmPhoneNumberErr}
//                   margin="dense"
//                 />

//                 <TextField
//                   size="small"
//                   type="number"
//                   inputMode="numeric"
//                   placeholder="Amount"
//                   label="Top Up Amount"
//                   fullWidth
//                   required
//                   InputProps={{
//                     startAdornment: (
//                       <InputAdornment position="start">GH¢</InputAdornment>
//                     ),
//                     endAdornment: (
//                       <InputAdornment position="end">p</InputAdornment>
//                     ),
//                     readOnly: searchParams.get("type") === "Bundle",
//                     style: { fontWeight: "bold" },
//                   }}
//                   value={amount}
//                   focused
//                   onChange={(e) => setAmount(e.target.value)}
//                   error={Boolean(amountErr)}
//                   helperText={amountErr}
//                 />

//                 <LoadingButton
//                   type="submit"
//                   variant="contained"
//                   loading={isLoading}
//                   onClick={handleSubmit}
//                   fullWidth
//                   size="small"
//                   sx={{ mt: 2 }}
//                 >
//                   Proceed
//                 </LoadingButton>
//               </Box>
//             </TabPanel>
//             <TabPanel
//               value="bc458dd2cf0e7223a51319f98cc8e2c8ea27d6dc66e048cd1b4434f6aae90fc2a"
//               sx={{ px: 0 }}
//             >
//               {contentErr && <Alert severity="error">{contentErr}</Alert>}
//               <Box
//                 sx={{
//                   py: 2,
//                 }}
//               >
//                 <Typography>
//                   Load your transfer data from an excel or csv file. Columns
//                   should be labeled as follows:
//                   <br />
//                   <br />
//                   <div style={{ display: "flex", gap: "16px" }}>
//                     <b style={{ color: "var(--primary)" }}>1. RECIPIENT</b>
//                     <b style={{ color: "var(--primary)" }}>2. AMOUNT</b>
//                   </div>
//                 </Typography>
//                 <Stack spacing={1} pb={2} width="100%">
//                   <Input
//                     accept=".xlsx,.xls,.csv"
//                     type="file"
//                     id="pins"
//                     name="pins"
//                     onChange={handleLoadFile}
//                     onClick={(e) => {
//                       e.target.value = null;
//                       e.currentTarget.value = null;
//                     }}
//                     sx={{
//                       visibility: "collapse",
//                     }}
//                   />

//                   <Stack direction="row" spacing={3} py={1}>
//                     <InputLabel sx={{ alignSelf: "flex-start" }}>
//                       Add EXCEL or CSV file
//                     </InputLabel>
//                     <a
//                       style={{
//                         cursor: "pointer",
//                         textDecoration: "underline",
//                       }}
//                       onClick={downloadAirtimeTemplate}
//                     >
//                       Download here
//                     </a>
//                   </Stack>
//                   <Input
//                     accept=".xlsx,.xls,.csv"
//                     type="file"
//                     fullWidth
//                     onChange={handleLoadFile}
//                     onClick={(e) => {
//                       e.target.value = null;
//                       e.currentTarget.value = null;
//                     }}
//                   />
//                   <small>e.g. *.csv,*.xlsx</small>

//                   <TextField
//                     label="File Name"
//                     id="browse"
//                     placeholder="Load Data Here"
//                     size="small"
//                     value={dataPath}
//                     fullWidth
//                   />
//                 </Stack>

//                 {content.length > 0 && (
//                   <>
//                     <Typography variant="h4">Transfer List</Typography>
//                     <Stack
//                       direction="row"
//                       justifyContent="space-between"
//                       alignItems="center"
//                       py={2}
//                     >
//                       <Typography variant="h4">
//                         {currencyFormatter(_.sumBy(content, "amount") || 0)}
//                       </Typography>
//                       <Button
//                         onClick={handleClearAll}
//                         variant="contained"
//                         color="secondary"
//                         style={{ marginTop: 10 }}
//                       >
//                         Clear All
//                       </Button>
//                     </Stack>
//                     <TextField
//                       fullWidth
//                       variant="outlined"
//                       placeholder="Search..."
//                       onChange={handleSearch}
//                       InputProps={{ startAdornment: <SearchIcon /> }}
//                       sx={{ my: 2 }}
//                     />

//                     <TableContainer
//                       component={Paper}
//                       sx={{ maxHeight: 500, overflowY: "auto" }}
//                     >
//                       <Table stickyHeader>
//                         <TableHead>
//                           <TableRow>
//                             <TableCell>Recipient</TableCell>
//                             <TableCell>Amount</TableCell>
//                             <TableCell>Actions</TableCell>
//                           </TableRow>
//                         </TableHead>
//                         <TableBody>
//                           {filteredData.map((item, index) => (
//                             <TableRow key={index}>
//                               <TableCell>{item?.recipient}</TableCell>
//                               <TableCell
//                                 sx={{
//                                   color:
//                                     Number(item?.amount) < 1
//                                       ? "error"
//                                       : "info.main",
//                                 }}
//                               >
//                                 {currencyFormatter(item?.amount)}
//                               </TableCell>
//                               <TableCell>
//                                 <IconButton
//                                   onClick={() =>
//                                     handleDeleteFile(item?.recipient)
//                                   }
//                                 >
//                                   <DeleteIcon />
//                                 </IconButton>
//                               </TableCell>
//                             </TableRow>
//                           ))}
//                         </TableBody>
//                       </Table>
//                     </TableContainer>
//                   </>
//                 )}

//                 <LoadingButton
//                   type="submit"
//                   variant="contained"
//                   disabled={content?.length === 0}
//                   onClick={handleSubmitBulkAirtime}
//                   fullWidth
//                   size="small"
//                 >
//                   Proceed
//                 </LoadingButton>
//               </Box>
//             </TabPanel>
//           </TabContext>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// };

// export default NewTransfer;
