import { useMemo, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { PaymentsRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import moment from "moment";
import _ from "lodash";

import { airtimeTransactionsColumns as bundleTransactionsColumns } from "@/mocks/columns";
import { DataTable } from "@/components/tables/datatable";
import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
import CustomRangePicker from "@/components/pickers/CustomRangePicker";
import CustomTitle from "@/components/custom/CustomTitle";
import CustomTotal from "@/components/custom/CustomTotal";
import { useAuth } from "@/context/providers/AuthProvider";
import NewBundleTransfer from "./NewBundleTransfer";
import { getAgentTransactions } from "@/api/agentAPI";
import { currencyFormatter } from "@/constants";
import BundleTransactionDetailsDialog from "./BundleTransactionDetailsDialog";
import BundleTransactionList from "./BundleTransactionList";

const startDate = moment("2024-01-01").format("YYYY-MM-DD");
const endDate = moment().format("YYYY-MM-DD");

function BundleTransaction() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [openPicker, setOpenPicker] = useState(false);
  const [type, setType] = useState("all");
  const [date, setDate] = useState([
    {
      startDate,
      endDate,
      key: "selection",
    },
  ]);

  // Client-mode DataTable state
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState({ field: "createdAt", direction: "desc" });

  // Dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const transactions = useQuery({
    queryKey: ["agent-bundle-transactions", date[0]],
    queryFn: () =>
      getAgentTransactions({
        date: {
          startDate: moment(date[0]?.startDate).format("YYYY-MM-DD"),
          endDate: moment(date[0]?.endDate).format("YYYY-MM-DD"),
        },
        type: "bundle",
      }),
    enabled: !!user?.id,
  });

  const sortedTransactions = useMemo(() => {
    if (type === "all") return transactions.data ?? [];
    return (transactions.data ?? []).filter((item) => item.status === type);
  }, [transactions.data, type]);

  const openNewTransfer = () => {
    setSearchParams((params) => {
      params.set("bundle-prompt", "true");
      return params;
    });
  };

  const handleView = (transaction) => {
    setSelectedTransaction(transaction);
    setViewDialogOpen(true);
  };

  // Add "Actions" column for desktop table
  const columnsWithAction = useMemo(
    () =>
      bundleTransactionsColumns.map((col) => {
        if (col.field === "actions") {
          return {
            ...col,
            render: (row) => (
              <Button size="small" onClick={() => handleView(row)}>
                View
              </Button>
            ),
          };
        }
        return col;
      }),
    []
  );

  // If the imported columns don't include an actions column, add one.
  const finalColumns = useMemo(() => {
    if (!columnsWithAction.some((c) => c.field === "actions")) {
      return [
        ...columnsWithAction,
        {
          headerName: "Actions",
          field: "actions",
          renderCell: (row) => (
            <Button size="small" onClick={() => handleView(row)}>
              View
            </Button>
          ),
          export: false,
        },
      ];
    }
    return columnsWithAction;
  }, [columnsWithAction]);

  return (
    <>
      <CustomTitle
        title="Data Transfer"
        subtitle="View and Manage all your bulk bundle and EVD transactions request"
        icon={<PaymentsRounded sx={{ width: 50, height: 50 }} color="primary" />}
      />

      <Box sx={{ py: 4 }}>
        <Button variant="contained" onClick={openNewTransfer}>
          Sell Data
        </Button>
      </Box>

      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent={{ xs: "center", md: "flex-start" }}
        alignItems={{ xs: "stretch", md: "center" }}
        spacing={2}
        width="100%"
        pb={2}
      >
        <CustomRangePicker
          date={date}
          setDate={setDate}
          setOpen={setOpenPicker}
          refetch={transactions.refetch}
        />
        <TextField
          select
          label="Select Transaction"
          size="small"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          sx={{ width: 250 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="failed">Failed</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
          <MenuItem value="refunded">Refunded</MenuItem>
        </TextField>
        <CustomTotal
          title="Total"
          total={currencyFormatter(
            _.sumBy(sortedTransactions, (item) => Number(item?.amount))
          )}
        />
      </Stack>

      {isMobile ? (
        <BundleTransactionList
          data={sortedTransactions}
          onView={handleView}
          isLoading={transactions.isLoading}
        />
      ) : (
        <DataTable
          mode="client"
          title="Transactions"
          columns={finalColumns}
          data={sortedTransactions}
          getRowId={(row) => row.id}
          loading={transactions.isLoading}
          fetching={transactions.isFetching}
          error={
            transactions.isError
              ? { message: "Couldn't load transactions." }
              : null
          }
          onRetry={transactions.refetch}
          onRefresh={transactions.refetch}
          searchable
          searchPlaceholder="Search transactions…"
          sort={sort}
          onSortChange={setSort}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={(newLimit) => {
            setRowsPerPage(newLimit);
            setPage(1);
          }}
          exportable
          exportFileName="bundle-transactions"
          emptyState={{
            title: "No transactions available",
            description: "Try a different date range or transaction type.",
          }}
        />
      )}

      <CustomDateRangePicker
        open={openPicker}
        setOpen={setOpenPicker}
        date={date}
        setDate={setDate}
        refetchData={transactions.refetch}
      />

      <NewBundleTransfer />

      {/* Transaction Details Dialog */}
      <BundleTransactionDetailsDialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        transaction={selectedTransaction}
      />
    </>
  );
}

export default BundleTransaction;

// import {  useMemo, useState } from "react";
// import _ from "lodash";
// import { Box, Button, MenuItem, Stack, TextField } from "@mui/material";
// import { PaymentsRounded } from "@mui/icons-material";
// import { useQuery } from "@tanstack/react-query";
// import { useSearchParams } from "react-router-dom";
// import moment from "moment";

// import { airtimeTransactionsColumns as bundleTransactionsColumns } from "@/mocks/columns";
// import { DataTable } from "@/components/tables/datatable";
// import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
// import CustomRangePicker from "@/components/pickers/CustomRangePicker";
// import CustomTitle from "@/components/custom/CustomTitle";
// import CustomTotal from "@/components/custom/CustomTotal";
// import { useAuth } from "@/context/providers/AuthProvider";
// import NewBundleTransfer from "./NewBundleTransfer";
// import { getAgentTransactions } from "@/api/agentAPI";
// import { currencyFormatter } from "@/constants";


// const startDate = moment("2024-01-01").format("YYYY-MM-DD");
// const endDate = moment().format("YYYY-MM-DD");

// function BundleTransaction() {
//   const [, setSearchParams] = useSearchParams();

//   const { user } = useAuth();
//   const [openPicker, setOpenPicker] = useState(false);
//   const [type, setType] = useState("all");
//   const [date, setDate] = useState([
//     {
//       startDate,
//       endDate,
//       key: "selection",
//     },
//   ]);

//   // Client-mode DataTable state — it paginates/sorts `data` locally.
//   const [page, setPage] = useState(1);
//   const [rowsPerPage, setRowsPerPage] = useState(10);
//   const [sort, setSort] = useState({ field: "createdAt", direction: "desc" });

//   const transactions = useQuery({
//     // Was keyed on the module-level `startDate`/`endDate` constants
//     // instead of the `date` state, so the query never re-identified
//     // itself when the range picker changed. Keying on `date[0]` makes
//     // the selected range an honest part of the query's identity.
//     queryKey: ["agent-bundle-transactions", date[0]],
//     queryFn: () =>
//       // Was sending `date[0]` — the whole range-picker object, including
//       // its `key: "selection"` field, and whose startDate/endDate could
//       // be either formatted strings or Date objects depending on whether
//       // the user had touched the picker yet. Always format explicitly
//       // instead, matching the Airtime transactions page.
//       getAgentTransactions({
//         date: {
//           startDate: moment(date[0]?.startDate).format("YYYY-MM-DD"),
//           endDate: moment(date[0]?.endDate).format("YYYY-MM-DD"),
//         },
//         type: "bundle",
//       }),
//     enabled: !!user?.id,
//   });

//   const sortedTransactions = useMemo(() => {
//     if (type === "all") return transactions.data ?? [];
//     return (transactions.data ?? []).filter((item) => item.status === type);
//   }, [transactions.data, type]);

//   const openNewTransfer = () => {
//     setSearchParams((params) => {
//       params.set("bundle-prompt", "true");
//       return params;
//     });
//   };

//   return (
//     <>
//       <CustomTitle
//         title="Data Transfer"
//         subtitle="View and Manage all your bulk bundle and EVD transactions request"
//         icon={
//           <PaymentsRounded sx={{ width: 50, height: 50 }} color="primary" />
//         }
//       />

//       <Box sx={{ py: 4 }}>
//         <Button variant="contained" onClick={openNewTransfer}>
//           Sell Data
//         </Button>
//       </Box>

//       <Stack
//         direction={{ xs: "column", md: "row" }}
//         justifyContent={{ xs: "center", md: "flex-start" }}
//         alignItems={{ xs: "stretch", md: "center" }}
//         spacing={2}
//         width="100%"
//         pb={2}
//       >
//         <CustomRangePicker
//           date={date}
//           setDate={setDate}
//           setOpen={setOpenPicker}
//           refetch={transactions.refetch}
//         />
//         <TextField
//           select
//           label="Select Transaction"
//           size="small"
//           value={type}
//           onChange={(e) => {
//             setType(e.target.value);
//             setPage(1);
//           }}
//           sx={{ width: 250 }}
//         >
//           <MenuItem value="all">All</MenuItem>
//           <MenuItem value="failed">Failed</MenuItem>
//           <MenuItem value="pending">Pending</MenuItem>
//           <MenuItem value="completed">Completed</MenuItem>
//           <MenuItem value="refunded">Refunded</MenuItem>
//         </TextField>
//         <CustomTotal
//           title="Total"
//           total={currencyFormatter(
//             _.sumBy(sortedTransactions, (item) => Number(item?.amount)),
//           )}
//         />
//       </Stack>

//       <DataTable
//         mode="client"
//         title="Transactions"
//         columns={bundleTransactionsColumns}
//         data={sortedTransactions}
//         getRowId={(row) => row.id}
//         loading={transactions.isLoading}
//         fetching={transactions.isFetching}
//         error={
//           transactions.isError
//             ? { message: "Couldn't load transactions." }
//             : null
//         }
//         onRetry={transactions.refetch}
//         onRefresh={transactions.refetch}
//         searchable
//         searchPlaceholder="Search transactions…"
//         sort={sort}
//         onSortChange={setSort}
//         page={page}
//         rowsPerPage={rowsPerPage}
//         onPageChange={setPage}
//         onRowsPerPageChange={(newLimit) => {
//           setRowsPerPage(newLimit);
//           setPage(1);
//         }}
//         exportable
//         exportFileName="bundle-transactions"
//         emptyState={{
//           title: "No transactions available",
//           description: "Try a different date range or transaction type.",
//         }}
//       />

//       <CustomDateRangePicker
//         open={openPicker}
//         setOpen={setOpenPicker}
//         date={date}
//         setDate={setDate}
//         refetchData={transactions.refetch}
//       />

//       <NewBundleTransfer />
//     </>
//   );
// }

// export default BundleTransaction;

// import { useContext, useMemo, useState } from "react";
// import _ from "lodash";
// import { Box, Button, MenuItem, Stack, TextField } from "@mui/material";

// import CustomizedMaterialTable from "@/components/tables/CustomizedMaterialTable";
// import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
// import { PaymentsRounded } from "@mui/icons-material";
// import { useQuery } from "@tanstack/react-query";

// import CustomTitle from "@/components/custom/CustomTitle";
// import { AuthContext } from "@/context/providers/AuthProvider";
// import { airtimeTransactionsColumns } from "@/mocks/columns";
// import { useSearchParams } from "react-router-dom";
// import { getAgentTransactions } from "@/api/agentAPI";

// import { currencyFormatter } from "@/constants";
// import CustomRangePicker from "@/components/pickers/CustomRangePicker";
// import NewBundleTransfer from "./NewBundleTransfer";
// import CustomTotal from "@/components/custom/CustomTotal";
// import moment from "moment";

// const startDate = moment("2024-01-01").format("YYYY-MM-DD");
// const endDate = moment().format("YYYY-MM-DD");
// function BundleTransaction() {
//   const [searchParams, setSearchParams] = useSearchParams();

//   const { user } = useContext(AuthContext);
//   const [openPicker, setOpenPicker] = useState(false);
//   const [type, setType] = useState("all");
//   const [date, setDate] = useState([
//     {
//       startDate,
//       endDate,
//       key: "selection",
//     },
//   ]);

//   const transactions = useQuery({
//     queryKey: ["agent-bundle-transactions", startDate, endDate],
//     queryFn: () => getAgentTransactions({ date: date[0], type: "bundle" }),
//     enabled: !!user?.id,
//   });

//   const sortedTransactions = useMemo(() => {
//     if (type == "all") {
//       return transactions?.data;
//     }

//     return transactions?.data?.filter((item) => item.status === type);
//   }, [transactions?.data, type]);

//   const openNewTransfer = () => {
//     setSearchParams((params) => {
//       params.set("bundle-prompt", "true");
//       return params;
//     });
//   };

//   return (
//     <>
//       <CustomTitle
//         title="Data Transfer"
//         subtitle="View and Manage all your bulk bundle and EVD transactions request"
//         icon={
//           <PaymentsRounded sx={{ width: 50, height: 50 }} color="primary" />
//         }
//       />

//       <Box sx={{ py: 4 }}>
//         <Button variant="contained" onClick={openNewTransfer}>
//           Sell Data
//         </Button>
//       </Box>
//       <CustomizedMaterialTable
//         isLoading={transactions.isLoading}
//         showExportButton={true}
//         title="Transactions"
//         emptyMessage="No Transaction Available"
//         // emptyIcon={<TransList style={{ width: 50, height: 50 }} />}
//         search={true}
//         columns={airtimeTransactionsColumns}
//         data={sortedTransactions}
//         autocompleteComponent={
//           <Stack
//             direction={{ xs: "column", md: "row" }}
//             justifyContent={{ xs: "center", md: "flex-start" }}
//             alignItems={{ xs: "left", md: "center" }}
//             spacing={2}
//             width="100%"
//             py={2}
//           >
//             <CustomRangePicker
//               date={date}
//               setDate={setDate}
//               setOpen={setOpenPicker}
//               refetch={transactions.refetch}
//             />

//             <TextField
//               select
//               label="Select Transaction"
//               size="small"
//               value={type}
//               onChange={(e) => setType(e.target.value)}
//               sx={{ width: 250, my: 2 }}
//             >
//               <MenuItem value="all">All</MenuItem>
//               <MenuItem value="failed">Failed</MenuItem>
//               <MenuItem value="pending">Pending</MenuItem>
//               <MenuItem value="completed">Completed</MenuItem>
//               <MenuItem value="refunded">Refunded</MenuItem>
//             </TextField>

//             <CustomTotal
//               title="Total"
//               total={currencyFormatter(
//                 _.sumBy(sortedTransactions, (item) => Number(item?.amount))
//               )}
//             />
//           </Stack>
//         }
//         onRefresh={transactions.refetch}
//       />
//       <CustomDateRangePicker
//         open={openPicker}
//         setOpen={setOpenPicker}
//         date={date}
//         setDate={setDate}
//         refetchData={transactions.refetch}
//       />

//       <NewBundleTransfer />
//     </>
//   );
// }

// export default BundleTransaction;
