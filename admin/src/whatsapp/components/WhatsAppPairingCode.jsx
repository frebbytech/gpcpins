import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";
import { useCountdown } from "../hooks/useCountdown";
import { Steps } from "./Steps";

function formatRemaining(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function Cell({ children }) {
  return (
    <Box
      component="span"
      sx={{
        flex: { xs: 1, sm: "none" },
        width: { sm: 48 },
        minWidth: 0,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "action.hover",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 24,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </Box>
  );
}

/**
 * @param {{ code: string, expiresAt: string, onCancel: () => void, cancelling?: boolean }} props
 */
export function WhatsAppPairingCode({ code, expiresAt, onCancel, cancelling }) {
  const chars = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().split("");
  const remaining = useCountdown(expiresAt);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef();

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(chars.join(""));
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard can be blocked; the code is on screen to type instead. */
    }
  }

  const half = Math.ceil(chars.length / 2);
  const cells = (list, offset) => list.map((c, i) => <Cell key={offset + i}>{c}</Cell>);

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Box>
        <Typography variant="subtitle1" component="h2" fontWeight={600}>
          Enter this code in WhatsApp
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {remaining > 0 ? `Expires in ${formatRemaining(remaining)}.` : "Expiring…"}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
        <Box
          role="img"
          aria-label={`Pairing code: ${chars.join(" ")}`}
          sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 }, width: { xs: "100%", sm: "auto" } }}
        >
          {cells(chars.slice(0, half), 0)}
          <Box aria-hidden="true" sx={{ mx: 0.5, width: { xs: 8, sm: 12 }, height: 2, flexShrink: 0, borderRadius: 1, bgcolor: "divider" }} />
          {cells(chars.slice(half), half)}
        </Box>
        <Button variant="outlined" color="inherit" onClick={copy}>
          {copied ? "Copied" : "Copy code"}
        </Button>
      </Box>

      <Steps>
        <>Open WhatsApp on your phone.</>
        <>
          Go to <strong>Settings</strong> → <strong>Linked devices</strong> → <strong>Link a device</strong>.
        </>
        <>
          Tap <strong>Link with phone number instead</strong>.
        </>
        <>Type the code above.</>
      </Steps>

      <Box>
        <Button variant="outlined" color="inherit" onClick={onCancel} disabled={cancelling}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
