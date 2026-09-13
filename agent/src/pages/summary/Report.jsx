import { useMemo, useState } from "react";
import {
  Alert,
  MenuItem,
  Stack,
  TextField,
  useTheme,
} from "@mui/material";
import _ from "lodash";
import moment from "moment";
import { useQuery } from "@tanstack/react-query";
import { getReportTransaction, getTransactions } from "@/api/transactionAPI";
import { currencyFormatter } from "@/constants";
import CustomCard from "@/components/custom/CustomCard";
import LineChart from "@/components/charts/LineChart";
import CustomTotal from "@/components/custom/CustomTotal";
import { airtimeTransactionsColumns as transactionsColumns } from "@/mocks/columns";
import { DataTable } from "@/components/tables/datatable";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const YEAR_OPTIONS = ["2024", "2025", "2026", "2027", "2028", "2029", "2030"];

function Report() {
  const { palette } = useTheme();
  // Always a string — TextField `select` values from MenuItems are
  // strings, so starting from a number (`moment().year()`) meant
  // `sortValue`'s type silently flipped the first time it changed.
  const [sortValue, setSortValue] = useState(String(moment().year()));
  const [type, setType] = useState("All");

  // Client-mode DataTable state.
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState({ field: "createdAt", direction: "desc" });

  // Was a module-level constant scoped to "start of the *current* year to
  // today," never recomputed from the selected year — so picking any year
  // other than the current one queried the wrong date range entirely and
  // then filtered client-side against data that could never match.
  // Derive the range from `sortValue` instead.
  const date = useMemo(
    () => ({
      startDate: moment(`${sortValue}-01-01`).format("YYYY-MM-DD"),
      endDate: moment(`${sortValue}-12-31`).format("YYYY-MM-DD"),
    }),
    [sortValue],
  );

  const reportTransactions = useQuery({
    queryKey: ["report-transactions", sortValue, type],
    queryFn: () => getReportTransaction(sortValue, type),
    enabled: !!sortValue && !!type,
  });

  const transactions = useQuery({
    queryKey: ["products-transactions", sortValue, type, date],
    queryFn: () => getTransactions({ date, sort: "All", type }),
    enabled: !!sortValue,
    keepPreviousData: true,
    select: (data) =>
      data?.filter((t) => moment(t.createdAt).year() === Number(sortValue)),
  });

  const transactionData = transactions.data ?? [];

  return (
    <>
      {reportTransactions.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Couldn&apos;t load the chart data for this selection.
        </Alert>
      )}

      <Stack spacing={8}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="center"
          alignItems={{ xs: "left", md: "center" }}
          spacing={2}
          mb={2}
        >
          <TextField
            select
            label="Select Period"
            size="small"
            value={sortValue}
            onChange={(e) => {
              setSortValue(e.target.value);
              setPage(1);
            }}
            sx={{ width: 200, my: 2 }}
          >
            {YEAR_OPTIONS.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Select Type"
            size="small"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            sx={{ width: 200, my: 2 }}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Airtime">Airtime Transfers</MenuItem>
            <MenuItem value="Bundle">Data Bundle</MenuItem>
          </TextField>

          <CustomTotal
            title="Total"
            total={currencyFormatter(
              _.sumBy(transactionData, (item) => Number(item?.amount)),
            )}
          />
        </Stack>

        <CustomCard
          title={`Graph of Total Transactions(GHS) for ${type} in ${sortValue}`}
        >
          <LineChart
            labels={months}
            datasets={
              type === "All"
                ? [
                    {
                      label: "Airtime Tranfers",
                      data: reportTransactions?.data?.airtime ?? [],
                      tension: 0.2,
                      borderColor: palette.success.main,
                    },
                    {
                      label: "Data Bundle",
                      data: reportTransactions?.data?.bundle ?? [],
                      tension: 0.2,
                      borderColor: palette.warning.main,
                    },
                  ]
                : [
                    {
                      label: type,
                      data: reportTransactions?.data?.report ?? [],
                      tension: 0.2,
                      // Was comparing against "bundle"/"airtime" (lowercase)
                      // while `type` is actually "Bundle"/"Airtime" — those
                      // branches could never match, so this always fell
                      // through to palette.primary.main regardless of
                      // selection.
                      borderColor:
                        type === "Bundle"
                          ? palette.secondary.main
                          : type === "Airtime"
                            ? palette.success.main
                            : palette.primary.main,
                    },
                  ]
            }
          />
        </CustomCard>

        <DataTable
          mode="client"
          title={`${type} Transactions`}
          columns={transactionsColumns}
          data={transactionData}
          getRowId={(row) => row.id}
          loading={transactions.isLoading}
          fetching={transactions.isFetching}
          error={
            transactions.isError
              ? { message: "Couldn't load transactions." }
              : null
          }
          onRetry={transactions.refetch}
          onRefresh={() => {
            reportTransactions.refetch();
            transactions.refetch();
          }}
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
          exportFileName="transactions-report"
          emptyState={{
            title: "No transactions found",
            description: "Try a different year or transaction type.",
          }}
        />
      </Stack>
    </>
  );
}

export default Report;

// import { useMemo, useState } from "react";
// import { Alert, MenuItem, Stack, TextField, useTheme } from "@mui/material";
// import CustomizedMaterialTable from "@/components/tables/CustomizedMaterialTable";
// import { airtimeTransactionsColumns } from "@/mocks/columns";
// import _ from "lodash";
// import { useQuery } from "@tanstack/react-query";
// import {
//   getReportTransaction,
//   getTransactions,
// } from "@/api/transactionAPI";
// import { currencyFormatter } from "@/constants";
// import CustomCard from "@/components/custom/CustomCard";
// import LineChart from "@/components/charts/LineChart";
// import moment from "moment";
// import CustomTotal from "@/components/custom/CustomTotal";

// const months = [
//   "January",
//   "February",
//   "March",
//   "April",
//   "May",
//   "June",
//   "July",
//   "August",
//   "September",
//   "October",
//   "November",
//   "December",
// ];

// const currentYear = moment().year();
// const startDate = moment().startOf("year").format("YYYY-MM-DD");
// const endDate = moment().format("YYYY-MM-DD");
// function Report() {
//   const { palette } = useTheme();
//   const [sortValue, setSortValue] = useState(currentYear);
//   const [type, setType] = useState("All");
//   const date = {
//     startDate,
//     endDate,
//   };

//   const reportTransactions = useQuery({
//     queryKey: ["report-transactions", sortValue, type],
//     queryFn: () => getReportTransaction(sortValue, type),
//     enabled: !!sortValue && !!type,
//   });

//   const transactions = useQuery({
//     queryKey: ["products-transactions", sortValue, type],
//     queryFn: () =>
//       getTransactions({
//         date,
//         sort: "All",
//         type,
//       }),
//     enabled: !!sortValue,
//     select: (transactions) => {
//       return transactions?.filter(
//         (transaction) => moment(transaction.createdAt).year() == sortValue,
//       );
//     },
//   });

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

//       <Stack spacing={8}>
//         <Stack
//           direction={{ xs: "column", md: "row" }}
//           justifyContent="center"
//           alignItems={{ xs: "left", md: "center" }}
//           spacing={2}
//           mb={2}
//         >
//           <TextField
//             select
//             label="Select Period"
//             size="small"
//             value={sortValue}
//             onChange={(e) => setSortValue(e.target.value)}
//             sx={{ width: 200, my: 2 }}
//           >
//             <MenuItem value="2024">2024</MenuItem>
//             <MenuItem value="2025">2025</MenuItem>
//             <MenuItem value="2026">2026</MenuItem>
//             <MenuItem value="2027">2027</MenuItem>
//             <MenuItem value="2028">2028</MenuItem>
//             <MenuItem value="2029">2029</MenuItem>
//             <MenuItem value="2030">2030</MenuItem>
//           </TextField>
//           <TextField
//             select
//             label="Select Type"
//             size="small"
//             value={type}
//             onChange={(e) => setType(e.target.value)}
//             sx={{ width: 200, my: 2 }}
//           >
//             <MenuItem value="All">All</MenuItem>
//             <MenuItem value="Airtime">Airtime Transfers</MenuItem>
//             <MenuItem value="Bundle">Data Bundle </MenuItem>
//           </TextField>

//           <CustomTotal
//             title="Total"
//             total={currencyFormatter(
//               _.sumBy(transactions?.data, (item) => Number(item?.amount)),
//             )}
//           />
//         </Stack>

//         <CustomCard
//           title={`Graph of Total Transactions(GHS) for ${type} in ${sortValue}`}
//         >
//           <LineChart
//             labels={months}
//             datasets={
//               type === "All"
//                 ? [
//                     {
//                       label: "Airtime Tranfers",
//                       data: reportTransactions?.data?.airtime ?? [],
//                       tension: 0.2,
//                       borderColor: palette.success.main,
//                     },
//                     {
//                       label: "Data Bundle",
//                       data: reportTransactions?.data?.bundle ?? [],
//                       tension: 0.2,
//                       borderColor: palette.warning.main,
//                     },
//                   ]
//                 : [
//                     {
//                       label: type,
//                       data: reportTransactions?.data?.report ?? [],
//                       tension: 0.2,
//                       borderColor:
//                         type === "bundle"
//                           ? palette.secondary.main
//                           : type === "airtime"
//                             ? palette.success.main
//                             : palette.primary.main,
//                     },
//                   ]
//             }
//           />
//         </CustomCard>

//         <CustomizedMaterialTable
//           title={`${type} Transactions`}
//           search
//           isLoading={transactions.isLoading}
//           columns={airtimeTransactionsColumns}
//           data={transactions?.data || []}
//           showExportButton={true}
//           onRefresh={() => {
//             reportTransactions.refetch();
//             transactions.refetch();
//           }}
//         />
//       </Stack>
//     </>
//   );
// }

// export default Report;
