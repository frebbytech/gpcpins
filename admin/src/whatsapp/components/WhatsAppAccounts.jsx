import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { accountName, findAccount } from "../lib/accounts";
import { WhatsAppApiError } from "../lib/api";

const DOT = {
  connected: "success.main",
  failed: "error.main",
  connecting: "warning.main",
  reconnecting: "warning.main",
  qr_ready: "warning.main",
  pairing_code_ready: "warning.main",
  authenticating: "warning.main",
};

function Dot({ state }) {
  return <Box aria-hidden="true" sx={{ width: 8, height: 8, ml: 1, borderRadius: "50%", bgcolor: DOT[state] ?? "text.disabled" }} />;
}

function LinkButton(props) {
  return <Button size="small" sx={{ textTransform: "none", fontWeight: 500, minWidth: 0, px: 0, py: 0.25 }} {...props} />;
}

/**
 * Switcher for a user's WhatsApp accounts, plus rename and remove for the one on screen.
 * With a single account it stays out of the way: just an "Add another account" link.
 */
export function WhatsAppAccounts({ accounts, activeId, adding, canAdd, max, onSelect, onAdd, onCancelAdd, onRename, onRemove, busy }) {
  const [mode, setMode] = useState("idle");
  const [label, setLabel] = useState("");
  const [error, setError] = useState(null);
  const { account: active, index } = findAccount(accounts, activeId);

  if (accounts.length === 0) return null;

  const run = async (fn) => {
    setError(null);
    try {
      await fn();
      setMode("idle");
    } catch (err) {
      setError(err instanceof WhatsAppApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <Box sx={{ mb: 2, display: "grid", gap: 1.5 }}>
      <Box role="group" aria-label="WhatsApp accounts" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        {accounts.length > 1 &&
          accounts.map((a, i) => {
            const current = !adding && a.sessionId === activeId;
            return (
              <Chip
                key={a.sessionId}
                component="button"
                type="button"
                aria-pressed={current}
                icon={<Dot state={a.status} />}
                label={accountName(a, i)}
                color={current ? "primary" : "default"}
                variant={current ? "filled" : "outlined"}
                onClick={() => {
                  setMode("idle");
                  setError(null);
                  onSelect(a.sessionId);
                }}
              />
            );
          })}
        {adding ? (
          <LinkButton onClick={onCancelAdd}>Cancel adding account</LinkButton>
        ) : canAdd ? (
          <LinkButton onClick={onAdd}>
            {accounts.length > 1 ? "+ Add account" : "Add another account"}
            <Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
              {" "}
              ({accounts.length} of {max} used)
            </Box>
          </LinkButton>
        ) : accounts.length > 1 ? (
          <Typography variant="caption" color="text.secondary">
            Limit of {max} accounts reached
          </Typography>
        ) : null}
      </Box>

      {!adding && active && (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 2, rowGap: 1 }}>
          {mode === "rename" ? (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => onRename(active.sessionId, label.trim()));
              }}
              sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}
            >
              <TextField
                size="small"
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Work"
                slotProps={{ htmlInput: { maxLength: 60, "aria-label": "Account name" } }}
                sx={{ width: 200 }}
              />
              <Button type="submit" variant="contained" size="small" disabled={busy || !label.trim()}>
                Save
              </Button>
              <Button type="button" variant="outlined" color="inherit" size="small" onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </Box>
          ) : mode === "remove" ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, typography: "body2" }}>
              Remove {accountName(active, index)}? It is logged out and its saved history is deleted.
              <Button variant="contained" color="error" size="small" disabled={busy} onClick={() => void run(() => onRemove(active.sessionId))}>
                Remove account
              </Button>
              <Button variant="outlined" color="inherit" size="small" onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </Box>
          ) : (
            <>
              <LinkButton
                onClick={() => {
                  setLabel(active.label ?? "");
                  setMode("rename");
                }}
              >
                Rename
              </LinkButton>
              <LinkButton onClick={() => setMode("remove")}>Remove account</LinkButton>
            </>
          )}
        </Box>
      )}
      {error && (
        <Alert severity="error" variant="outlined">
          <AlertTitle>Couldn’t update the account</AlertTitle>
          {error}
        </Alert>
      )}
    </Box>
  );
}
