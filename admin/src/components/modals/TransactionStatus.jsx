import {
  Dialog,
  DialogContent,
  Stack,
  CircularProgress,
  Button,
  Paper,
  Typography,
  Chip,
  Divider,
  Box,
  alpha,
  useTheme,
  IconButton,
  Grid,
} from "@mui/material";
import {
  Close as CloseIcon,
  CheckCircle,
  Cancel,
  Receipt,
  AttachMoney,
  Payment,
  Info,
  CalendarToday,
} from "@mui/icons-material";
import moment from "moment";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getTransactionStatus } from "../../api/transactionAPI";
import { currencyFormatter } from "../../constants";

function TransactionStatus() {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const open = searchParams.get("open");
  const reference = searchParams.get("payment_reference");
  const type = searchParams.get("type");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["transaction-status", reference],
    queryFn: () => getTransactionStatus(reference, type),
    enabled: !!open && !!reference && !!type,
  });

  const handleClose = () => {
    setSearchParams((params) => {
      params.delete("open");
      params.delete("type");
      params.delete("payment_reference");
      return params;
    });
  };

  const isWalletOrPrepaid = type === "wallet" || type === "prepaid";

  // Helper to get status chip color
  const getStatusColor = (status) => {
    if (!status) return "default";
    const lower = status.toLowerCase();
    if (
      lower.includes("paid") ||
      lower.includes("success") ||
      lower.includes("successful")
    )
      return "success";
    if (lower.includes("pending")) return "warning";
    if (lower.includes("failed") || lower.includes("error")) return "error";
    return "default";
  };

  // Format status label
  const getStatusLabel = (status) => {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  co

  return (
    <Dialog
      maxWidth="sm"
      fullWidth
      open={Boolean(open)}
      onClose={handleClose}
      PaperProps={{
        elevation: 8,
        sx: {
          borderRadius: 1.2,
          overflow: "hidden",
          background: theme.palette.background.paper,
          boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.15)}`,
        },
      }}
    >
      {/* Custom Header */}
      <Box
        sx={{
          p: 3,
          pb: 1.5,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "common.white",
              }}
            >
              <Receipt fontSize="small" />
            </Box>
            <Typography variant="h6" fontWeight="700" letterSpacing={-0.5}>
              Transaction Status
            </Typography>
          </Stack>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{
              color: "text.secondary",
              bgcolor: alpha(theme.palette.common.black, 0.04),
              "&:hover": { bgcolor: alpha(theme.palette.common.black, 0.08) },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {/* Loading State */}
        {isLoading && (
          <Stack alignItems="center" spacing={2} py={4}>
            <CircularProgress size={48} />
            <Typography variant="body2" color="text.secondary">
              Checking transaction status...
            </Typography>
          </Stack>
        )}

        {/* Error State */}
        {isError && (
          <Paper
            sx={{
              p: 3,
              textAlign: "center",
              borderRadius: 1.2,
              // border: `1px solid ${theme.palette.error.main}`,
            }}
          >
            <Cancel sx={{ fontSize: 48, color: "error.main", mb: 2 }} />
            <Typography variant="h6" color="error" gutterBottom>
              {error?.message || "Transaction not found"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error?.message ||
                "Transaction status could not be retrieved. Please try again later."}
            </Typography>
            <Button variant="contained" onClick={refetch} sx={{ mt: 2,borderRadius: 1.2 }}>
              Retry
            </Button>
          </Paper>
        )}

        {/* Success Data */}
        {!isLoading && !isError && data && (
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 1.2,
              bgcolor: alpha(theme.palette.background.default, 0.6),
              borderColor: alpha(theme.palette.divider, 0.6),
            }}
          >
            <Stack spacing={2.5}>
              {/* Status Chip */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="subtitle1" fontWeight="bold">
                  Status
                </Typography>
                <Chip
                  label={getStatusLabel(data.status)}
                  color={getStatusColor(data.status)}
                  icon={
                    data.status?.toLowerCase().includes("success") ? (
                      <CheckCircle />
                    ) : (
                      <Cancel />
                    )
                  }
                  sx={{ fontWeight: 600 }}
                />
              </Stack>

              <Divider />

              {/* Details Grid */}
              <Grid container spacing={1.5}>
                {isWalletOrPrepaid ? (
                  <>
                    <Grid item xs={12}>
                      <DetailItem
                        icon={Info}
                        label="Message"
                        value={data.message}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={Info}
                        label="Approval Code"
                        value={data.institutionApprovalCode}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={Receipt}
                        label="Transaction ID"
                        value={data.transactionId}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <DetailItem
                        icon={Receipt}
                        label="External Transaction ID"
                        value={data.extralTransactionId}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <DetailItem
                        icon={Receipt}
                        label="Reason"
                        value={data.reason || "N/A"}
                      />
                    </Grid>
                  </>
                ) : (
                  <>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={Info}
                        label="Message"
                        value={data.message}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={CalendarToday}
                        label="Date"
                        value={
                          data.date ? moment(data.date).format("LLL") : "N/A"
                        }
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={Receipt}
                        label="Transaction ID"
                        value={data.transactionId}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={Receipt}
                        label="External ID"
                        value={data.externalTransactionId}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={Payment}
                        label="Payment Method"
                        value={data.paymentMethod}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <DetailItem
                        icon={Receipt}
                        label="Client Reference"
                        value={data.clientReference}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={Info}
                        label="Currency"
                        value={data.currencyCode}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={AttachMoney}
                        label="Amount"
                        value={currencyFormatter(data.amount)}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={AttachMoney}
                        label="Charges"
                        value={currencyFormatter(data.charges)}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailItem
                        icon={AttachMoney}
                        label="Amount After Charges"
                        value={currencyFormatter(data.amountAfterCharges)}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </Stack>
          </Paper>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper component for detail rows
const DetailItem = ({ label, value }) => (
  <Stack spacing={0.5}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ fontWeight: 500 }}
    >
      {label}
    </Typography>
    <Typography variant="body2" fontWeight="500">
      {value || "N/A"}
    </Typography>
  </Stack>
);

export default TransactionStatus;

// import {
//   Dialog,
//   DialogContent,
//   Stack,
//   CircularProgress,
//   Button,
//   Paper,
//   Typography,
//   Chip,
//   Divider,
//   Box,
//   alpha,
//   useTheme,
//   IconButton,
//   Grid,
// } from "@mui/material";
// import { Close as CloseIcon, CheckCircle, Cancel, Receipt, AttachMoney, Payment, Info, CalendarToday } from "@mui/icons-material";
// import moment from "moment";
// import { useSearchParams } from "react-router-dom";
// import { useQuery } from "@tanstack/react-query";
// import { getTransactionStatus } from "../../api/transactionAPI";
// import { currencyFormatter } from "../../constants";

// function TransactionStatus() {
//   const theme = useTheme();
//   const [searchParams, setSearchParams] = useSearchParams();

//   const open = searchParams.get("open");
//   const reference = searchParams.get("payment_reference");
//   const type = searchParams.get("type");

//   const { data, isLoading, isError, error,refetch } = useQuery({
//     queryKey: ["transaction-status", reference],
//     queryFn: () => getTransactionStatus(reference, type),
//     enabled: !!open && !!reference && !!type,
//   });

//   const handleClose = () => {
//     setSearchParams((params) => {
//       params.delete("open");
//       params.delete("type");
//       params.delete("payment_reference");
//       return params;
//     });
//   };

//   // Helper to get status chip color
//   const getStatusColor = (status) => {
//     if (!status) return "default";
//     const lower = status.toLowerCase();
//     if (lower.includes("paid") || lower.includes("success")) return "success";
//     if (lower.includes("pending")) return "warning";
//     if (lower.includes("failed") || lower.includes("error")) return "error";
//     return "default";
//   };

//   return (
//     <Dialog
//       maxWidth="sm"
//       fullWidth
//       open={Boolean(open)}
//       onClose={handleClose}
//       PaperProps={{
//         elevation: 8,
//         sx: {
//           borderRadius: 1.2,
//           overflow: "hidden",
//           background: theme.palette.background.paper,
//           boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.15)}`,
//         },
//       }}
//     >
//       {/* Custom Header */}
//       <Box
//         sx={{
//           p: 3,
//           pb: 1.5,
//           background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
//           borderBottom: `1px solid ${theme.palette.divider}`,
//         }}
//       >
//         <Stack direction="row" alignItems="center" justifyContent="space-between">
//           <Stack direction="row" alignItems="center" spacing={1.5}>
//             <Box
//               sx={{
//                 width: 40,
//                 height: 40,
//                 borderRadius: "50%",
//                 bgcolor: "primary.main",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 color: "common.white",
//               }}
//             >
//               <Receipt fontSize="small" />
//             </Box>
//             <Typography variant="h6" fontWeight="700" letterSpacing={-0.5}>
//               Transaction Status
//             </Typography>
//           </Stack>
//           <IconButton
//             onClick={handleClose}
//             size="small"
//             sx={{
//               color: "text.secondary",
//               bgcolor: alpha(theme.palette.common.black, 0.04),
//               "&:hover": { bgcolor: alpha(theme.palette.common.black, 0.08) },
//             }}
//           >
//             <CloseIcon fontSize="small" />
//           </IconButton>
//         </Stack>
//       </Box>

//       <DialogContent sx={{ p: 3 }}>
//         {/* Loading State */}
//         {isLoading && (
//           <Stack alignItems="center" spacing={2} py={4}>
//             <CircularProgress size={48} />
//             <Typography variant="body2" color="text.secondary">
//               Checking transaction status...
//             </Typography>
//           </Stack>
//         )}

//         {/* Error State */}
//         {isError && (
//           <Paper
//             sx={{
//               p: 3,
//               textAlign: "center",
//               borderRadius: 1.2,
//               border: `1px solid ${theme.palette.error.main}`,
//             }}
//           >
//             <Cancel sx={{ fontSize: 48, color: "error.main", mb: 2 }} />
//             <Typography variant="h6" color="error" gutterBottom>
//               Failed to fetch status
//             </Typography>
//             <Typography variant="body2" color="text.secondary">
//               {error?.message || "An unexpected error occurred."}
//             </Typography>
//             <Button variant="contained" onClick={refetch} sx={{ mt: 2 }}>
// Retry            </Button>
//           </Paper>
//         )}

//         {/* Success Data */}
//         {!isLoading && !isError && data && (
//           <Paper
//             variant="outlined"
//             sx={{
//               p: 2.5,
//               borderRadius: 1.2,
//               bgcolor: alpha(theme.palette.background.default, 0.6),
//               borderColor: alpha(theme.palette.divider, 0.6),
//             }}
//           >
//             <Stack spacing={2.5}>
//               {/* Status Chip */}
//               <Stack direction="row" justifyContent="space-between" alignItems="center">
//                 <Typography variant="subtitle1" fontWeight="bold">
//                   Status
//                 </Typography>
//                 <Chip
//                   label={data?.status || "Unknown"}
//                   color={getStatusColor(data?.status)}
//                   icon={data?.status?.toLowerCase().includes("paid") ? <CheckCircle /> : <Cancel />}
//                   sx={{ fontWeight: 600 }}
//                 />
//               </Stack>

//               <Divider />

//               {/* Details Grid */}
//               <Grid container spacing={1.5}>
//                 <Grid item xs={6}>
//                   <DetailItem icon={Info} label="Message" value={data?.message} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={CalendarToday} label="Date" value={moment(data?.date).format("LLL")} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={Receipt} label="Transaction ID" value={data?.transactionId} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={Receipt} label="External ID" value={data?.externalTransactionId} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={Payment} label="Payment Method" value={data?.paymentMethod} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={Receipt} label="Client Reference" value={data?.clientReference} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={Info} label="Currency" value={data?.currencyCode} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={AttachMoney} label="Amount" value={currencyFormatter(data?.amount)} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={AttachMoney} label="Charges" value={currencyFormatter(data?.charges)} />
//                 </Grid>
//                 <Grid item xs={6}>
//                   <DetailItem icon={AttachMoney} label="Amount After Charges" value={currencyFormatter(data?.amountAfterCharges)} />
//                 </Grid>
//               </Grid>
//             </Stack>
//           </Paper>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// }

// // Helper component for detail rows
// const DetailItem = ({  label, value }) => (
//   <Stack spacing={0.5}>
//     <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
//       {label}
//     </Typography>
//     <Typography variant="body2" fontWeight="500">
//       {value || "N/A"}
//     </Typography>
//   </Stack>
// );

// export default TransactionStatus;
