import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { toE164Digits, validatePhone } from "../lib/phone";

export const EMPTY_DRAFT = { countryCode: "233", number: "" };

const METHODS = [
  { value: "qr", label: "QR code", hint: "Scan with your phone" },
  { value: "pairing", label: "Pairing code", hint: "Type a code instead" },
];

/**
 * The idle screen: pick QR or pairing code, then start.
 *
 * @param {Object} props
 * @param {"qr" | "pairing"} props.method
 * @param {(m: "qr" | "pairing") => void} props.onMethodChange
 * @param {() => void} props.onStartQr
 * @param {(phoneNumber: string) => void} props.onStartPairing  digits only, with country code
 * @param {() => void} [props.onReconnect]  shown when the account is still linked, so no scan is needed
 * @param {{ tone: "warn" | "error", title: string, message: string }} [props.problem]
 * @param {boolean} [props.expired]  the last code ran out: the button says a new one will be made
 * @param {boolean} [props.busy]
 * @param {{ countryCode: string, number: string }} props.draft  owned by the parent so it survives remounts
 * @param {(draft: { countryCode: string, number: string }) => void} props.onDraftChange
 */
export function WhatsAppConnect({
  method,
  onMethodChange,
  onStartQr,
  onStartPairing,
  onReconnect,
  problem,
  expired,
  busy,
  draft,
  onDraftChange,
}) {
  const [errors, setErrors] = useState({});

  const submitPairing = (e) => {
    e.preventDefault();
    const found = validatePhone(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onStartPairing(toE164Digits(draft.countryCode, draft.number));
  };

  const change = (field) => (e) => {
    onDraftChange({ ...draft, [field]: e.target.value });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const cta =
    method === "qr"
      ? expired
        ? "Show a new QR code"
        : "Show QR code"
      : expired
        ? "Get a new pairing code"
        : "Get pairing code";

  const spinner = busy ? <CircularProgress size={16} color="inherit" /> : null;

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {problem ? (
        <Alert severity={problem.tone === "warn" ? "warning" : "error"} variant="outlined">
          <AlertTitle>{problem.title}</AlertTitle>
          {problem.message}
        </Alert>
      ) : null}

      {onReconnect ? (
        <Alert
          severity="success"
          variant="outlined"
          icon={false}
          action={
            <Button color="success" variant="contained" size="small" onClick={onReconnect} disabled={busy} startIcon={spinner}>
              Reconnect
            </Button>
          }
        >
          <strong>Your account is still linked.</strong> Reconnect without scanning.
        </Alert>
      ) : null}

      <Box component="fieldset" disabled={busy} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
        <Typography component="legend" variant="body2" fontWeight={500} sx={{ mb: 1.5, p: 0 }}>
          How do you want to link WhatsApp?
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={method}
          onChange={(_e, value) => value && onMethodChange(value)}
          aria-label="Link method"
          color="primary"
          sx={{ gap: 1.5, flexDirection: { xs: "column", sm: "row" }, "& .MuiToggleButtonGroup-grouped": { borderRadius: "8px !important", border: "1px solid", borderColor: "divider", m: 0 } }}
        >
          {METHODS.map((m) => (
            <ToggleButton key={m.value} value={m.value} sx={{ flexDirection: "column", alignItems: "flex-start", textTransform: "none", py: 1.5, px: 2 }}>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {m.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m.hint}
              </Typography>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {method === "qr" ? (
        <Box>
          <Button variant="contained" onClick={onStartQr} disabled={busy} startIcon={spinner}>
            {cta}
          </Button>
        </Box>
      ) : (
        <Box component="form" onSubmit={submitPairing} noValidate sx={{ display: "grid", gap: 2 }}>
          <Box>
            <Typography component="label" htmlFor="wa-number" variant="body2" fontWeight={500} sx={{ display: "block", mb: 1 }}>
              WhatsApp phone number
            </Typography>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <TextField
                value={draft.countryCode}
                onChange={change("countryCode")}
                size="small"
                disabled={busy}
                error={Boolean(errors.countryCode)}
                slotProps={{
                  htmlInput: { "aria-label": "Country code", inputMode: "numeric", autoComplete: "tel-country-code", maxLength: 5, "aria-describedby": "wa-number-error" },
                  input: { startAdornment: <InputAdornment position="start">+</InputAdornment> },
                }}
                sx={{ width: 110 }}
              />
              <TextField
                id="wa-number"
                value={draft.number}
                onChange={change("number")}
                size="small"
                fullWidth
                disabled={busy}
                placeholder="24 123 4567"
                error={Boolean(errors.number)}
                slotProps={{ htmlInput: { inputMode: "tel", autoComplete: "tel-national", "aria-describedby": "wa-number-error" } }}
              />
            </Box>
            <FormHelperText id="wa-number-error" error sx={{ mx: 0, minHeight: 20 }}>
              {errors.countryCode ?? errors.number ?? ""}
            </FormHelperText>
          </Box>
          <Box>
            <Button type="submit" variant="contained" disabled={busy} startIcon={spinner}>
              {cta}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** Optional name for the account being linked. */
export function AccountLabelField({ value, onChange }) {
  return (
    <TextField
      id="wa-new-account-label"
      label="Account name (optional)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      size="small"
      placeholder="e.g. Work"
      slotProps={{ htmlInput: { maxLength: 60 } }}
      sx={{ mb: 3, maxWidth: 320, display: "flex" }}
    />
  );
}
