import { useContext, useMemo, useState } from "react";
import _ from "lodash";
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

import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
import CustomRangePicker from "@/components/pickers/CustomRangePicker";
import CustomTitle from "@/components/custom/CustomTitle";
import CustomTotal from "@/components/custom/CustomTotal";
import { AuthContext } from "@/context/providers/AuthProvider";
import { DataTable } from "@/components/tables/datatable";
import NewTransfer from "./NewTransfer";
import { getAgentTransactions } from "@/api/agentAPI";
import { currencyFormatter } from "@/constants";
import AirtimeTransactionDetailsDialog from "./AirtimeTransactionDetailsDialog";
import AirtimeTransactionList from "./AirtimeTransactionList";
import { airtimeTransactionsColumns } from "@/mocks/columns";

const startDate = moment(new Date("2024-01-01"));
const endDate = moment(new Date());

function AirtimeTransaction() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [, setSearchParams] = useSearchParams();
  const { user } = useContext(AuthContext);

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
    queryKey: ["agent-airtime-transactions", date[0]],
    queryFn: () =>
      getAgentTransactions({
        date: {
          startDate: moment(date[0]?.startDate).format("YYYY-MM-DD"),
          endDate: moment(date[0]?.endDate).format("YYYY-MM-DD"),
        },
        type: "airtime",
      }),
    enabled: !!user?.id,
  });

  const sortedTransactions = useMemo(() => {
    if (type === "all") return transactions?.data ?? [];
    return (transactions?.data ?? []).filter((item) => item.status === type);
  }, [transactions.data, type]);

  const openNewTransfer = () => {
    setSearchParams((params) => {
      params.set("airtime-prompt", "true");
      return params;
    });
  };

  const handleView = (transaction) => {
    setSelectedTransaction(transaction);
    setViewDialogOpen(true);
  };

  // Modify columns to include onView handler
  const columnsWithAction = useMemo(
    () => [
      ...airtimeTransactionsColumns,
      {
        headerName: "Actions",
        field: "actions",
       renderCell: (row) => (
          <Button variant='outlined' size="small" onClick={() => handleView(row)}>
            View
          </Button>
        ),
        export: false,
      },
    ],
    [],
  );

  return (
    <>
      <Box sx={{ py: 2 }}>
        <CustomTitle
          title="Airtime Transfer"
          subtitle="View and Manage all your bulk airtime and EVD transactions request"
          icon={
            <PaymentsRounded sx={{ width: 50, height: 50 }} color="primary" />
          }
        />

        <Box sx={{ py: 4 }}>
          <Button variant="contained" onClick={openNewTransfer}>
            Sell Airtime
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
              _.sumBy(sortedTransactions, (item) => Number(item?.amount)),
            )}
          />
        </Stack>

        {isMobile ? (
          <AirtimeTransactionList
            data={sortedTransactions}
            onView={handleView}
            isLoading={transactions.isLoading}
          />
        ) : (
          <DataTable
            mode="client"
            title="Transactions"
            columns={columnsWithAction}
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
            exportFileName="airtime-transactions"
            emptyState={{
              title: "No transactions available",
              description: "Try a different date range or transaction type.",
            }}
          />
        )}
      </Box>

      <CustomDateRangePicker
        open={openPicker}
        setOpen={setOpenPicker}
        date={date}
        setDate={setDate}
        refetchData={transactions.refetch}
      />

      <NewTransfer />

      {/* Transaction Details Dialog */}
      <AirtimeTransactionDetailsDialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        transaction={selectedTransaction}
      />
    </>
  );
}

export default AirtimeTransaction;

// import { useContext, useMemo, useState } from "react";
// import _ from "lodash";
// import { Box, Button, Chip, MenuItem, Stack, TextField } from "@mui/material";
// import { PaymentsRounded } from "@mui/icons-material";
// import { useQuery } from "@tanstack/react-query";
// import { useSearchParams } from "react-router-dom";
// import moment from "moment";

// import { airtimeTransactionsColumns } from "@/mocks/columns";
// import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
// import CustomRangePicker from "@/components/pickers/CustomRangePicker";
// import CustomTitle from "@/components/custom/CustomTitle";
// import CustomTotal from "@/components/custom/CustomTotal";
// import { AuthContext } from "@/context/providers/AuthProvider";
// import { DataTable } from "@/components/tables/datatable";
// import NewTransfer from "./NewTransfer";
// import { getAgentTransactions } from "@/api/agentAPI";
// import { currencyFormatter } from "@/constants";

// const startDate = moment(new Date("2024-01-01"));
// const endDate = moment(new Date());

// function AirtimeTransaction() {
//   const [, setSearchParams] = useSearchParams();

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

//   // Client-mode DataTable state — it paginates/sorts `data` locally.
//   const [page, setPage] = useState(1);
//   const [rowsPerPage, setRowsPerPage] = useState(10);
//   const [sort, setSort] = useState({ field: "createdAt", direction: "desc" });

//   const transactions = useQuery({
//     queryKey: ["agent-airtime-transactions", date[0]],
//     queryFn: () =>
//       getAgentTransactions({
//         date: {
//           startDate: moment(date[0]?.startDate).format("YYYY-MM-DD"),
//           endDate: moment(date[0]?.endDate).format("YYYY-MM-DD"),
//         },
//         type: "airtime",
//       }),
//     enabled: !!user?.id,
//   });

//   const sortedTransactions = useMemo(() => {
//     if (type === "all") return transactions.data ?? [];
//     return (transactions.data ?? []).filter((item) => item.status === type);
//   }, [transactions.data, type]);

//   const openNewTransfer = () => {
//     setSearchParams((params) => {
//       params.set("airtime-prompt", "true");
//       return params;
//     });
//   };

//   return (
//     <>
//       <Box sx={{ py: 2 }}>
//         <CustomTitle
//           title="Airtime Transfer"
//           subtitle="View and Manage all your bulk airtime and EVD transactions request"
//           icon={<PaymentsRounded sx={{ width: 50, height: 50 }} color="primary" />}
//         />

//         <Box sx={{ py: 4 }}>
//           <Button variant="contained" onClick={openNewTransfer}>
//             Sell Airtime
//           </Button>
//         </Box>

//         <Stack
//           direction={{ xs: "column", md: "row" }}
//           justifyContent={{ xs: "center", md: "flex-start" }}
//           alignItems={{ xs: "stretch", md: "center" }}
//           spacing={2}
//           width="100%"
//           pb={2}
//         >
//           <CustomRangePicker
//             date={date}
//             setDate={setDate}
//             setOpen={setOpenPicker}
//             refetch={transactions.refetch}
//           />
//           <TextField
//             select
//             label="Select Transaction"
//             size="small"
//             value={type}
//             onChange={(e) => {
//               setType(e.target.value);
//               setPage(1);
//             }}
//             sx={{ width: 250 }}
//           >
//             <MenuItem value="all">All</MenuItem>
//             <MenuItem value="failed">Failed</MenuItem>
//             <MenuItem value="pending">Pending</MenuItem>
//             <MenuItem value="completed">Completed</MenuItem>
//             <MenuItem value="refunded">Refunded</MenuItem>
//           </TextField>
//           <CustomTotal
//             title="Total"
//             total={currencyFormatter(
//               _.sumBy(sortedTransactions, (item) => Number(item?.amount)),
//             )}
//           />
//         </Stack>

//         <DataTable
//           mode="client"
//           title="Transactions"
//           columns={airtimeTransactionsColumns}
//           data={sortedTransactions}
//           getRowId={(row) => row.id}
//           loading={transactions.isLoading}
//           fetching={transactions.isFetching}
//           error={
//             transactions.isError
//               ? { message: "Couldn't load transactions." }
//               : null
//           }
//           onRetry={transactions.refetch}
//           onRefresh={transactions.refetch}
//           searchable
//           searchPlaceholder="Search transactions…"
//           sort={sort}
//           onSortChange={setSort}
//           page={page}
//           rowsPerPage={rowsPerPage}
//           onPageChange={setPage}
//           onRowsPerPageChange={(newLimit) => {
//             setRowsPerPage(newLimit);
//             setPage(1);
//           }}
//           exportable
//           exportFileName="airtime-transactions"
//           emptyState={{
//             title: "No transactions available",
//             description: "Try a different date range or transaction type.",
//           }}
//         />
//       </Box>

//       <CustomDateRangePicker
//         open={openPicker}
//         setOpen={setOpenPicker}
//         date={date}
//         setDate={setDate}
//         refetchData={transactions.refetch}
//       />

//       <NewTransfer />
//     </>
//   );
// }

// export default AirtimeTransaction;

// import { useContext, useMemo, useState } from "react";
// import _ from "lodash";
// import { Box, Button, MenuItem, Stack, TextField } from "@mui/material";

// // import Swal from "sweetalert2";
// import CustomizedMaterialTable from "@/components/tables/CustomizedMaterialTable";
// import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
// import { PaymentsRounded } from "@mui/icons-material";
// import { useQuery } from "@tanstack/react-query";
// // import { CustomContext } from "@/context/providers/CustomProvider";

// import CustomTitle from "@/components/custom/CustomTitle";
// import { AuthContext } from "@/context/providers/AuthProvider";
// import { airtimeTransactionsColumns } from "@/mocks/columns";
// import NewTransfer from "./NewTransfer";
// import { useSearchParams } from "react-router-dom";
// import { getAgentTransactions } from "@/api/agentAPI";

// import { currencyFormatter } from "@/constants";
// import CustomRangePicker from "@/components/pickers/CustomRangePicker";
// import CustomTotal from "@/components/custom/CustomTotal";
// import moment from "moment";

// const startDate = moment(new Date("2024-01-01"));
// const endDate = moment(new Date());

// function AirtimeTransaction() {
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
//     queryKey: ["agent-airtime-transactions", startDate, endDate],
//     queryFn: () =>
//       getAgentTransactions({
//         date: {
//           startDate: moment(date[0]?.startDate).format("YYYY-MM-DD"),
//           endDate: moment(date[0]?.endDate).format("YYYY-MM-DD"),
//         },
//         type: "airtime",
//       }),
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
//       params.set("airtime-prompt", "true");
//       return params;
//     });
//   };

//   return (
//     <>
//       <Box sx={{ py: 2 }}>
//         <CustomTitle
//           title="Airtime Transfer"
//           subtitle="View and Manage all your bulk airtime and EVD transactions request"
//           icon={
//             <PaymentsRounded sx={{ width: 50, height: 50 }} color="primary" />
//           }
//         />

//         <Box sx={{ py: 4 }}>
//           <Button variant="contained" onClick={openNewTransfer}>
//             Sell Airtime
//           </Button>
//         </Box>
//         <CustomizedMaterialTable
//           isLoading={transactions.isLoading}
//           showExportButton={true}
//           title="Transactions"
//           emptyMessage="No Transaction Available"
//           // emptyIcon={<TransList style={{ width: 50, height: 50 }} />}
//           search={true}
//           columns={airtimeTransactionsColumns}
//           data={sortedTransactions}
//           autocompleteComponent={
//             <Stack
//               direction={{ xs: "column", md: "row" }}
//               justifyContent={{ xs: "center", md: "flex-start" }}
//               alignItems={{ xs: "left", md: "center" }}
//               spacing={2}
//               width="100%"
//               py={2}
//             >
//               <CustomRangePicker
//                 date={date}
//                 setDate={setDate}
//                 setOpen={setOpenPicker}
//                 refetch={transactions.refetch}
//               />
//               <TextField
//                 select
//                 label="Select Transaction"
//                 size="small"
//                 value={type}
//                 onChange={(e) => setType(e.target.value)}
//                 sx={{ width: 250, my: 2 }}
//               >
//                 <MenuItem value="all">All</MenuItem>
//                 <MenuItem value="failed">Failed</MenuItem>
//                 <MenuItem value="pending">Pending</MenuItem>
//                 <MenuItem value="completed">Completed</MenuItem>
//                 <MenuItem value="refunded">Refunded</MenuItem>
//               </TextField>
//               <CustomTotal
//                 title="Total"
//                 total={currencyFormatter(
//                   _.sumBy(sortedTransactions, (item) => Number(item?.amount)),
//                 )}
//               />
//             </Stack>
//           }
//           onRefresh={transactions.refetch}
//         />
//       </Box>
//       <CustomDateRangePicker
//         open={openPicker}
//         setOpen={setOpenPicker}
//         date={date}
//         setDate={setDate}
//         refetchData={transactions.refetch}
//       />

//       <NewTransfer />
//     </>
//   );
// }

// export default AirtimeTransaction;
