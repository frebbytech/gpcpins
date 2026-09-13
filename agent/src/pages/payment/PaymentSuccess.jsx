import { CheckCircleOutlineRounded, CheckRounded, ContentCopy } from "@mui/icons-material";
import { Alert, Box, Button, IconButton, InputAdornment, Paper, Stack, OutlinedInput, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

function PaymentSuccess() {
  const { state } = useLocation();
  const [copied, setCopied] = useState(false);

  // Fallback string if id is missing in location state
  const transactionId = state?.id || "TXN-849204810";

  const handleCopyTransactionId = async () => {
    if (!transactionId) return;
    try {
      await navigator.clipboard.writeText(transactionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",

      }}
    >
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 540,
          width: "100%",
          p: { xs: 3, sm: 5 },
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0px 8px 32px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Animated-style Icon Badge */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: "success.lighter",
            color: "success.main",
            mb: 3,
            // Fallback soft color if custom theme palette lighter isn't built out
            backgroundColor: "rgba(46, 125, 50, 0.08)" 
          }}
        >
          <CheckCircleOutlineRounded sx={{ fontSize: 48 }} />
        </Box>

        {/* Success Messages */}
        <Typography variant="h5" fontWeight={700} color="text.primary" gutterBottom>
          Payment Successful!
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, px: 2 }}>
          Your request has been processed. You will be notified via email/sms shortly after your transaction is settled.
        </Typography>

        {/* Copy to Clipboard Field */}
        <Stack width="100%" spacing={1.5} sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              TRANSACTION ID
            </Typography>
          </Box>
          <OutlinedInput
            size="small"
            readOnly
            value={transactionId}
            fullWidth
            endAdornment={
              <InputAdornment position="end">
                <Tooltip title={copied ? "Copied!" : "Copy ID"}>
                  <IconButton
                    onClick={handleCopyTransactionId}
                    edge="end"
                    color={copied ? "success" : "default"}
                    size="small"
                  >
                    {copied ? <CheckRounded fontSize="small" /> : <ContentCopy fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            }
            sx={{
              bgcolor: "grey.50",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              borderRadius: 2,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "grey.200" },
            }}
          />
        </Stack>

        {/* Inline Recommendation Alert */}
        <Alert
          severity="info"
          variant="outlined"
          sx={{
            width: "100%",
            borderRadius: 2,
            textAlign: "left",
            fontSize: "0.75rem",
            mb: 4,
            borderColor: "info.light",
            bgcolor: "rgba(2, 136, 209, 0.02)"
          }}
        >
          We highly recommend keeping a copy of this confirmation code for your private accounting records.
        </Alert>

        {/* Primary Action Button */}
        <Button
          component={Link}
          to="/"
          variant="contained"
          fullWidth
          disableElevation
          sx={{
            py: 1.5,
            borderRadius: 1.2,
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.95rem",
            boxShadow: "none",
          }}
        >
          Return to Home
        </Button>
      </Paper>
    </Box>
  );
}

export default PaymentSuccess;
