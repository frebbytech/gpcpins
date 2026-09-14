import {
  Alert,
  MenuItem,
  Stack,
  TextField,
  Paper,
  Typography,
  Divider,
  Grid,
  Chip,
  Skeleton,
  useTheme,
  alpha,
  Collapse,
  IconButton,
  Tooltip,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import CustomizedMaterialTable from "../../components/tables/CustomizedMaterialTable";
import { transactionsColumns } from "../../mocks/columns";
import ActionMenu from "../../components/menu/ActionMenu";
import _ from "lodash";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getTransactionReport,
  getTransactions,
} from "../../api/transactionAPI";
import { useMemo, useState } from "react";
import { resendVoucherORReceipt } from "../../api/paymentAPI";
import { globalAlertType } from "../../components/alert/alertType";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { currencyFormatter } from "../../constants";
import moment from "moment";
import { useSearchParams } from "react-router-dom";
import CustomTotal from "../../components/custom/CustomTotal";
import {
  NoteRounded,
  FilterListRounded,
  CloseRounded,
  ReplayRounded,
  ErrorOutlineRounded,
  CheckCircleRounded,
  PendingRounded,
  CancelRounded,
  AssignmentReturnRounded,
} from "@mui/icons-material";
import CustomTitle from "../../components/custom/CustomTitle";
import LoadingSpinner from "../../components/spinners/LoadingSpinner";
import DateRangePicker from "@/components/pickers/DateRangePicker";
import TransactionPreviewDialog from "@/components/dialogs/TransactionPreviewDialog";
import Swal from "sweetalert2";
import TransactionStatus from "@/components/modals/TransactionStatus";

const HISTORY_START = moment("2024-01-01").toDate();
const TODAY = moment().toDate();

/* ------------------------------------------------------------------ *
 * Period presets. Each preset computes a concrete date range so the
 * range picker always reflects the active period — selecting "This
 * Month" fills in the calendar rather than hiding it. Picking a date
 * manually in the calendar simply falls through to "custom".
 * ------------------------------------------------------------------ */
const PERIOD_PRESETS = [
  {
    value: "all",
    label: "All time",
    getRange: () => ({ startDate: HISTORY_START, endDate: TODAY }),
  },
  {
    value: "today",
    label: "Today",
    getRange: () => ({
      startDate: moment().startOf("day").toDate(),
      endDate: moment().endOf("day").toDate(),
    }),
  },
  {
    value: "yesterday",
    label: "Yesterday",
    getRange: () => ({
      startDate: moment().subtract(1, "day").startOf("day").toDate(),
      endDate: moment().subtract(1, "day").endOf("day").toDate(),
    }),
  },
  {
    value: "week",
    label: "Last 7 days",
    getRange: () => ({
      startDate: moment().subtract(6, "days").startOf("day").toDate(),
      endDate: moment().endOf("day").toDate(),
    }),
  },
  {
    value: "month",
    label: "This month",
    getRange: () => ({
      startDate: moment().startOf("month").toDate(),
      endDate: moment().endOf("day").toDate(),
    }),
  },
  {
    value: "lmonth",
    label: "Last month",
    getRange: () => ({
      startDate: moment().subtract(1, "month").startOf("month").toDate(),
      endDate: moment().subtract(1, "month").endOf("month").toDate(),
    }),
  },
  {
    value: "year",
    label: "This year",
    getRange: () => ({
      startDate: moment().startOf("year").toDate(),
      endDate: moment().endOf("day").toDate(),
    }),
  },
  {
    value: "lyear",
    label: "Last year",
    getRange: () => ({
      startDate: moment().subtract(1, "year").startOf("year").toDate(),
      endDate: moment().subtract(1, "year").endOf("year").toDate(),
    }),
  },
  { value: "custom", label: "Custom range", getRange: null },
];

const TYPE_OPTIONS = [
  { value: "All", label: "All types" },
  { value: "voucher", label: "Vouchers" },
  { value: "ticket", label: "Tickets" },
  { value: "prepaid", label: "Prepaid Units" },
  { value: "airtime", label: "Airtime Transfer" },
  { value: "bundle", label: "Data Bundle" },
];

const STATUS_OPTIONS = [
  { value: "All", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

// Drives both the status filter dropdown and the summary cards, so
// the two stay visually and semantically in sync.
const STATUS_CARD_CONFIG = [
  {
    value: "completed",
    label: "Completed",
    color: "success",
    Icon: CheckCircleRounded,
  },
  {
    value: "pending",
    label: "Pending",
    color: "warning",
    Icon: PendingRounded,
  },
  { value: "failed", label: "Failed", color: "error", Icon: CancelRounded },
  {
    value: "refunded",
    label: "Refunded",
    color: "info",
    Icon: AssignmentReturnRounded,
  },
];

function Transactions() {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const { customDispatch } = useCustomContext();

  const [filterOpen, setFilterOpen] = useState(true);
  const [period, setPeriod] = useState("all");
  const [date, setDate] = useState([
    { startDate: HISTORY_START, endDate: TODAY, key: "selection" },
  ]);
  const [type, setType] = useState("All");
  const [airtimeType, setAirtimeType] = useState("single");
  const [status, setStatus] = useState("All");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Selecting a preset fills in the calendar to match, so the two
  // controls always agree instead of fighting for visibility.
  const handlePeriodChange = (value) => {
    setPeriod(value);
    const preset = PERIOD_PRESETS.find((p) => p.value === value);
    if (preset?.getRange) {
      const range = preset.getRange();
      setDate([{ ...range, key: "selection" }]);
    }
  };

  // Manually adjusting the calendar always wins — it demotes the
  // preset dropdown to "Custom range" rather than being overridden.
  const handleDateChange = (newDate) => {
    setDate(newDate);
    setPeriod("custom");
  };

  const handleResetFilters = () => {
    setPeriod("all");
    setDate([{ startDate: HISTORY_START, endDate: TODAY, key: "selection" }]);
    setType("All");
    setAirtimeType("single");
    setStatus("All");
  };

  // Toggling a summary card filters the table to that status — click
  // it again (or the reset button) to clear it.
  const handleStatusCardClick = (value) => {
    setStatus((current) => (current === value ? "All" : value));
  };

  // Fetch transactions
  const transactions = useQuery({
    queryKey: ["products-transactions", period, date[0]],
    queryFn: () => getTransactions({ date: date[0], sort: period }),
    initialData: [],
  });

  // Filter by type first — the status summary cards reflect this
  // level of filtering, so they stay accurate to "period + type" even
  // before a status is chosen.
  const typeFilteredTransactions = useMemo(() => {
    let modified = transactions.data;

    if (type !== "All") {
      if (type === "airtime") {
        modified = modified?.filter(
          (item) => item.service === type && item.kind === airtimeType,
        );
      } else {
        modified = modified?.filter((item) => item.service === type);
      }
    }

    return modified || [];
  }, [transactions.data, type, airtimeType]);

  const sortedTransactions = useMemo(() => {
    if (status === "All") return typeFilteredTransactions;
    return typeFilteredTransactions.filter((item) => item.status === status);
  }, [typeFilteredTransactions, status]);

  // Count + total per status, for the summary cards.
  const statusSummary = useMemo(() => {
    const summary = {};
    STATUS_CARD_CONFIG.forEach(({ value }) => {
      summary[value] = { count: 0, total: 0 };
    });
    typeFilteredTransactions.forEach((item) => {
      if (summary[item.status]) {
        summary[item.status].count += 1;
        summary[item.status].total += Number(item?.amount) || 0;
      }
    });
    return summary;
  }, [typeFilteredTransactions]);

  const hasActiveFilters =
    period !== "all" ||
    type !== "All" ||
    airtimeType !== "single" ||
    status !== "All";

  // Actions
  const handleDownload = async (id, downloadLink) => {
    if (!downloadLink) return;
    const link = document.createElement("a");
    link.href = downloadLink;
    link.target = "_blank";
    link.download = `${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const {
    mutateAsync: resendMutate,
    isLoading: resendLoading,
    isError: resendError,
    reset: resetResend,
  } = useMutation({
    mutationFn: resendVoucherORReceipt,
    onSuccess: () => customDispatch(globalAlertType("success", "Done!")),
    onError: () =>
      customDispatch(globalAlertType("error", "An error has occurred!")),
  });

  const handleResend = (data) => {
    Swal.fire({
      title: `Resend ${data?.service}?`,
      text: `Are you sure you want to resend the ${data?.service} to ${data.phonenumber || "the customer"}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, resend it",
      cancelButtonText: "Cancel",
      confirmButtonColor: theme.palette.primary.main,
      cancelButtonColor: theme.palette.grey[500],
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        resendMutate(data);
      }
    });
  };

  const handleCheckStatus = (refId, service) => {
    setSearchParams((params) => {
      params.set("payment_reference", refId);
      params.set("type", service);
      params.set("open", true);
      return params;
    });
  };

  // Report generation
  const reportMutate = useMutation({
    mutationFn: getTransactionReport,
    onSuccess: () => customDispatch(globalAlertType("success", "Done!")),
    onError: () =>
      customDispatch(globalAlertType("error", "An error has occurred!")),
  });

  const handleGenerateReport = () => {
    reportMutate.mutateAsync({
      ...date[0],
      type,
      transactions: { transactions: sortedTransactions },
    });
  };

  const handleViewTransaction = (transaction) => {
    setSelectedTransaction(transaction);
    setPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setSelectedTransaction(null);
  };

  const totalAmount = useMemo(
    () => _.sumBy(sortedTransactions, (item) => Number(item?.amount)),
    [sortedTransactions],
  );

  const hasStatusAlerts =
    resendLoading ||
    resendError ||
    reportMutate.isLoading ||
    reportMutate.isError ||
    reportMutate.isSuccess;

  // Table columns with actions
  const modifiedColumns = [
    ...transactionsColumns(type),
    {
      field: "",
      title: "Action",
      export: false,
      render: (data) => (
        <ActionMenu>
          <MenuItem
            sx={{ fontSize: 13 }}
            onClick={() => handleViewTransaction(data)}
          >
            View
          </MenuItem>
          {data?.mode === "Mobile Money" && (
            <MenuItem
              sx={{ fontSize: 13 }}
              onClick={() => {
            
                handleCheckStatus(
                  data?.service === "prepaid" ? `prepaid-${data?.id}` : data?.reference,
                  data?.service,
                );
              }}
            >
              Check Status
            </MenuItem>
          )}
          {["voucher", "ticket"].includes(data?.service) &&
            data?.status === "completed" && (
              <>
                <MenuItem
                  sx={{ fontSize: 13 }}
                  onClick={() =>
                    handleResend({
                      id: data.id,
                      service: data?.service,
                      phonenumber: data?.phonenumber,
                    })
                  }
                >
                  Resend
                </MenuItem>
                <MenuItem
                  sx={{ fontSize: 13 }}
                  onClick={() => handleDownload(data.id, data.downloadLink)}
                >
                  Download
                </MenuItem>
              </>
            )}
        </ActionMenu>
      ),
    },
  ];

  return (
    <>
      <CustomTitle
        title="Transactions"
        subtitle="Review and view recent and past transactions and manage your financial records."
      />

      {/* Status alerts — each dismissible, none block the rest of the page */}
      <Stack spacing={1} sx={{ mb: hasStatusAlerts ? 2 : 0 }}>
        {resendLoading && (
          <Alert severity="info">Resending receipt to customer…</Alert>
        )}
        {resendError && (
          <Alert severity="error" onClose={resetResend}>
            Couldn&apos;t resend that receipt. Please try again.
          </Alert>
        )}
        {reportMutate.isLoading && (
          <Alert severity="info">
            Generating report. This can take a moment…
          </Alert>
        )}
        {reportMutate.isError && (
          <Alert severity="error" onClose={reportMutate.reset}>
            Report generation failed. Please try again.
          </Alert>
        )}
        {reportMutate.isSuccess && reportMutate.data && (
          <Alert severity="success" onClose={reportMutate.reset}>
            {reportMutate.data === "No data found" ? (
              "No transactions matched this report — adjust your filters and try again."
            ) : (
              <>
                Your report is ready.{" "}
                <a href={reportMutate.data} target="_blank" rel="noreferrer">
                  Open it here
                </a>
                , or check your email for a copy.
              </>
            )}
          </Alert>
        )}
      </Stack>

      {/* Summary card */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 1.2,
          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "center" },
          gap: 2,
        }}
      >
        {transactions.isLoading ? (
          <Stack spacing={0.5}>
            <Skeleton variant="text" width={140} height={20} />
            <Skeleton variant="text" width={180} height={36} />
          </Stack>
        ) : (
          <CustomTotal
            title="Total Transactions"
            total={currencyFormatter(totalAmount)}
          />
        )}
        <Stack direction="row" spacing={2} alignItems="center">
          <LoadingButton
            variant="contained"
            endIcon={<NoteRounded />}
            onClick={handleGenerateReport}
            loading={reportMutate.isLoading}
            disabled={
              reportMutate.isLoading ||
              transactions.isLoading ||
              sortedTransactions.length === 0
            }
            sx={{ borderRadius: 1.2, textTransform: "none" }}
          >
            Generate Report
          </LoadingButton>
        </Stack>
      </Paper>

      {/* Status summary cards — click one to filter the table by that status */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STATUS_CARD_CONFIG.map(({ value, label, color, Icon }) => {
          const isActive = status === value;
          const { count, total } = statusSummary[value] || {
            count: 0,
            total: 0,
          };

          return (
            <Grid item xs={12} sm={6} md={3} key={value}>
              <Paper
                elevation={0}
                onClick={() =>
                  !transactions.isLoading && handleStatusCardClick(value)
                }
                sx={{
                  p: 2,
                  borderRadius: 1.2,
                  cursor: transactions.isLoading ? "default" : "pointer",
                  border: `1px solid ${
                    isActive
                      ? theme.palette[color].main
                      : alpha(theme.palette.divider, 0.3)
                  }`,
                  bgcolor: isActive
                    ? alpha(theme.palette[color].main, 0.06)
                    : "#fff",
                  transition: theme.transitions.create([
                    "border-color",
                    "background-color",
                  ]),
                  "&:hover": transactions.isLoading
                    ? undefined
                    : { borderColor: theme.palette[color].main },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Icon
                    sx={{ color: theme.palette[color].main, fontSize: 28 }}
                  />
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    {transactions.isLoading ? (
                      <>
                        <Skeleton variant="text" width={40} height={28} />
                        <Skeleton variant="text" width={80} height={18} />
                      </>
                    ) : (
                      <>
                        <Typography
                          variant="h6"
                          fontWeight="700"
                          lineHeight={1.2}
                        >
                          {count}
                        </Typography>
                        <Typography variant="body1" noWrap>
                          {currencyFormatter(total)}
                        </Typography>
                      </>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Filter bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 1.2,
          border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" fontWeight="600">
              Filters
            </Typography>
            {hasActiveFilters && (
              <Chip
                size="small"
                label="Active"
                color="primary"
                variant="outlined"
                sx={{ height: 22 }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {hasActiveFilters && (
              <Tooltip title="Reset filters">
                <IconButton size="small" onClick={handleResetFilters}>
                  <ReplayRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={() => setFilterOpen(!filterOpen)}>
              {filterOpen ? (
                <CloseRounded fontSize="small" />
              ) : (
                <FilterListRounded fontSize="small" />
              )}
            </IconButton>
          </Stack>
        </Stack>

        <Collapse in={filterOpen}>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm="auto">
              <TextField
                select
                label="Period"
                size="small"
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                sx={{ minWidth: 170, width: "100%" }}
              >
                {PERIOD_PRESETS.filter((p) => p.getRange).map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
                {/* Only shown once the calendar has been edited manually */}
                {period === "custom" && (
                  <MenuItem value="custom">Custom range</MenuItem>
                )}
              </TextField>
            </Grid>

            <Grid item xs={12} sm="auto">
              <DateRangePicker
                date={date}
                setDate={handleDateChange}
                onReset={transactions.refetch}
                placeholder="Pick a date range"
                dateFormat="ll"
                maxDate={new Date()}
                minDate={new Date("2024-01-01")}
              />
            </Grid>

            <Grid item xs={12} sm="auto">
              <TextField
                select
                label="Type"
                size="small"
                value={type}
                onChange={(e) => setType(e.target.value)}
                sx={{ minWidth: 160, width: "100%" }}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {type === "airtime" && (
              <Grid item xs={12} sm="auto">
                <TextField
                  select
                  label="Airtime Type"
                  size="small"
                  value={airtimeType}
                  onChange={(e) => setAirtimeType(e.target.value)}
                  sx={{ minWidth: 160, width: "100%" }}
                >
                  <MenuItem value="single">Single</MenuItem>
                  <MenuItem value="bulk">Bulk</MenuItem>
                </TextField>
              </Grid>
            )}

            <Grid item xs={12} sm="auto">
              <TextField
                select
                label="Status"
                size="small"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                sx={{ minWidth: 160, width: "100%" }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      {/* Transactions table / error state */}
      {transactions.isError ? (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 1.2,
            border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
            bgcolor: alpha(theme.palette.error.main, 0.04),
            textAlign: "center",
          }}
        >
          <ErrorOutlineRounded color="error" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            Couldn&apos;t load transactions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {transactions.error?.message ||
              "Something went wrong while fetching your transactions."}
          </Typography>
          <LoadingButton
            variant="outlined"
            color="error"
            startIcon={<ReplayRounded />}
            onClick={transactions.refetch}
            sx={{ borderRadius: 1.2, textTransform: "none" }}
          >
            Try again
          </LoadingButton>
        </Paper>
      ) : (
        <CustomizedMaterialTable
          title=""
          search
          isLoading={transactions.isLoading}
          columns={modifiedColumns}
          data={sortedTransactions}
          showExportButton
          onRefresh={transactions.refetch}
          autocompleteComponent={null}
          emptyMessage={
            hasActiveFilters
              ? "No transactions match these filters — try widening your search."
              : "No transactions found"
          }
          options={{
            pageSize: 10,
            pageSizeOptions: [5, 10, 25, 50],
          }}
        />
      )}

      {resendLoading && <LoadingSpinner value="Resending. Please wait…" />}

      <TransactionPreviewDialog
        open={previewOpen}
        onClose={handlePreviewClose}
        transaction={selectedTransaction}
        onResend={handleResend}
        onDownload={handleDownload}
        onCheckStatus={handleCheckStatus}
      />
      <TransactionStatus />
    </>
  );
}

export default Transactions;
