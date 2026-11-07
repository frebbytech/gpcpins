import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/system";
import { QRCodeSVG } from "qrcode.react";
import { Steps } from "./Steps";

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

/** One viewfinder corner. */
function Corner({ sx }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{ display: "block", position: "absolute", width: 24, height: 24, borderColor: "primary.main", borderStyle: "solid", borderWidth: 0, ...sx }}
    />
  );
}

/**
 * @param {{ qr: string, onCancel: () => void, cancelling?: boolean }} props
 * `qr` is the raw string from the service; the image is drawn here, in the browser.
 */
export function WhatsAppQRCode({ qr, onCancel, cancelling }) {
  return (
    <Box sx={{ display: "grid", alignItems: "center", gap: 4, gridTemplateColumns: { xs: "1fr", sm: "auto 1fr" } }}>
      <Box component="figure" sx={{ position: "relative", m: "0 auto", p: 3, width: "100%", maxWidth: 280 }}>
        <Corner sx={{ left: 0, top: 0, borderTopLeftRadius: 12, borderLeftWidth: 2, borderTopWidth: 2 }} />
        <Corner sx={{ right: 0, top: 0, borderTopRightRadius: 12, borderRightWidth: 2, borderTopWidth: 2 }} />
        <Corner sx={{ left: 0, bottom: 0, borderBottomLeftRadius: 12, borderLeftWidth: 2, borderBottomWidth: 2 }} />
        <Corner sx={{ right: 0, bottom: 0, borderBottomRightRadius: 12, borderRightWidth: 2, borderBottomWidth: 2 }} />
        {/* Always dark-on-white, even in dark mode: phones need the contrast to scan. */}
        <Box sx={{ bgcolor: "#fff", p: 1.5, borderRadius: 1 }}>
          <QRCodeSVG
            value={qr}
            size={232}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#0a0a0a"
            title="WhatsApp link QR code"
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </Box>
      </Box>

      <Box sx={{ display: "grid", gap: 2.5 }}>
        <Box>
          <Typography variant="subtitle1" component="h2" fontWeight={600}>
            Scan this code with your phone
          </Typography>
          <Box sx={{ mt: 0.5, display: "flex", alignItems: "flex-start", gap: 1, color: "text.secondary", typography: "body2" }}>
            <Box
              aria-hidden="true"
              sx={{
                mt: "7px",
                width: 8,
                height: 8,
                flexShrink: 0,
                borderRadius: "50%",
                bgcolor: "success.main",
                "@media (prefers-reduced-motion: no-preference)": { animation: `${pulse} 1.4s ease-in-out infinite` },
              }}
            />
            The code refreshes on its own. Keep this page open.
          </Box>
        </Box>
        <Steps>
          <>Open WhatsApp on your phone.</>
          <>
            Go to <strong>Settings</strong> → <strong>Linked devices</strong>.
          </>
          <>
            Tap <strong>Link a device</strong> and point your camera here.
          </>
        </Steps>
        <Box>
          <Button variant="outlined" color="inherit" onClick={onCancel} disabled={cancelling}>
            Cancel
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
