import { useContext, useEffect, useState } from "react";
import {
  Alert,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Box,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import moment from "moment";
import LoadingButton from "@mui/lab/LoadingButton";
import _ from "lodash";
import { useQuery, useMutation } from "@tanstack/react-query";
import { NoteRounded } from "@mui/icons-material";


import { airtimeTransactionsColumns  as transactionsColumns} from "@/mocks/columns";
import { DataTable } from "@/components/tables/datatable";
import { getTransactionReport, getTransactions } from "@/api/transactionAPI";
import CustomRangePicker from "@/components/pickers/CustomRangePicker";
import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
import { currencyFormatter } from "@/constants";
import TransactionStatus from "@/components/modals/TransactionStatus";
import { CustomContext } from "@/context/providers/CustomProvider";
import { globalAlertType } from "@/components/alert/alertType";
import CustomTotal from "@/components/custom/CustomTotal";


const statusColors = {
  completed: "success",
  pending: "warning",
  failed: "error",
  refunded: "info",
};

const typeLabels = {
  airtime: "Airtime Transfer",
  bundle: "Data Bundle",
};

// NOTE: same caveat as the other pages — not provided, only imported from
// "@/mocks/columns" (as `airtimeTransactionsColumns`, reused here even
// though this table mixes airtime AND bundle rows). Best-guess shape below
// adds a Type column to distinguish them; check field names against your
// real API response.

const startDate = moment("2024-01-01").format("YYYY-MM-DD");
const endDate = moment().format("YYYY-MM-DD");

function Transactions() {
  const { customDispatch } = useContext(CustomContext);

  const [showRange, setShowRange] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [sortValue, setSortValue] = useState("all");
  const [type, setType] = useState("All");
  const [date, setDate] = useState([{ startDate, endDate, key: "selection" }]);

  // Client-mode DataTable state.
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState({ field: "createdAt", direction: "desc" });

  useEffect(() => {
    if (showRange) {
      // "none" tells the backend to use the explicit date range instead of
      // a preset period — carried over from the original behavior as-is.
      // Worth confirming with the API that "none" (vs. omitting `sort`
      // entirely) is actually the contract it expects.
      setSortValue("none");
    } else {
      setDate([{ startDate, endDate, key: "selection" }]);
    }
  }, [showRange]);

  const transactions = useQuery({
    queryKey: ["products-transactions", sortValue, date, type],
    queryFn: () => getTransactions({ date: date[0], sort: sortValue, type }),
    enabled: !!sortValue,
    keepPreviousData: true,
  });

  const transactionData = transactions.data ?? [];

  const reportMutate = useMutation({ mutationFn: getTransactionReport });

  const handleGenerateReport = () => {
    reportMutate.mutateAsync(
      { date: date[0], sort: sortValue, type, report: true },
      {
        onSuccess: () => customDispatch(globalAlertType("info", "Done!")),
        onError: () => customDispatch(globalAlertType("error", "An error has occurred!")),
      },
    );
  };

  const showReportStatus =
    reportMutate.isLoading || reportMutate.isError || reportMutate.isSuccess;

  return (
    <>
      {showReportStatus && (
        <Alert
          severity={
            reportMutate.isLoading ? "info" : reportMutate.isError ? "error" : "success"
          }
          onClose={!reportMutate.isLoading ? () => reportMutate.reset() : undefined}
          sx={{ mb: 2 }}
        >
          {reportMutate.isLoading ? (
            "Generating report. Please wait…"
          ) : reportMutate.isError ? (
            "Report generation failed. An error has occurred."
          ) : reportMutate.data === "No data found" ? (
            "No transactional report found for this selection."
          ) : (
            <>
              A copy of the report has been sent to your email. Download or view it{" "}
              <a href={reportMutate.data} target="_blank" rel="noreferrer">
                here
              </a>
              .
            </>
          )}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            flexWrap="wrap"
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={showRange ? "custom" : "preset"}
              onChange={(_e, next) => {
                if (next !== null) setShowRange(next === "custom");
              }}
              disabled={reportMutate.isLoading}
            >
              <ToggleButton value="preset">Preset period</ToggleButton>
              <ToggleButton value="custom">Custom range</ToggleButton>
            </ToggleButtonGroup>

            {showRange ? (
              <CustomRangePicker
                date={date}
                setDate={setDate}
                setOpen={setOpenPicker}
                refetch={transactions.refetch}
              />
            ) : (
              <TextField
                select
                label="Select Period"
                size="small"
                value={sortValue}
                onChange={(e) => setSortValue(e.target.value)}
                disabled={reportMutate.isLoading}
                sx={{ width: 250 }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="week">Last 7 Days</MenuItem>
                <MenuItem value="month">This Month ({moment().format("MMMM")})</MenuItem>
                <MenuItem value="lmonth">
                  Last Month ({moment().subtract(1, "months").format("MMMM")})
                </MenuItem>
                <MenuItem value="year">This Year ({moment().format("YYYY")})</MenuItem>
                <MenuItem value="lyear">
                  Last Year ({moment().subtract(1, "years").format("YYYY")})
                </MenuItem>
              </TextField>
            )}

            <TextField
              select
              label="Select Type"
              size="small"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={reportMutate.isLoading}
              sx={{ width: 220 }}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="airtime">Airtime Transfer</MenuItem>
              <MenuItem value="bundle">Data Bundle</MenuItem>
            </TextField>

            <Box sx={{ flex: 1 }} />

            <CustomTotal
              title="Total"
              total={currencyFormatter(_.sumBy(transactionData, (item) => Number(item?.amount)))}
            />
          </Stack>

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <LoadingButton
              variant="contained"
              endIcon={<NoteRounded />}
              onClick={handleGenerateReport}
              loading={reportMutate.isLoading}
              disabled={reportMutate.isLoading || transactionData.length === 0}
            >
              Generate Report
            </LoadingButton>
          </Box>
        </Stack>
      </Paper>

      <DataTable
        mode="client"
        title="Transactions"
        columns={transactionsColumns}
        data={transactionData}
        getRowId={(row) => row.id}
        loading={transactions.isLoading}
        fetching={transactions.isFetching}
        error={transactions.isError ? { message: "Couldn't load transactions." } : null}
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
        exportFileName="transactions"
        emptyState={{
          title: "No transactions found",
          description: "Try a different period, range, or transaction type.",
        }}
      />

      <TransactionStatus />
      <CustomDateRangePicker
        open={openPicker}
        date={date}
        setDate={setDate}
        setOpen={setOpenPicker}
        refetchData={transactions.refetch}
      />
    </>
  );
}

export default Transactions;

// import {
//   Alert,
//   MenuItem,
//   Checkbox,
//   FormControlLabel,
//   Stack,
//   TextField,
//   Box,
// } from "@mui/material";
// import moment from "moment";
// import CustomizedMaterialTable from "../../components/tables/CustomizedMaterialTable";
// import { airtimeTransactionsColumns } from "../../mocks/columns";
// import LoadingButton from "@mui/lab/LoadingButton";
// import _ from "lodash";
// import { useQuery, useMutation } from "@tanstack/react-query";
// import {
//   getTransactionReport,
//   getTransactions,
// } from "../../api/transactionAPI";
// import { useEffect, useMemo, useState } from "react";
// import CustomRangePicker from "../../components/pickers/CustomRangePicker";
// import CustomDateRangePicker from "../../components/pickers/CustomDateRangePicker";
// import { NoteRounded } from "@mui/icons-material";

// import { currencyFormatter } from "../../constants";

// import TransactionStatus from "../../components/modals/TransactionStatus";
// import { CustomContext } from "../../context/providers/CustomProvider";
// import { useContext } from "react";
// import { globalAlertType } from "../../components/alert/alertType";
// import CustomTotal from "../../components/custom/CustomTotal";

// const startDate = moment("2024-01-01").format("YYYY-MM-DD");
// const endDate = moment().format("YYYY-MM-DD");
// function Transactions() {
//   const { customDispatch } = useContext(CustomContext);

//   const [showRange, setShowRange] = useState(false);
//   const [openPicker, setOpenPicker] = useState(false);
//   const [sortValue, setSortValue] = useState("all");
//   const [type, setType] = useState("All");
//   const [date, setDate] = useState([
//     {
//       startDate,
//       endDate,
//       key: "selection",
//     },
//   ]);

//   useEffect(() => {
//     if (showRange) {
//       setSortValue("none");
//     } else {
//       setDate([
//         {
//           startDate,
//           endDate,
//           key: "selection",
//         },
//       ]);
//     }
//   }, [showRange, startDate, endDate]);

//   const transactions = useQuery({
//     queryKey: ["products-transactions", sortValue, date, type],
//     queryFn: () => getTransactions({ date: date[0], sort: sortValue, type }),
//     enabled: !!sortValue,
//     initialData: [],
//   });

//   //Generate report

//   const reportMutate = useMutation({
//     mutationFn: getTransactionReport,
//   });

//   const handleGenerateReport = () => {
//     const data = {
//       date: date[0],
//       sort: sortValue,
//       type,
//       report: true,
//     };

//     reportMutate.mutateAsync(data, {
//       onSuccess: () => {
//         customDispatch(globalAlertType("info", "Done!"));
//       },
//       onError: () => {
//         customDispatch(globalAlertType("error", "An error has occurred!"));
//       },
//     });
//   };

//   const result =
//     reportMutate.isLoading || reportMutate.isError || reportMutate.isSuccess;

//   return (
//     <>
//       {transactions.isLoading && (
//         <Alert variant="standard" severity="info" sx={{ mb: 1 }}>
//           Loading Transactions.Please wait...
//         </Alert>
//       )}
//       {transactions.isError && (
//         <Alert variant="standard" severity="info" sx={{ mb: 1 }}>
//           {transactions.error}
//         </Alert>
//       )}

//       {result && (
//         <Alert
//           severity={
//             reportMutate.isLoading
//               ? "info"
//               : reportMutate.isError
//                 ? "error"
//                 : "success"
//           }
//         >
//           {reportMutate.isLoading ? (
//             "Generating Report.Please Wait..."
//           ) : reportMutate.isError ? (
//             "Report Generation failed.An error has occurred"
//           ) : (
//             <>
//               {reportMutate.data === "No data found" ? (
//                 "No transactional report found !"
//               ) : (
//                 <>
//                   A copy of the report has been sent to your email. Download or
//                   View Report{"  "}
//                   <a href={reportMutate.data} target="_blank" rel="noreferrer">
//                     here
//                   </a>
//                 </>
//               )}
//             </>
//           )}
//         </Alert>
//       )}
//       <>
//         <CustomizedMaterialTable
//           title="Transaction"
//           search
//           isLoading={transactions.isLoading}
//           columns={airtimeTransactionsColumns}
//           data={transactions?.data}
//           showExportButton={true}
//           onRefresh={transactions.refetch}
//           autocompleteComponent={
//             <div
//               style={{
//                 display: reportMutate.isLoading ? "none" : "block",
//                 width: "100%",
//               }}
//             >
//               <Box
//                 sx={{
//                   width: "100%",
//                   display: "flex",
//                   justifyContent: "space-between",
//                   alignItems: "center",
//                   flexWrap: "wrap",
//                   // border:'1px solid red'
//                 }}
//               >
//                 <Stack
//                   direction={{ xs: "column", md: "row" }}
//                   justifyContent="center"
//                   alignItems={{ xs: "left", md: "center" }}
//                   spacing={2}
//                   width="100%"
//                   py={2}
//                 >
//                   {showRange ? (
//                     <CustomRangePicker
//                       date={date}
//                       setDate={setDate}
//                       setOpen={setOpenPicker}
//                       refetch={transactions.refetch}
//                     />
//                   ) : (
//                     <TextField
//                       select
//                       label="Select Period"
//                       size="small"
//                       value={sortValue}
//                       onChange={(e) => setSortValue(e.target.value)}
//                       sx={{ width: 250, my: 2 }}
//                     >
//                       <MenuItem value="all">All</MenuItem>
//                       <MenuItem value="today">Today</MenuItem>
//                       <MenuItem value="yesterday">Yesterday</MenuItem>
//                       <MenuItem value="week">Last 7 Days</MenuItem>
//                       <MenuItem value="month">
//                         This Month {`(${moment().format("MMMM")})`}
//                       </MenuItem>
//                       <MenuItem value="lmonth">
//                         Last Month{" "}
//                         {`(${moment().subtract(1, "months").format("MMMM")})`}
//                       </MenuItem>
//                       <MenuItem value="year">
//                         This Year {`(${moment().format("YYYY")})`}
//                       </MenuItem>
//                       <MenuItem value="lyear">
//                         Last Year{" "}
//                         {`(${moment().subtract(1, "years").format("YYYY")})`}
//                       </MenuItem>
//                     </TextField>
//                   )}
//                   <TextField
//                     select
//                     label="Select Type"
//                     size="small"
//                     value={type}
//                     onChange={(e) => setType(e.target.value)}
//                     sx={{ width: 250, my: 2 }}
//                   >
//                     <MenuItem value="All">All</MenuItem>
//                     <MenuItem value="airtime">Airtime Transfer </MenuItem>
//                     <MenuItem value="bundle">Data Bundle </MenuItem>
//                   </TextField>

//                   <CustomTotal
//                     title="Total"
//                     total={currencyFormatter(
//                       _.sumBy(transactions?.data, (item) =>
//                         Number(item?.amount),
//                       ),
//                     )}
//                   />
//                 </Stack>
//               </Box>
//               <div
//                 style={{
//                   display: "flex",
//                   justifyContent: "space-between",
//                   padding: "8px",
//                 }}
//               >
//                 <FormControlLabel
//                   label="Use Range"
//                   control={
//                     <Checkbox
//                       checked={showRange}
//                       onChange={() => setShowRange(!showRange)}
//                     />
//                   }
//                 />
//                 <LoadingButton
//                   variant="contained"
//                   endIcon={<NoteRounded />}
//                   onClick={handleGenerateReport}
//                   loading={reportMutate.isLoading}
//                   disabled={
//                     reportMutate.isLoading || transactions?.data?.length === 0
//                   }
//                 >
//                   {reportMutate.isLoading
//                     ? "Generating Report.Please Wait..."
//                     : " Generate Report"}
//                 </LoadingButton>
//               </div>
//             </div>
//           }
//         />
//       </>
//       <TransactionStatus />
//       <CustomDateRangePicker
//         open={openPicker}
//         date={date}
//         setDate={setDate}
//         setOpen={setOpenPicker}
//         refetchData={transactions.refetch}
//       />
//     </>
//   );
// }

// export default Transactions;
