import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useState } from "react";

/**
 * Disconnect keeps the phone linked. Log out removes the link, so it asks first.
 * @param {{ onDisconnect: () => void, onLogout: () => void, busy?: boolean }} props
 */
export function WhatsAppDisconnect({ onDisconnect, onLogout, busy }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <Alert
        severity="error"
        variant="outlined"
        role="group"
        aria-label="Confirm log out"
        icon={false}
        sx={{ alignItems: "flex-start" }}
      >
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>Log out of WhatsApp?</strong> This removes the link from your phone. You’ll need to scan or enter a code
          again to reconnect.
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button
            variant="contained"
            color="error"
            onClick={onLogout}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Log out
          </Button>
          <Button variant="outlined" color="inherit" onClick={() => setConfirming(false)} disabled={busy}>
            Keep linked
          </Button>
        </Box>
      </Alert>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onDisconnect}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Disconnect
        </Button>
        <Button variant="outlined" color="inherit" onClick={() => setConfirming(true)} disabled={busy}>
          Log out…
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary">
        Disconnect pauses WhatsApp here; your phone stays linked, so you can reconnect without scanning.
      </Typography>
    </Box>
  );
}
