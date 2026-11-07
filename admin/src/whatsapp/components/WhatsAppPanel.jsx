import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useWhatsApp } from "../hooks/useWhatsApp";
import { AccountLabelField, EMPTY_DRAFT, WhatsAppConnect } from "./WhatsAppConnect";
import { WhatsAppAccounts } from "./WhatsAppAccounts";
import { WhatsAppDisconnect } from "./WhatsAppDisconnect";
import { WhatsAppPairingCode } from "./WhatsAppPairingCode";
import { WhatsAppQRCode } from "./WhatsAppQRCode";
import { WhatsAppStatus } from "./WhatsAppStatus";

const PROGRESS_COPY = {
  creating: { title: "Connecting to WhatsApp…", detail: "This usually takes a few seconds." },
  connecting: { title: "Connecting to WhatsApp…", detail: "This usually takes a few seconds." },
  authenticating: { title: "Linking your device…", detail: "Keep WhatsApp open on your phone." },
  reconnecting: { title: "Reconnecting to WhatsApp…", detail: "Your link is saved, so there's nothing to scan." },
  qr_ready: { title: "Preparing your code…", detail: "This usually takes a few seconds." },
  pairing_code_ready: { title: "Preparing your code…", detail: "This usually takes a few seconds." },
};

/** What to tell the user about the last attempt, from the event notice or the saved state. */
function describeProblem(status, notice, expired) {
  if (expired && notice) return { tone: "warn", title: "Code expired", message: notice.message };
  if (notice) return { tone: "error", title: "Couldn't connect", message: notice.message };
  if (status.status === "failed") {
    return {
      tone: "error",
      title: "Connection failed",
      message: "WhatsApp couldn't be reached after several tries. Connect again to retry.",
    };
  }
  if (status.status === "logged_out") {
    return {
      tone: "warn",
      title: "Logged out of WhatsApp",
      message: "WhatsApp ended this session. Link your device again to continue.",
    };
  }
  return undefined;
}

function Progress({ title, detail, onCancel }) {
  return (
    <Box aria-busy="true" sx={{ display: "grid", gap: 2, justifyItems: "start" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <CircularProgress size={20} />
        <Box>
          <Typography fontWeight={500}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {detail}
          </Typography>
        </Box>
      </Box>
      {onCancel ? (
        <Button variant="outlined" color="inherit" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </Box>
  );
}

/**
 * The whole WhatsApp connection screen: status, QR / pairing-code linking, reconnect,
 * disconnect, log out and account switching. Must be rendered inside <WhatsAppProvider>.
 *
 * @param {{ title?: string, description?: string, onConnected?: (phoneNumber: string | null) => void }} [props]
 */
export function WhatsAppPanel({
  title = "WhatsApp",
  description = "Link your WhatsApp account to send and receive messages from this app.",
}) {
  const wa = useWhatsApp();
  const [method, setMethod] = useState("qr");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [label, setLabel] = useState("");
  const { status } = wa;

  let body;

  if (wa.isLoading) {
    body = (
      <Box aria-busy="true" aria-label="Loading WhatsApp status" sx={{ display: "grid", gap: 1.5 }}>
        <Skeleton variant="text" width="33%" />
        <Skeleton variant="rounded" height={40} />
      </Box>
    );
  } else if (wa.loadError && !status.hasSession) {
    body = (
      <Box sx={{ display: "grid", gap: 2, justifyItems: "start" }}>
        <Box role="alert">
          <Typography fontWeight={500}>Couldn’t load your WhatsApp connection</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {wa.loadError.message}
          </Typography>
        </Box>
        <Button variant="outlined" color="inherit" onClick={() => void wa.refetch()}>
          Try again
        </Button>
      </Box>
    );
  } else if (status.status === "connected") {
    body = (
      <Box sx={{ display: "grid", gap: 3 }}>
        <Box>
          <Typography variant="subtitle1" component="h2" fontWeight={600}>
            WhatsApp is connected
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {status.phoneNumber ? `Linked as +${status.phoneNumber}.` : "Your account is linked."}
          </Typography>
        </Box>
        <WhatsAppDisconnect onDisconnect={wa.disconnect} onLogout={wa.logout} busy={wa.stopping} />
      </Box>
    );
  } else if (status.status === "qr_ready" && status.qr) {
    body = <WhatsAppQRCode qr={status.qr.qr} onCancel={wa.disconnect} cancelling={wa.stopping} />;
  } else if (status.status === "pairing_code_ready" && status.pairingCode) {
    body = (
      <WhatsAppPairingCode
        code={status.pairingCode.code}
        expiresAt={status.pairingCode.expiresAt}
        onCancel={wa.disconnect}
        cancelling={wa.stopping}
      />
    );
  } else if (wa.starting && !PROGRESS_COPY[status.status]) {
    body = (
      <Progress
        title={method === "pairing" ? "Requesting your pairing code…" : "Preparing your QR code…"}
        detail="This usually takes a few seconds."
      />
    );
  } else if (PROGRESS_COPY[status.status]) {
    body = <Progress {...PROGRESS_COPY[status.status]} onCancel={wa.stopping ? undefined : wa.disconnect} />;
  } else {
    const canReconnect = status.authStatus === "linked" && (status.status === "disconnected" || status.status === "failed");
    body = (
      <WhatsAppConnect
        method={method}
        onMethodChange={setMethod}
        onStartQr={() => wa.startQr(label)}
        onStartPairing={(phone) => wa.startPairing(phone, label)}
        onReconnect={canReconnect ? wa.reconnect : undefined}
        problem={describeProblem(status, wa.notice, wa.expired)}
        expired={wa.expired}
        busy={wa.starting}
        draft={draft}
        onDraftChange={setDraft}
      />
    );
  }

  return (
    <Box component="section" aria-labelledby="whatsapp-title" sx={{ mx: "auto", width: "100%", maxWidth: 672 }}>
      <Box sx={{ mb: 3, display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box>
          <Typography id="whatsapp-title" variant="h5" component="h1" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        </Box>
        {wa.isLoading ? null : <WhatsAppStatus status={status.status} phoneNumber={status.phoneNumber} />}
      </Box>

      <WhatsAppAccounts
        accounts={wa.accounts}
        activeId={wa.activeAccountId}
        adding={wa.adding}
        canAdd={wa.canAddAccount}
        max={wa.maxAccounts}
        onSelect={wa.selectAccount}
        onAdd={() => {
          setLabel("");
          wa.startAdding();
        }}
        onCancelAdd={wa.cancelAdding}
        onRename={(id, name) => wa.renameAccount({ accountId: id, label: name })}
        onRemove={wa.removeAccount}
        busy={wa.renaming || wa.removing}
      />

      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3 }}>
        {wa.adding && !wa.starting ? <AccountLabelField value={label} onChange={setLabel} /> : null}
        {body}
      </Paper>

      {!wa.socketConnected && !wa.isLoading ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Live updates are reconnecting. This page keeps checking in the meantime.
        </Typography>
      ) : null}
    </Box>
  );
}
