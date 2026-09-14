import {  useState } from "react";
import {
  Box,
  ListItemText,
  Button,
  ButtonGroup,
  Paper,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import _ from "lodash";



import { useSearchParams } from "react-router-dom";
import { PaymentsRounded } from "@mui/icons-material";
import CustomTitle from "@/components/custom/CustomTitle";
import { DataTable } from "@/components/tables/datatable";
import TopUpRequest from "./TopUpRequest";
import { getWalletBalance, getWalletTransaction } from "@/api/agentAPI";
import { useAuth } from "@/context/providers/AuthProvider";
import { currencyFormatter } from "@/constants";
import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
import CustomRangePicker from "@/components/pickers/CustomRangePicker";
import CustomTotal from "@/components/custom/CustomTotal";
import ChangePin from "./ChangePin";
import { WALLET_TOPUP_TRANSACTIONS } from "@/mocks/columns";


function Wallet() {
  const { user } =useAuth()
  const [, setSearchParams] = useSearchParams();
  const [openPicker, setOpenPicker] = useState(false);
  const [date, setDate] = useState([
    {
      startDate: new Date("2024-01-01"),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  // Client-mode DataTable state — it paginates/sorts the full transaction
  // list locally rather than refetching per page.
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState({ field: "createdAt", direction: "desc" });

  const walletBalance = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => getWalletBalance(user?.id),
    enabled: !!user?.id,
    // No `initialData` — it made react-query report this query as already
    // "successful" from mount, so the real balance briefly looked like a
    // confirmed "GHS 0.00" instead of "still loading."
  });

  const transactions = useQuery({
    queryKey: ["agent_wallet_transactions", date[0]],
    queryFn: () => getWalletTransaction(date[0]),
    enabled: !!user?.id,
    // Same reasoning: no `initialData`, so the table's loading skeleton
    // actually shows on first load instead of being skipped.
    keepPreviousData: true,
  });

  const walletTransactions = transactions.data ?? [];

  const openAddMoney = () => {
    setSearchParams((params) => {
      params.set("add-money", "true");
      return params;
    });
  };

  const openChangePin = () => {
    setSearchParams((params) => {
      params.set("view_pin", "true");
      return params;
    });
  };

  return (
    <>
      <CustomTitle
        title="Wallet"
        subtitle="View and Track all the amount deposited into your wallet"
        icon={<PaymentsRounded sx={{ width: 50, height: 50 }} color="primary" />}
      />

      <Paper variant="outlined"
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "center",
          alignItems: "center",
          p: 4,
          borderRadius:3

        }}
      >
        <ListItemText
          primary={
            walletBalance.isLoading
              ? "—"
              : currencyFormatter(walletBalance.data ?? 0)
          }
          primaryTypographyProps={{ fontSize: "1.5rem", fontWeight: "bold" }}
          secondary="Current Wallet Balance"
          secondaryTypographyProps={{ color: "secondary" }}
        />
        <ButtonGroup variant="contained">
          <Button onClick={openAddMoney}>Request Top-up</Button>
          <Button onClick={openChangePin} color="secondary">
            Change Pin
          </Button>
        </ButtonGroup>
      </Paper>
  

      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          py: 2,
        }}
      >
        <CustomRangePicker
          date={date}
          setDate={setDate}
          refetch={transactions.refetch}
          setOpen={setOpenPicker}
        />
        <CustomTotal
          title="Total"
          total={currencyFormatter(
            _.sumBy(walletTransactions, (item) => Number(item?.amount)),
          )}
        />
      </Box>

      <DataTable
        mode="client"
        title="Wallet Deposits"
        columns={WALLET_TOPUP_TRANSACTIONS}
        data={walletTransactions}
        getRowId={(row) => row.id}
        loading={transactions.isLoading}
        fetching={transactions.isFetching}
        error={
          transactions.isError
            ? { message: "Couldn't load wallet transactions." }
            : null
        }
        onRetry={transactions.refetch}
        onRefresh={transactions.refetch}
        searchable
        searchPlaceholder="Search deposits…"
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
        exportFileName="wallet-deposits"
        emptyState={{
          title: "No deposits yet",
          description: "Top-ups you make will show up here.",
        }}
      />

      <TopUpRequest />
      <CustomDateRangePicker
        open={openPicker}
        setOpen={setOpenPicker}
        date={date}
        setDate={setDate}
        refetchData={transactions.refetch}
      />
      <ChangePin />
    </>
  );
}

export default Wallet;

// import { useState } from "react";
// import {
//   Box,
//   ListItemText,
//   Divider,
//   Button,
//   ButtonGroup,
// } from "@mui/material";
// import { useQuery } from "@tanstack/react-query";
// import _ from "lodash";
// import CustomTitle from "@/components/custom/CustomTitle";
// import { PaymentsRounded, } from "@mui/icons-material";
// import CustomizedMaterialTable from "@/components/tables/CustomizedMaterialTable";
// import { useSearchParams } from "react-router-dom";
// import TopUpRequest from "./TopUpRequest";
// import { getWalletBalance, getWalletTransaction } from "@/api/agentAPI";
// import { AuthContext } from "@/context/providers/AuthProvider";
// import { useContext } from "react";
// import { currencyFormatter } from "@/constants";
// import { WALLET_TOPUP_TRANSACTIONS } from "@/mocks/columns";
// import CustomDateRangePicker from "@/components/pickers/CustomDateRangePicker";
// import CustomRangePicker from "@/components/pickers/CustomRangePicker";
// import CustomTotal from "@/components/custom/CustomTotal";
// import ChangePin from "./ChangePin";

// function Wallet() {
//   const { user } = useContext(AuthContext);
//   const [searchParams, setSearchParams] = useSearchParams();
//   const [openPicker, setOpenPicker] = useState(false);
//   const [date, setDate] = useState([
//     {
//       startDate: new Date("2024-01-01"),
//       endDate: new Date(),
//       key: "selection",
//     },
//   ]);

//   const walletBalance = useQuery({
//     queryKey: ["wallet-balance"],
//     queryFn: () => getWalletBalance(),
//     enabled: !!user?.id,
//     initialData: 0,
//   });

//   const transactions = useQuery({
//     queryKey: ["agent_wallet_transactions", date[0]],
//     queryFn: () => getWalletTransaction(date[0]),
//     enabled: !!user?.id,
//     initialData: [],
//   });

//   const openAddMoney = () => {
//     setSearchParams((params) => {
//       // params.set("data", JSON.stringify(data));
//       params.set("add-money", "true");
//       return params;
//     });
//   };

//   const openChangePin = () => {
//     setSearchParams((params) => {
//       params.set("view_pin", "true");
//       return params;
//     });
//   };

//   return (
//     <>
//       <CustomTitle
//         title="Wallet"
//         subtitle="View and Track all the amount deposited into your wallet"
//         icon={
//           <PaymentsRounded sx={{ width: 50, height: 50 }} color="primary" />
//         }
//       />

//       <Box
//         sx={{
//           display: "flex",
//           flexDirection: { xs: "column", md: "row" },
//           justifyContent: "center",
//           alignItems: "center",
//           p: 4,
//           // bgcolor: "primary.lighter",
//           border: "1px solid lightgray",
//         }}
//       >
//         <ListItemText
//           primary={currencyFormatter(walletBalance.data)}
//           primaryTypographyProps={{ fontSize: "1.5rem", fontWeight: "bold" }}
//           secondary="Current Wallet Balance"
//           secondaryTypographyProps={{ color: "secondary" }}
//         />
//         <ButtonGroup variant="contained">
//           <Button onClick={openAddMoney}>Request Top-up</Button>
//           <Button onClick={openChangePin} color="secondary">
//             Change Pin
//           </Button>
//         </ButtonGroup>
//       </Box>
//       <Divider />
//       <CustomizedMaterialTable
//         title="Wallet Deposits"
//         isLoading={transactions.isLoading}
//         columns={WALLET_TOPUP_TRANSACTIONS}
//         data={transactions?.data}
//         onRefresh={transactions.refetch}
//         showExportButton={true}
//         autocompleteComponent={
//           <Box
//             sx={{
//               width: "100%",
//               display: "flex",
//               justifyContent: "space-between",
//               alignItems: "center",
//               gap: 2,
//               flexWrap: "wrap",
//             }}
//           >
//             <CustomRangePicker
//               date={date}
//               setDate={setDate}
//               refetch={transactions.refetch}
//               setOpen={setOpenPicker}
//             />

//             <CustomTotal
//               title="Total"
//               total={currencyFormatter(
//                 _.sumBy(transactions?.data, (item) => Number(item?.amount))
//               )}
//             />
//           </Box>
//         }
//       />

//       <TopUpRequest />
//       <CustomDateRangePicker
//         open={openPicker}
//         setOpen={setOpenPicker}
//         date={date}
//         setDate={setDate}
//         refetchData={transactions.refetch}
//       />
//       <ChangePin />
//     </>
//   );
// }

// export default Wallet;
