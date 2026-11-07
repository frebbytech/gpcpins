import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/system";

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

const STATES = {
  idle: { label: "Not connected", tone: "idle" },
  creating: { label: "Connecting", tone: "busy" },
  connecting: { label: "Connecting", tone: "busy" },
  qr_ready: { label: "Waiting for scan", tone: "busy" },
  pairing_code_ready: { label: "Waiting for code", tone: "busy" },
  authenticating: { label: "Linking device", tone: "busy" },
  connected: { label: "Connected", tone: "ok" },
  reconnecting: { label: "Reconnecting", tone: "busy" },
  disconnected: { label: "Disconnected", tone: "idle" },
  logged_out: { label: "Logged out", tone: "idle" },
  failed: { label: "Connection failed", tone: "bad" },
};

const DOT_COLOR = {
  ok: "success.main",
  busy: "warning.main",
  idle: "text.disabled",
  bad: "error.main",
};

/**
 * Status pill. Also a live region, so screen readers announce changes.
 * @param {{ status: string, phoneNumber?: string | null }} props
 */
export function WhatsAppStatus({ status, phoneNumber }) {
  const { label, tone } = STATES[status] ?? STATES.idle;
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        border: 1,
        borderColor: "divider",
        borderRadius: 999,
        bgcolor: "background.paper",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: DOT_COLOR[tone],
          "@media (prefers-reduced-motion: no-preference)": tone === "busy" ? { animation: `${pulse} 1.4s ease-in-out infinite` } : {},
        }}
      />
      <Typography component="span" variant="body2" fontWeight={500}>
        {label}
      </Typography>
      {status === "connected" && phoneNumber ? (
        <Typography component="span" variant="body2" color="text.secondary">
          +{phoneNumber}
        </Typography>
      ) : null}
    </Box>
  );
}
