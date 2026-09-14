import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowDownward,
  ArrowUpward,
  AttachFile,
  CalendarMonth,
  Check,
  Close,
  Comment as CommentIcon,
  ContentCopy,
  Person,
  Tag,
} from "@mui/icons-material";
import { format } from "date-fns";
import { currencyFormatter } from "@/constants";

const TYPE_THEME = {
  credit: {
    label: "Credit",
    direction: "Money In",
    gradient: "linear-gradient(135deg, #1b5e20 0%, #43a047 100%)",
    Icon: ArrowDownward,
  },
  debit: {
    label: "Debit",
    direction: "Money Out",
    gradient: "linear-gradient(135deg, #b71c1c 0%, #e53935 100%)",
    Icon: ArrowUpward,
  },
};

const STATUS_THEME = {
  completed: { label: "Completed", color: "#2e7d32" },
  pending: { label: "Pending", color: "#ed6c02" },
  failed: { label: "Failed", color: "#d32f2f" },
};

function DetailItem({ icon, label, value, copyValue }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      /* clipboard unavailable */
    }
  };

  return (
    <Box
      sx={{
        bgcolor: "grey.50",
        border: "1px solid",
        borderColor: "grey.200",
        borderRadius: 2,
        p: 1.75,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box component="span" sx={{ display: "inline-flex", color: "text.disabled" }}>
          {icon}
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "text.secondary",
          }}
        >
          {label}
        </Typography>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, wordBreak: "break-all", flex: 1 }}
        >
          {value ?? "N/A"}
        </Typography>
        {copyValue && (
          <Tooltip title={copied ? "Copied!" : "Copy"}>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? (
                <Check sx={{ fontSize: 16, color: "success.main" }} />
              ) : (
                <ContentCopy sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
}

function TransactionContent({ transaction, onClose }) {
  const isCredit = transaction.type === "credit";
  const theme = TYPE_THEME[transaction.type] ?? TYPE_THEME.debit;
  const status = STATUS_THEME[transaction.status] ?? {
    label: transaction.status ?? "N/A",
    color: "#757575",
  };
  const { Icon } = theme;

  return (
    <>
      {/* ---- Header ---- */}
      <Box
        sx={{
          position: "relative",
          background: theme.gradient,
          color: "#fff",
          px: 3,
          py: 3,
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            color: "#fff",
            bgcolor: "rgba(255,255,255,0.15)",
            "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
          }}
        >
          <Close fontSize="small" />
        </IconButton>

        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(255,255,255,0.2)",
              border: "2px solid rgba(255,255,255,0.35)",
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 30 }} />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ opacity: 0.85, letterSpacing: 1.5, lineHeight: 1.2, display: "block" }}
            >
              Wallet Transaction · {theme.direction}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {isCredit ? "+" : "-"} {currencyFormatter(Number(transaction.amount || 0))}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={theme.label}
                sx={{
                  color: "#fff",
                  bgcolor: "rgba(255,255,255,0.2)",
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              />
              <Chip
                size="small"
                label={status.label}
                sx={{
                  color: status.color,
                  bgcolor: "#fff",
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              />
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* ---- Body ---- */}
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          <Box sx={{ gridColumn: { sm: "span 2" } }}>
            <DetailItem
              icon={<Tag sx={{ fontSize: 15 }} />}
              label="Transaction ID"
              value={transaction.id}
              copyValue={transaction.id}
            />
          </Box>

          <DetailItem
            icon={<Person sx={{ fontSize: 15 }} />}
            label="Issued By"
            value={transaction.issuerName}
          />

          <DetailItem
            icon={<CalendarMonth sx={{ fontSize: 15 }} />}
            label="Date & Time"
            value={
              transaction.createdAt
                ? format(new Date(transaction.createdAt), "PPP p")
                : "N/A"
            }
          />

          <Box sx={{ gridColumn: { sm: "span 2" } }}>
            <DetailItem
              icon={<CommentIcon sx={{ fontSize: 15 }} />}
              label="Comment"
              value={transaction.comment}
            />
          </Box>

          <Box sx={{ gridColumn: { sm: "span 2" } }}>
            <DetailItem
              icon={<Tag sx={{ fontSize: 15 }} />}
              label="User ID"
              value={transaction.userId}
              copyValue={transaction.userId}
            />
          </Box>
        </Box>

        {transaction.attachment && (
          <Button
            variant="outlined"
            startIcon={<AttachFile />}
            href={transaction.attachment}
            target="_blank"
            rel="noreferrer"
            sx={{ mt: 2, textTransform: "none", borderRadius: 2 }}
          >
            View Attachment
          </Button>
        )}
      </Box>
    </>
  );
}

export default function WalletTransactionDetails({ open, transaction, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      {transaction && (
        <TransactionContent transaction={transaction} onClose={onClose} />
      )}
    </Dialog>
  );
}