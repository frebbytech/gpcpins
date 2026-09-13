/* eslint-disable react-refresh/only-export-components */
import _ from "lodash";
import {
  Button,
  Chip,
  ListItemText,
  Stack,
  Typography,
  LinearProgress,
} from "@mui/material";
import { currencyFormatter, IMAGES } from "../constants";
import moment from "moment";
import { format } from "date-fns";

export const BROADCAST_MESSAGES_COLUMNS = [
  {
    headerName: "ID",
    field: "id",
    hidden: true,
  },
  {
    field: "createdAt",
    headerName: "Date of Issue",
    renderCell: (rowData) => {
      const date = new Date(rowData?.createdAt).toDateString();
      const time = new Date(rowData?.createdAt).toLocaleTimeString();
      return (
        <ListItemText
          primary={date}
          primaryTypographyProps={{
            fontSize: 13,
            color: "primary.main",
          }}
          secondary={time}
          secondaryTypographyProps={{
            fontSize: 11,
          }}
        />
      );
    },
  },
  {
    headerName: "Recipient",
    field: "recipient",
  },

  {
    field: "type",
    headerName: "Type",
    export: true,
    renderCell: ({ type }) => (
      <Chip
        label={type === "Email" ? "Email" : "SMS"}
        color={type === "Email" ? "primary" : "secondary"}
        size="small"
      />
    ),
  },

  {
    headerName: "Message",
    field: "body",
    renderCell: (rowData) => {
      return (
        <ListItemText
          primary={rowData?.title}
          primaryTypographyProps={{
            fontSize: 13,
            color: "primary.main",
            fontWeight: "700",
          }}
          secondary={rowData?.body}
          secondaryTypographyProps={{
            fontSize: 12,
            width: "50ch",
          }}
        />
      );
    },
  },
];

export const recentTransactionColumns = [
  {
    headerName: "ID",
    field: "id",
    hidden: true,
  },
  {
    headerName: "Date",
    field: "date",
    renderCell: (rowData) => (<DateRenderer date={rowData.createdAt}/>),
  },
  {
    headerName: "Personal Info",
    field: "quantity",
    renderCell: (rowData) => (
      <ListItemText
        primary={rowData?.email}
        secondary={rowData?.phonenumber}
        primaryTypographyProps={{
          fontSize: 12,
          color: "info.main",
        }}
        secondaryTypographyProps={{
          fontSize: 12,
          color: "primary.main",
        }}
      />
    ),
  },
  {
    headerName: "Type",
    field: "domain",
  },
  {
    headerName: "Amount",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  },
];

export const topCustomersColumns = [
  {
    headerName: "Telephone Number",
    field: "phonenumber",
  },
  {
    headerName: "Amount",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  },
];

export const topSoldColumns = [
  {
    headerName: "Type",
    field: null,
    renderCell: ({ type, count }) => {
      return (
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={2}
            justifyContent="space-between"
            alignItems="center"
          >
            <span>{type}</span>
            <span style={{ fontWeight: "bold", color: "var(--secondary)" }}>
              {count}
            </span>
          </Stack>
          <LinearProgress variant="determinate" value={count} />
        </Stack>
      );
    },
  },
];

export const transactionsColumns = (type) => [
  {
    headerName: "Date",
    field: "createdAt",
    renderCell: ({ createdAt }) => moment(createdAt).format("LLL"),
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = moment(rowData.createdAt).format("LLL");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    headerName: "Status",
    field: "status",
    renderCell: ({ domain, status, isProcessed }) =>
      domain === "Airtime" ? (
        <Button
          size="small"
          label={
            status === "completed" && Boolean(isProcessed)
              ? "Completed"
              : "Pending"
          }
          sx={{
            color:
              status === "completed" && Boolean(isProcessed)
                ? "success.darker"
                : "warning.darker",
            bgcolor:
              status === "completed" && Boolean(isProcessed)
                ? "success.light"
                : "warning.light",
          }}
        >
          {status === "completed" && Boolean(isProcessed)
            ? "Completed"
            : "Pending"}
        </Button>
      ) : (
        <Button
          size="small"
          label={status === "pending" ? "Pending" : "Completed"}
          sx={{
            color: status === "pending" ? "warning.darker" : "success.darker",
            bgcolor:
              status === "pending" ? "warning.lighter" : "success.lighter",
          }}
        >
          {status === "pending" ? "Pending" : "Completed"}
        </Button>
      ),
  },
  {
    headerName: "Id",
    field: "id",
    // hidden: true,
    width: 100,
  },
  {
    headerName: "Payment Reference ID",
    field: "reference",
    width: 100,
    cellStyle: {
      width: 100,
    },
  },
  ["All", "Airtime"].includes(type) && {
    headerName: "Kind",
    field: "kind",
  },
  {
    headerName: "Domain",
    field: "domain",
  },
  {
    headerName: "Link",
    field: "downloadLink",
    hidden: true,
  },
  {
    headerName: type || "Recipient",
    field: "voucherType",
    renderCell: (row) =>
      row?.domain === "Airtime" ? (
        row?.recipient?.length > 20 ? (
          <Stack>
            {JSON.parse(row?.recipient).map((item) => (
              <small key={item?.recipient}>
                {item?.recipient}{" "}
                <b style={{ color: "var(--secondary)" }}>
                  ({currencyFormatter(item?.price)})
                </b>
              </small>
            ))}
          </Stack>
        ) : (
          row?.recipient
        )
      ) : (
        row?.voucherType || row?.meter
      ),
  },

  {
    headerName: "Type",
    field: "type",
  },

  {
    headerName: "Email",
    field: "email",
    hidden: true,
  },
  {
    headerName: "Telephone Number",
    field: "phonenumber",
    hidden: true,
  },

  {
    headerName: "Contact Info.",
    field: null,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    renderCell: ({ email, phonenumber }) => {
      return (
        <Stack>
          <Typography variant="body2" color="info.main">
            {email}
          </Typography>
          <Typography variant="body2">{phonenumber}</Typography>
        </Stack>
      );
    },
  },

  {
    headerName: "Amount",
    field: "amount",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  },
];

export const airtimeTransactionsColumns = [
  {
    headerName: "Date",
    field: "createdAt",
    renderCell: ({ createdAt }) => <DateRenderer date={createdAt} />,
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = moment(rowData.createdAt).format("LLL");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    headerName: "Status",
    field: "status",
    renderCell: ({ status }) => <StatusChip status={status} />,
  },
  {
    headerName: "Id",
    field: "id",
    // hidden: true,
  },

  {
    headerName: "Recipient",
    field: "recipient",
  },
  {
    headerName: "Provider",
    field: "provider",
  },
  {
    headerName: "Type",
    field: "type",
  },
  {
    headerName: "Details",
    field: "info.plan_name",
    export: true,
    renderCell: ({ info }) => {
      return `
      ${info?.type || "N/A"}
      ${info?.plan_name || ""}
      ${info?.volume || ""}

      `;
    },
  },
  {
    headerName: "Total Amount",
    field: "amount",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  },
  // {
  //   headerName: "Payment Reference",
  //   field: "reference",
  //   hidden: true,
  // },
  // {
  //   headerName: "Commission",
  //   field: "commission",
  //   type: "currency",
  //   align: "center",
  //   cellStyle: {
  //     textAlign: "center",
  //   },
  //   currencySetting: {
  //     currencyCode: "GHS",
  //     minimumFractionDigits: 3,
  //     maximumFractionDigits: 3,
  //   },
  // },
  // {
  //   headerName: "Payable Amount",
  //   field: "amt",
  //   type: "currency",
  //   align: "center",
  //   cellStyle: {
  //     textAlign: "center",
  //   },
  //   currencySetting: {
  //     currencyCode: "GHS",
  //     minimumFractionDigits: 3,
  //     maximumFractionDigits: 3,
  //   },
  // },
];

export const MOBILE_PROVIDER = [
  {
    id: "612db3be-2210-41fc-91d1-06573271df49",
    image: IMAGES.mtn_money,
    label: "MTN Money",
    value: "mtn-gh",
  },

  {
    id: "7827eb37-6b8c-40da-9503-8f3fc75a0daf",
    label: "Vodafone Cash",
    value: "vodafone-gh",
    image: IMAGES.vodafone_cash,
  },
  {
    id: "915f26e2-e329-4f8c-9378-92cd90b0b4a2",
    label: "AirtelTigo Money",
    value: "tigo-gh",
    image: IMAGES.airtel_money,
  },
];

export const SERVICE_PROVIDER = [
  {
    id: "612db3be-2210-41fc-91d1-06573271df49",
    image: IMAGES.mtn,
    label: "MTN",
    value: "MTN",
    code: "4",
  },

  {
    id: "7827eb37-6b8c-40da-9503-8f3fc75a0daf",
    label: "Vodafone",
    value: "Vodafone",
    image: IMAGES.vodafone,
    code: "6",
  },
  {
    id: "915f26e2-e329-4f8c-9378-92cd90b0b4a2",
    label: "AirtelTigo",
    value: "AirtelTigo",
    image: IMAGES.airtel,
    code: "1",
  },
];

export const WALLET_TOPUP_TRANSACTIONS = [
  {
    headerName: "DATE",
    field: "createdAt",
    export: true,
    renderCell: (rowData) => <DateRenderer date={rowData?.createdAt} />,
  },
  {
    headerName: "Status",
    field: "status",
    renderCell: ({ status }) => <StatusChip status={status} />,
  },
  {
    headerName: "TRANSACTION ID",
    field: "id",
    export: true,
  },
  {
    headerName: "TYPE",
    field: null,
    renderCell: (data) => _.capitalize(data?.type) || "Deposit",
  },
  {
    headerName: "Comment",
    field: "comment",
  },
  {
    headerName: "AMOUNT",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  },
];

export const LOGS_COLUMNS = [
  { headerName: "ID", field: "id", hidden: true },
  { headerName: "Logged At", field: "loggedAt" },
  { headerName: "Activity", field: "title" },
  {
    headerName: "Severity",
    field: "severity",
    renderCell: ({ severity }) => (
      <Button
        size="small"
        sx={{
          color: "white",
          bgcolor: `${severity}.main`,
          borderRadius: 1,
          p: 1,
          textTransform: "uppercase",
        }}
      >
        {severity}
      </Button>
    ),
  },
  { headerName: "User", field: "name" },
  {
    headerName: "Contact",
    field: null,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    renderCell: ({ email, phonenumber }) => {
      return (
        <Stack>
          <Typography variant="body2" color="info.main">
            {email}
          </Typography>
          <Typography variant="body2">{phonenumber}</Typography>
        </Stack>
      );
    },
  },

  {
    headerName: "Email Address",
    field: "email",
    hidden: true,
    export: true,
  },
  {
    headerName: "Telephone No.",
    field: "phonenumber",
    hidden: true,
    export: true,
  },
];

export const StatusChip = ({ status }) => (
  <Chip
    label={status}
    size="small"
    color={
      status === "completed"
        ? "success"
        : status === "pending"
          ? "warning"
          : status === "failed"
            ? "error"
            : "secondary"
    }
    sx={{ color: "#fff", textTransform: "capitalize" }}
  />
);

export const DateRenderer = ({ date }) => (
  <ListItemText
    primary={format(new Date(date), "EEEE, MMMM d, yyyy")}
    secondary={format(new Date(date), "h:mm a")}
    primaryTypographyProps={{
      fontSize: 14,
    }}
    secondaryTypographyProps={{
      fontSize: 14,
      color: "text.secondary",
    }}
  />
);
