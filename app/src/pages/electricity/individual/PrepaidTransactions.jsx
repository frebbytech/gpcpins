import { useState } from "react";
import {
  Button,
  Container,
  Dialog,
  DialogContent,
  MenuItem,
  Typography,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
  Box,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import _ from "lodash";

import CustomizedMaterialTable from "../../../components/tables/CustomizedMaterialTable";
import CustomTotal from "../../../components/custom/CustomTotal";
import { currencyFormatter } from "../../../constants";
import { getAllElectricityPaymentByUserId } from "../../../api/electricityAPI";
import { useCustomContext } from "../../../context/providers/CustomProvider";
import { useAuth } from "../../../context/providers/AuthProvider";
import ActionMenu from "../../../components/menu/ActionMenu";
import CustomDialogTitle from "../../../components/dialogs/CustomDialogTitle";
import PaymentReceipt from "./PaymentReceipt";
import PrepaidTransactionList from "./PrepaidTransactionList";
import { DateRenderer, StatusChip } from "../../../mocks/columns";

const PrepaidTransactions = ({ open, setOpen }) => {
  const { user } = useAuth();
  const { customDispatch } = useCustomContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [statusFilter, setStatusFilter] = useState("all");

  const transactions = useQuery({
    queryKey: ["ecg-transaction-info", user?.id],
    queryFn: () => getAllElectricityPaymentByUserId(user?.id),
    enabled: !!user?.id,
    initialData: [],
  });

  const handleClose = () => setOpen(false);
  const handleRefresh = () => transactions.refetch();

  // Filtered data for total calculation (used in both views)
  const filteredData = () => {
    let filtered = transactions.data;
    if (statusFilter !== "all") {
      if (statusFilter === "completed") {
        filtered = filtered.filter((item) => item.isProcessed === true);
      } else if (statusFilter === "pending") {
        filtered = filtered.filter((item) => item.isProcessed === false);
      }
    }
    return filtered;
  };

  const filteredTotal = currencyFormatter(
    _.sumBy(filteredData(), (item) => Number(item.info?.amount || 0)),
  );

  const handleView = (rowData) => {
    customDispatch({
      type: "viewEcgTransactionInfo",
      payload: { open: true, details: rowData },
    });
  };

 

  // const { mutateAsync } = useMutation({
  //   mutationFn: deletePrepaidTransaction,
  // });

  // const handleDelete = (id) => {
  //   Swal.fire({
  //     title: "Remove Transaction",
  //     text: "Are you sure you want to remove this transaction?",
  //     icon: "warning",
  //     showCancelButton: true,
  //   }).then(({ isConfirmed }) => {
  //     if (isConfirmed) {
  //       mutateAsync(id, {
  //         onSettled: () => {
  //           queryClient.invalidateQueries(["ecg-transaction-info", user?.id]);
  //         },
  //         onSuccess: (data) => customDispatch(globalAlertType("info", data)),
  //         onError: (error) => customDispatch(globalAlertType("error", error)),
  //       });
  //     }
  //   });
  // };

  // Desktop table columns
  const columns = [
    {
      title: "CREATED ON",
   render: (rowData) => <DateRenderer date={rowData?.createdAt} />,
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = moment(rowData.createdAt).format("Do MMM,YYYY");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
    },
    { title: "Token", field: "paymentId", hidden: true },
    { title: "OrderNo", field: "info.orderNo", hidden: true },
    {
      title: "Meter No.",
      render: ({ meter }) => (
        <Button
          size="small"
          sx={{ bgcolor: "info.lighter", color: "info.darker" }}
        >
          {meter?.number}
        </Button>
      ),
    },
    {
      title: "RECHARGE TOKEN",
      render: ({ info }) => (
        <Stack>
            <Typography variant="body" fontWeight='bold'>
            {info?.rechargeToken
              ? info.rechargeToken.replace(/\s|-/g, "").match(/.{1,4}/g)?.join("-")
              : ""}
          </Typography>
  
        </Stack>
      ),
    },
    {
      title: "Top Up",
      field: "topup",
      type: "currency",
      currencySetting: { currencyCode: "GHS", minimumFractionDigits: 2 },
    },
    {
      title: "Total Paid",
      render: ({ amount, mode }) => (
        <Stack>
          <Typography variant="body2" fontWeight="bold" color="success.darker">
            {currencyFormatter(amount)}
          </Typography>
          <Typography variant="body2">{mode}</Typography>
        </Stack>
      ),
    },
    // {
    //   title: "Contact",
    //   render: ({ email, phonenumber }) => (
    //     <Stack>
    //       <Typography variant="body2" color="info.main">
    //         {email}
    //       </Typography>
    //       <Typography variant="body2">{phonenumber}</Typography>
    //     </Stack>
    //   ),
    // },
    {
      title: "Status",
        render: ({ status }) => <StatusChip status={status} />,
    },
    {
      title: "Action",
      render: (data) => (
        <ActionMenu>
          <MenuItem onClick={() => handleView(data)}>View</MenuItem>
         
        </ActionMenu>
      ),
    },
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullScreen
        fullWidth
      >
        <CustomDialogTitle
          title="Prepaid Units Transaction"
          subtitle="View and manage all your prepaid transactions"
          onClose={handleClose}
        />
        <DialogContent sx={{ p: 2 }}>
          <Container>
            {isMobile ? (
              <PrepaidTransactionList
                data={transactions.data}
                isLoading={transactions.isLoading}
                onRefresh={handleRefresh}
                total={filteredTotal}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onView={handleView}
                // onDelete={handleDelete}
              />
            ) : (
              <>
                <CustomizedMaterialTable
                  isLoading={transactions.isLoading}
                  title="Prepaid Transactions"
                  search={true}
                  columns={columns}
                  data={filteredData()} // pass filtered data for table
                  emptyMessage="No recent transactions"
                  showExportButton
                  onRefresh={handleRefresh}
                  autocompleteComponent={
                    <Stack
                      width="100%"
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      px={2}
                      py={1}
                    >
                      <CustomTotal title="TOTAL AMOUNT" total={filteredTotal} />
                      {/* Filter row for desktop */}
                      <Box
                        sx={{
                          display: "flex",
                          flexGrow: 1,
                          justifyContent: "flex-end",
                          width: "100%",
                          mb: 2,
                        }}
                      >
                        <TextField
                          select
                          label="Status"
                          size="small"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          sx={{ width: 150 }}
                        >
                          <MenuItem value="all">All</MenuItem>
                          <MenuItem value="completed">Completed</MenuItem>
                          <MenuItem value="pending">Pending</MenuItem>
                        </TextField>
                      </Box>
                    </Stack>
                  }
                />
              </>
            )}
          </Container>
        </DialogContent>
      </Dialog>
      <PaymentReceipt />
    </>
  );
};

export default PrepaidTransactions;
