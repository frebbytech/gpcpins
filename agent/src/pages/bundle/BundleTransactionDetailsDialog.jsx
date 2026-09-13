// src/pages/bundle/BundleTransactionDetailsDialog.jsx
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Stack,
  Grid,
  Chip,
  Divider,
  Box,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import moment from "moment";
import { currencyFormatter } from "../../constants";

const DetailRow = ({ label, value }) => (
  <Box sx={{ py: 0.5 }}>
    <Typography variant="caption" color="text.secondary" display="block">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight="medium">
      {value || "N/A"}
    </Typography>
  </Box>
);

const BundleTransactionDetailsDialog = ({ open, onClose, transaction }) => {
  if (!transaction) return null;

  const getStatusChip = () => {
    const status = transaction.status;
    let color = "default";
    if (status === "completed") color = "success";
    else if (status === "pending") color = "warning";
    else if (status === "failed") color = "error";
    else if (status === "refunded") color = "secondary";
    return <Chip label={status} color={color} size="small" sx={{ fontWeight: "bold" }} />;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Transaction Details</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <DetailRow label="Transaction ID" value={transaction.id} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Status
                </Typography>
                {getStatusChip()}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                label="Date"
                value={moment(transaction.createdAt).format("LLL")}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow label="Type" value={transaction.type} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow label="Recipient" value={transaction.recipient} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow label="Provider" value={transaction.provider} />
            </Grid>
            {transaction.info?.plan_name && (
              <Grid item xs={12} sm={6}>
                <DetailRow label="Bundle Name" value={transaction.info.plan_name} />
              </Grid>
            )}
            {transaction.info?.volume && (
              <Grid item xs={12} sm={6}>
                <DetailRow label="Volume" value={transaction.info.volume} />
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <DetailRow
                label="Amount"
                value={currencyFormatter(transaction.amount)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                label="Commission"
                value={currencyFormatter(transaction.commission)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                label="Payable Amount"
                value={currencyFormatter(transaction.amt)}
              />
            </Grid>
            <Grid item xs={12}>
              <DetailRow label="Payment Reference" value={transaction.reference} />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BundleTransactionDetailsDialog;