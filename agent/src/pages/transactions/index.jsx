import { useState } from "react";

import CustomTitle from "@/components/custom/CustomTitle";
import { Container, MenuItem } from "@mui/material";
import { NoteAlt } from "@mui/icons-material";
import { useAuth } from "@/context/providers/AuthProvider";
import Swal from "sweetalert2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTransactionByEmail,
  removeAnyTransaction,
} from "@/api/transactionAPI";
import { transactionsColumns } from "@/mocks/columns";
import ActionMenu from "@/components/menu/ActionMenu";
import { globalAlertType } from "@/components/alert/alertType";
import {  useCustomContext } from "@/context/providers/CustomProvider";
import { DataTable } from "@/components/tables/datatable";

const Transaction = () => {
  const queryClient = useQueryClient();
  const { customDispatch } =useCustomContext()
  const { user } =useAuth()

  // Client-mode DataTable state.
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState(null);

  const transactions = useQuery({
    queryKey: ["prepaid-transaction-email", user?.email, user?.phonenumber],
    queryFn: () => getTransactionByEmail(user?.email, user?.phonenumber),
    // Was commented out, so this fired immediately on mount with
    // `undefined, undefined` before `user` had loaded. Re-enabled.
    enabled: !!user?.email && !!user?.phonenumber,
  });

  const transactionData = transactions.data ?? [];

  const handleDownload = (downloadLink) => {
    // `download` attributes are generally ignored by browsers for
    // cross-origin URLs (which this almost certainly is), so the original
    // element quietly just opened a new tab regardless of the attribute —
    // and did so without `rel="noopener noreferrer"`, a real
    // reverse-tabnabbing gap on any target="_blank" link. window.open with
    // explicit noopener does the same thing safely.
    window.open(downloadLink, "_blank", "noopener,noreferrer");
  };

  const { isLoading: isRemoving, mutateAsync } = useMutation({
    mutationFn: removeAnyTransaction,
  });

  const removeTransaction = (id) => {
    Swal.fire({
      title: "Removing",
      text: "Do you want to remove transaction?",
      showCancelButton: true,
    }).then(({ isConfirmed }) => {
      if (!isConfirmed) return;
      mutateAsync([id], {
        onSettled: () => {
          queryClient.invalidateQueries({
            queryKey: [
              "prepaid-transaction-email",
              user?.email,
              user?.phonenumber,
            ],
          });
        },
        onSuccess: () => {
          customDispatch(globalAlertType("info", "Transaction Removed!"));
        },
        onError: () => {
          customDispatch(
            globalAlertType(
              "error",
              "Failed to remove transaction! An error has occurred!",
            ),
          );
        },
      });
    });
  };

  const modifiedColumns = [
    ...transactionsColumns,
    {
      field: "actions",
      headerName: "Action",
      sortable: false,
      hideable: false,
      exportable: false,
      align: "right",
      renderCell: (row) => (
        <ActionMenu>
          {row?.status === "completed" && (
            <MenuItem
              sx={{ fontSize: 13 }}
              onClick={() => handleDownload(row?.downloadLink)}
            >
              Download
            </MenuItem>
          )}
          <MenuItem
            sx={{ fontSize: 13 }}
            onClick={() => removeTransaction(row?._id)}
          >
            Remove
          </MenuItem>
        </ActionMenu>
      ),
    },
  ];

  return (
    <Container sx={{ py: 2 }}>
      <CustomTitle
        icon={<NoteAlt sx={{ width: 50, height: 50 }} color="primary" />}
        title="Transactions"
        subtitle="Manage all your transactions made."
      />
      <DataTable
        mode="client"
        title="Transactions"
        columns={modifiedColumns}
        data={transactionData}
        // This API returns Mongo-style `_id`, not `id` — DataTable's
        // default getRowId looks for `row.id`, which would be undefined
        // for every row here and break selection/row keys.
        getRowId={(row) => row._id}
        loading={transactions.isLoading}
        // A delete in flight no longer blanks the whole table into a
        // skeleton — it only shows the slim top progress bar, so the rows
        // you're not touching stay visible.
        fetching={transactions.isFetching || isRemoving}
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
        exportFileName="transactions"
        emptyState={{ title: "No transactions available" }}
      />
    </Container>
  );
};

export default Transaction;