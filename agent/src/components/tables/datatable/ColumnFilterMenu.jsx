import React, { useEffect, useState } from "react";
import {
  Popover,
  Stack,
  TextField,
  MenuItem,
  Button,
  Typography,
} from "@mui/material";

/**
 * Per-column filter popover, anchored to the filter icon in the header
 * cell. Supports two filter shapes on `column.filter`:
 *   { type: "text" }
 *   { type: "select", options: [{ label, value }] }
 */
export default function ColumnFilterMenu({
  column,
  anchorEl,
  value,
  onApply,
  onClear,
  onClose,
}) {
  const [draft, setDraft] = useState(value ?? "");

  // Re-sync draft whenever a different column's popover opens.
  useEffect(() => {
    setDraft(value ?? "");
  }, [value, anchorEl]);

  if (!column) return null;
  const open = Boolean(anchorEl);
  const filterConfig = column.filter || { type: "text" };

  const handleApply = () => {
    onApply(column.field, draft);
    onClose();
  };

  const handleClear = () => {
    setDraft("");
    onClear(column.field);
    onClose();
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { p: 2, width: 260 } } }}
    >
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" color="text.secondary">
          Filter · {column.headerName}
        </Typography>

        {filterConfig.type === "select" ? (
          <TextField
            select
            size="small"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          >
            <MenuItem value="">
              <em>Any</em>
            </MenuItem>
            {(filterConfig.options || []).map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <TextField
            size="small"
            autoFocus
            placeholder={`Filter ${column.headerName.toLowerCase()}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApply();
            }}
          />
        )}

        <Stack direction="row" justifyContent="space-between">
          <Button size="small" onClick={handleClear} disabled={!value}>
            Clear
          </Button>
          <Button size="small" variant="contained" onClick={handleApply}>
            Apply
          </Button>
        </Stack>
      </Stack>
    </Popover>
  );
}
