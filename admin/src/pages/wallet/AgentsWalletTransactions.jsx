import { useState } from "react";
import LoadingButton from "@mui/lab/LoadingButton";
import { Box, Alert, Container, MenuItem } from "@mui/material";
import { NoteAlt, NoteRounded } from "@mui/icons-material";
import { useAuth } from "@/context/providers/AuthProvider";
import _ from "lodash";
import { useMutation, useQuery } from "@tanstack/react-query";

import CustomTitle from "@/components/custom/CustomTitle";
import CustomizedMaterialTable from "@/components/tables/CustomizedMaterialTable";
import {
  geAllAgentWalletTransactions,
  generateWalletTransactionReport,
} from "@/api/transactionAPI";
import { currencyFormatter } from "@/constants";
import { WALLET_TRANSACTIONS } from "@/mocks/columns";
import DateRangePicker from "@/components/pickers/DateRangePicker";
import CustomTotal from "@/components/custom/CustomTotal";
import TransactionStatus from "@/components/modals/TransactionStatus";
import WalletTransactionDetails from "./WalletTransactionDetails";
import ActionMenu from "@/components/menu/ActionMenu";
import { useNavigate, useSearchParams } from "react-router-dom";

function AgentsWalletTransactions() {
  const { user } = useAuth();
    const navigate = useNavigate();
    const [selectedTransaction, setSelectedTransaction] = useState(null);
      const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState([
    {
      startDate: new Date("2024-01-01"),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  //Get all transactions by meter id
  const transactions = useQuery({
    queryKey: ["agents-wallet-transactions", date[0]],
    queryFn: () => geAllAgentWalletTransactions(date[0]),
    enabled: !!user?.id,
    initialData: [],
  });

  const { mutateAsync, isLoading, isSuccess, isError, data } = useMutation({
    mutationFn: generateWalletTransactionReport,
  });
  const generateReport = () => {
    mutateAsync(date[0]);

  };
  const result = isLoading || isError || isSuccess;



    const handleCheckStatus = (refId, service) => {
    setSearchParams((params) => {
      params.set("payment_reference", refId);
      params.set("type", service);
      params.set("open", true);
      return params;
    });
  };

    const columns = [
    ...WALLET_TRANSACTIONS("agents"),
    {
      field: "",
      title: "Action",
      export: false,
      render: (data) => (
        <ActionMenu>
          <MenuItem
            sx={{ fontSize: 13 }}
            onClick={() => setSelectedTransaction(data)}
          >
            View
          </MenuItem>
          {["deposit", "credit"].includes(data.type) && (
            <MenuItem
              sx={{ fontSize: 13 }}
              onClick={() => {
                handleCheckStatus(`wallet-${data?.id}`, "wallet");
              }}
            >
              Check Status
            </MenuItem>
          )}
        </ActionMenu>
      ),
    },
  ];

  return (
    <div>
      <>
        <CustomTitle
          icon={<NoteAlt sx={{ width: 50, height: 50 }} color="primary" />}
          title="Agent Wallet Transactions"
          subtitle="Manage all your wallet transactions made by agents "
          showBack
             onBack={() => {
            navigate("/wallets/agent");
          }}
        />

        {result && (
          <Alert severity={isLoading ? "info" : isError ? "error" : "success"}>
            {isLoading ? (
              "Generating Report.Please Wait..."
            ) : isError ? (
              "Report Generation failed.An error has occurred"
            ) : (
              <>
                {data === "No data found" ? (
                  "No transactional report found !"
                ) : (
                  <>
                    A copy of the report has been sent to your email. Download
                    or View Report{"  "}
                    <a href={data} target="_blank" rel="noreferrer">
                      here
                    </a>
                  </>
                )}
              </>
            )}
          </Alert>
        )}
        <CustomizedMaterialTable
          isLoading={transactions.isLoading}
          title="Transactions"
          search={true}
          columns={columns}
          data={transactions.data}
          showExportButton
          emptyMessage="No Transaction available"
          icon={<NoteAlt sx={{ width: 40, height: 40 }} color="primary" />}
          onRefresh={transactions.refetch}
          autocompleteComponent={
            <>
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                  mb:3
                }}
              >
                    <CustomTotal
                  title="Total Amount"
                  total={currencyFormatter(
                    _.sumBy(transactions.data, (item) => Number(item?.amount)),
                  )}
                />
                <LoadingButton
                  variant="contained"
                  endIcon={<NoteRounded />}
                  onClick={generateReport}
                  loading={isLoading}
                >
                  {isLoading
                    ? "Generating Report.Please Wait..."
                    : " Generate Report"}
                </LoadingButton>

            
                  </Box>
                <DateRangePicker
                  date={date}
                  setDate={setDate}
                  onReset={transactions.refetch}
                  placeholder="Pick a date range"
                  dateFormat="ll"
                  maxDate={new Date()}
                  minDate={new Date("2024-01-01")}
                />
            </>
          }
          options={{
            exportAllData: true,
            exportButton: user?.permissions?.includes(
              "Export agent wallet Transaction",
            ),
                 rowStyle: (rowData) => ({
              borderLeft: `3px solid ${
                rowData?.type === "credit" ? "#2e7d32" : "#c62828"
              }`,
            }),
          }}
        />

        
      <TransactionStatus />

      <WalletTransactionDetails
        open={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
      </>
    </div>
  );
}

export default AgentsWalletTransactions;
