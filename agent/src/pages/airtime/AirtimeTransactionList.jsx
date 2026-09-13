// src/pages/airtime/AirtimeTransactionList.jsx
import {
  Box,
  Paper,
  Typography,
  Chip,
  Stack,
  IconButton,
  Divider,
} from "@mui/material";
import { Visibility } from "@mui/icons-material";
import moment from "moment";
import { currencyFormatter } from "../../constants";

const AirtimeTransactionList = ({ data, onView, isLoading }) => {
  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (!data || data.length === 0) {
    return <Typography textAlign="center">No transactions found.</Typography>;
  }

  return (
    <Stack spacing={2}>
      {data.map((tx) => (
        <Paper
          key={tx.id}
          variant="outlined"
          sx={{ p: 2, borderRadius: 2 }}
        >
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {moment(tx.createdAt).format("LLL")}
              </Typography>
              <Chip
                label={tx.status}
                size="small"
                color={
                  tx.status === "completed"
                    ? "success"
                    : tx.status === "pending"
                    ? "warning"
                    : tx.status === "failed"
                    ? "error"
                    : "default"
                }
                sx={{ color: "#fff" }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              ID: {tx.id}
            </Typography>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">
                {tx.type} • {tx.provider}
              </Typography>
              <Typography variant="body1" fontWeight="bold" color="primary">
                {currencyFormatter(tx.amount)}
              </Typography>
            </Stack>
            <Divider />
            <Stack direction="row" justifyContent="flex-end">
              <IconButton size="small" onClick={() => onView(tx)}>
                <Visibility fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};

export default AirtimeTransactionList;