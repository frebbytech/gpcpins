import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Typography,
  IconButton,
  Box,
  alpha,
  useTheme,
  Chip,
  // Divider,
  Button,
  Paper,
} from "@mui/material";
import {
  Close as CloseIcon,
  Receipt,
  AccountBalance,
  Person,
  Email,
  Phone,
  CalendarToday,
  AttachMoney,
  Info,
} from "@mui/icons-material";
import PropTypes from "prop-types";
import moment from "moment";
import _ from "lodash";
import { currencyFormatter } from "../../constants";

const DetailRow = ({ label, value, isChip }) => {
  const theme = useTheme();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      {/* {Icon && (
        <Box
          sx={{
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          }}
        >
          <Icon fontSize="small" />
        </Box>
      )} */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 120, fontWeight: 500, fontSize: 12 }}
      >
        {label}
      </Typography>
      {isChip ? (
        <Chip
          label={value}
          size="small"
          color={
            value === "completed"
              ? "success"
              : value === "pending"
                ? "warning"
                : "default"
          }
          variant="filled"
          sx={{ fontWeight: 600 }}
        />
      ) : (
        <Typography
          variant="body2"
          fontWeight="medium"
          sx={{ flex: 1, fontSize: 12 }}
        >
          {value || "N/A"}
        </Typography>
      )}
    </Stack>
  );
};

const TransactionPreviewDialog = ({
  open,
  onClose,
  transaction,
  onResend,
  onDownload,
  onCheckStatus,
}) => {
  const theme = useTheme();
  if (!transaction) return null;

  const {
    service,
    status,
    kind,
    recipient,
    amount,
    mode,
    reference,
    externalTransactionId,
    createdAt,

    issuerName,
    email,
    phonenumber,
    voucherType,
    meter,
    downloadLink,
    id,
  } = transaction;

  // const isCompleted = status === "completed";
  // const isPending = status === "pending";
  // const isRefunded = status === "refunded";

  // Determine recipient display
  let recipientDisplay = "";
  if (service === "airtime") {
    if (kind === "bulk") {
      try {
        const recipients = JSON.parse(recipient || "[]");
        recipientDisplay = recipients
          .map((r) => `${r.recipient} (${currencyFormatter(r.price)})`)
          .join(", ");
      } catch {
        recipientDisplay = recipient;
      }
    } else {
      recipientDisplay = recipient;
    }
  } else if (service === "prepaid") {
    recipientDisplay = meter || recipient;
  } else {
    recipientDisplay = voucherType || recipient;
  }
  // console.log(service);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
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
      <DialogTitle
        sx={{
          p: 3,
          pb: 1.5,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.main,
            0.06,
          )} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
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
                bgcolor: "secondary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "common.white",
              }}
            >
              <Receipt fontSize="small" />
            </Box>
            <Typography variant="h6" fontWeight="700" letterSpacing={-0.5}>
              Transaction Details
            </Typography>
          </Stack>
          <IconButton
            onClick={onClose}
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
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 2.5, overflowX: "hidden" }}>
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 1.2,
            bgcolor: alpha(theme.palette.background.default, 0.6),
            borderColor: alpha(theme.palette.divider, 0.6),
            mt: 2,
          }}
        >
          <Stack spacing={0.5}>
            <DetailRow icon={Info} label="Transaction ID" value={id} />
            <DetailRow
              icon={CalendarToday}
              label="Date"
              value={moment(createdAt).format("LLL")}
            />
            <DetailRow icon={Info} label="Status" value={status} isChip />
            <DetailRow
              icon={Info}
              label="Service"
              value={_.capitalize(service)}
            />
            <DetailRow
              icon={Person}
              label={service === "airtime" ? "Recipient" : "Category"}
              value={recipientDisplay || "N/A"}
            />
            {kind && <DetailRow icon={Info} label="Kind" value={kind} />}

            <DetailRow
              icon={AttachMoney}
              label="Amount"
              value={currencyFormatter(amount)}
            />
            <DetailRow
              icon={AccountBalance}
              label="Payment Method"
              value={mode || "N/A"}
            />
            <DetailRow
              icon={Info}
              label="Reference"
              value={reference || "N/A"}
            />
            {externalTransactionId && (
              <DetailRow
                icon={Info}
                label="External ID"
                value={externalTransactionId}
              />
            )}

            <DetailRow icon={Email} label="Email" value={email || "N/A"} />
            <DetailRow
              icon={Phone}
              label="Phone"
              value={phonenumber || "N/A"}
            />

            <DetailRow
              icon={Person}
              label="Issuer"
              value={issuerName || "N/A"}
            />
          </Stack>
        </Paper>
      </DialogContent>

      <DialogActions
        sx={{
          p: 3,
          gap: 1,
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.background.default, 0.4),
          flexWrap: "wrap",
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
          sx={{ borderRadius: 1.2, textTransform: "none", fontWeight: 600 }}
        >
          Close
        </Button>
        {service === "voucher" && status === "completed" && (
          <>
            <Button
              variant="contained"
              color="primary"
              onClick={() => onResend && onResend({ id, service, phonenumber })}
              sx={{ borderRadius: 1.2, textTransform: "none", fontWeight: 600 }}
            >
              Resend
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => onDownload && onDownload(id, downloadLink)}
              sx={{ borderRadius: 1.2, textTransform: "none", fontWeight: 600 }}
            >
              Download
            </Button>
          </>
        )}
        {mode === "Mobile Money" && (
          <Button
            variant="contained"
            color="info"
            onClick={() =>
              onCheckStatus &&
              onCheckStatus(service === "prepaid" ? id : reference, service)
            }
            sx={{ borderRadius: 1.2, textTransform: "none", fontWeight: 600 }}
          >
            Check Status
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

TransactionPreviewDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  transaction: PropTypes.object,
  onResend: PropTypes.func,
  onDownload: PropTypes.func,
  onCheckStatus: PropTypes.func,
};

export default TransactionPreviewDialog;
