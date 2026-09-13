import React, { useMemo, useState, useCallback, useId } from "react";
import {
  Box,
  Paper,
  Stack,
  Toolbar,
  Typography,
  Tooltip,
  IconButton,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  TextField,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Badge,
  Chip,
  Divider,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ViewColumnRoundedIcon from "@mui/icons-material/ViewColumnRounded";
import DensitySmallRoundedIcon from "@mui/icons-material/DensitySmallRounded";
import DensityMediumRoundedIcon from "@mui/icons-material/DensityMediumRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import ColumnFilterMenu from "./ColumnFilterMenu";
import { useDebouncedCallback } from "./useDebouncedCallback";
import {
  getColumnValue,
  getComparator,
  exportRowsToCsv,
  exportRowsToExcel,
  exportRowsToPdf,
} from "./dataTableUtils";

/**
 * @typedef {Object} DataTableColumn
 * @property {string} field            - Data path, e.g. "user.name". Required unless valueGetter is given.
 * @property {string} headerName       - Column header label.
 * @property {number} [width]          - Fixed width in px.
 * @property {number} [minWidth]
 * @property {'left'|'right'|'center'} [align]
 * @property {boolean} [sortable]      - Default true.
 * @property {boolean} [hideable]      - Default true. Set false to always show.
 * @property {{type:'text'}|{type:'select', options:{label:string,value:string}[]}} [filter]
 * @property {(row:any) => React.ReactNode} [renderCell] - Custom cell renderer.
 * @property {(row:any) => any} [valueGetter] - Raw value for sort/export when renderCell is decorative.
 */

const DEFAULT_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function DataTable({
  columns,
  data = [],
  getRowId = (row) => row.id,

  // --- Mode -----------------------------------------------------------
  // "server": `data` is just the current page; you own fetching via the
  //           page/rowsPerPage/sort/search/columnFilters callbacks below.
  // "client": `data` is the full dataset; sorting/paging/filtering all
  //           happen locally.
  mode = "server",

  // --- Loading / lifecycle --------------------------------------------
  loading = false, // initial load — shows full skeleton rows
  fetching = false, // background refetch — shows slim top progress bar only
  error = null, // { message } — shows an error row with a retry action
  onRetry,

  // --- Pagination (1-indexed page, to match typical REST APIs) --------
  page = 1,
  rowsPerPage = 10,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
  totalCount,
  onPageChange,
  onRowsPerPageChange,

  // --- Sorting ----------------------------------------------------------
  sort, // { field, direction: 'asc' | 'desc' }
  onSortChange,

  // --- Search -----------------------------------------------------------
  searchable = false,
  searchPlaceholder = "Search…",
  onSearchChange,
  searchDebounceMs = 350,

  // --- Column filters -----------------------------------------------
  columnFilters = {},
  onColumnFiltersChange,

  // --- Selection ------------------------------------------------------
  selectable = false,
  selected = [],
  onSelectionChange,

  // --- Row interaction --------------------------------------------------
  onRowClick,

  // --- Toolbar ----------------------------------------------------------
  title,
  subtitle,
  onRefresh,
  toolbarActions = [], // [{ icon, label, onClick, requiresSelection, color }]
  exportFileName = "table-export",
  exportable = false,
  // Shown as the printed header on the PDF export. Defaults to `title`.
  exportTitle,
  exportSubtitle,
  exportOrientation = "landscape",

  // --- Layout / density -------------------------------------------------
  dense: denseProp,
  enableDensityToggle = true,
  stickyHeader = true,
  maxHeight = 640,

  emptyState,
}) {
  const [internalDense, setInternalDense] = useState(false);
  const dense = denseProp ?? internalDense;

  const [hiddenFields, setHiddenFields] = useState(() => new Set());
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [filterColumn, setFilterColumn] = useState(null);
  const [searchValue, setSearchValue] = useState("");

  const headingId = useId();

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenFields.has(c.field)),
    [columns, hiddenFields],
  );

  const activeFilterCount = Object.values(columnFilters).filter(
    (v) => v !== "" && v != null,
  ).length;

  // ------------------------------------------------------------------
  // Client-side derived rows: filter -> sort -> paginate. In "server"
  // mode none of this runs — `data` is trusted as-is.
  // ------------------------------------------------------------------
  const clientRows = useMemo(() => {
    if (mode !== "client") return null;

let rows = data ? data?.map((row, index) => ({ row, index })) : [];

    if (searchValue) {
      const needle = searchValue.toLowerCase();
      rows = rows.filter(({ row }) =>
        columns.some((col) => {
          const val = getColumnValue(col, row);
          return val != null && String(val).toLowerCase().includes(needle);
        }),
      );
    }

    Object.entries(columnFilters).forEach(([field, value]) => {
      if (value === "" || value == null) return;
      const col = columns.find((c) => c.field === field);
      if (!col) return;
      rows = rows.filter(({ row }) =>
        String(getColumnValue(col, row) ?? "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      );
    });

    if (sort?.field) {
      const col = columns.find((c) => c.field === sort.field);
      if (col) rows = [...rows].sort(getComparator(col, sort.direction));
    }

    return rows.map((r) => r.row);
  }, [mode, data, columns, searchValue, columnFilters, sort]);

  const totalRows =
    mode === "client" ? clientRows.length : totalCount ?? data.length;

  const pagedRows = useMemo(() => {
    if (mode !== "client") return data;
    const start = (page - 1) * rowsPerPage;
    return clientRows.slice(start, start + rowsPerPage);
  }, [mode, clientRows, data, page, rowsPerPage]);

  const rows = mode === "client" ? pagedRows : data;

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const debouncedSearch = useDebouncedCallback((value) => {
    onSearchChange?.(value);
  }, searchDebounceMs);

  const handleSearchInput = useCallback(
    (e) => {
      const value = e.target.value;
      setSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );

  const handleSort = useCallback(
    (field) => {
      const isSameField = sort?.field === field;
      const nextDirection =
        isSameField && sort?.direction === "asc" ? "desc" : "asc";
      onSortChange?.({ field, direction: nextDirection });
    },
    [sort, onSortChange],
  );

  // MUI's TablePagination is 0-indexed; this component's public API is
  // 1-indexed (matches typical REST `?page=` params). Convert right at
  // the boundary so the off-by-one never leaks into calling code.
  const handleChangePage = useCallback(
    (_event, newZeroIndexedPage) => {
      onPageChange?.(newZeroIndexedPage + 1);
    },
    [onPageChange],
  );

  const handleChangeRowsPerPage = useCallback(
    (event) => {
      onRowsPerPageChange?.(parseInt(event.target.value, 10));
    },
    [onRowsPerPageChange],
  );

  const currentPageIds = useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedOnPageCount = currentPageIds.filter((id) =>
    selectedSet.has(id),
  ).length;
  const allOnPageSelected =
    rows.length > 0 && selectedOnPageCount === rows.length;
  const someOnPageSelected =
    selectedOnPageCount > 0 && !allOnPageSelected;

  const toggleSelectAllOnPage = useCallback(() => {
    if (allOnPageSelected) {
      onSelectionChange?.(selected.filter((id) => !currentPageIds.includes(id)));
    } else {
      const merged = new Set([...selected, ...currentPageIds]);
      onSelectionChange?.(Array.from(merged));
    }
  }, [allOnPageSelected, selected, currentPageIds, onSelectionChange]);

  const toggleSelectRow = useCallback(
    (id) => {
      if (selectedSet.has(id)) {
        onSelectionChange?.(selected.filter((x) => x !== id));
      } else {
        onSelectionChange?.([...selected, id]);
      }
    },
    [selectedSet, selected, onSelectionChange],
  );

  const openColumnFilter = (event, column) => {
    setFilterAnchor(event.currentTarget);
    setFilterColumn(column);
  };

  const applyColumnFilter = (field, value) => {
    onColumnFiltersChange?.({ ...columnFilters, [field]: value });
  };

  const clearColumnFilter = (field) => {
    const next = { ...columnFilters };
    delete next[field];
    onColumnFiltersChange?.(next);
  };

  const handleExport = (format) => {
    const exportData = mode === "client" ? clientRows : rows;

    if (format === "csv") {
      exportRowsToCsv(visibleColumns, exportData, exportFileName);
    } else if (format === "xlsx") {
      exportRowsToExcel(visibleColumns, exportData, exportFileName);
    } else if (format === "pdf") {
      exportRowsToPdf(visibleColumns, exportData, exportFileName, {
        title: exportTitle ?? title,
        subtitle: exportSubtitle,
        orientation: exportOrientation,
      });
    }
    setExportMenuAnchor(null);
  };

  const cellPadding = dense ? "6px 16px" : "12px 16px";
  const colSpan = visibleColumns.length + (selectable ? 1 : 0);
  const showFullSkeleton = loading;
  const showEmpty = !loading && !error && rows.length === 0;
  const activeToolbarActions = toolbarActions.filter(
    (a) => !a.requiresSelection || selected.length > 0,
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        borderRadius: 3,
        overflow: "hidden",
        position: "relative",
      }}
      aria-labelledby={title ? headingId : undefined}
    >
      {/* Slim top progress bar for background refetches — keeps the
          previous page's rows visible instead of blanking the table,
          which reads as far calmer during pagination/sort/filter. */}
      <Box sx={{ height: 3 }}>
        {fetching && !loading && (
          <LinearProgress
            sx={{
              height: 3,
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
              },
            }}
          />
        )}
      </Box>

      {/* ---------------------------------------------------------------- Toolbar */}
      <Toolbar
        sx={{
          flexWrap: "wrap",
          gap: 1.5,
          py: 2,
          px: { xs: 2, sm: 3 },
          bgcolor:
            selected.length > 0 ? "action.selected" : "background.paper",
        }}
      >
        <Box sx={{ flex: "1 1 auto", minWidth: 200 }}>
          {selected.length > 0 ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                {selected.length} selected
              </Typography>
              <IconButton
                size="small"
                aria-label="Clear selection"
                onClick={() => onSelectionChange?.([])}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          ) : (
            <>
              {title && (
                <Typography id={headingId} variant="h6" fontWeight={600}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </>
          )}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" >
          {searchable && (
            <TextField
              size="small"
              value={searchValue}
              onChange={handleSearchInput}
              placeholder={searchPlaceholder}
              sx={{ minWidth: { xs: 160, sm: 240 } , 
              borderRadius: 10,

          width: "38svw",
          }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchValue && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchValue("");
                        onSearchChange?.("");
                      }}
                    >
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {activeFilterCount > 0 && (
            <Chip
              size="small"
              icon={<FilterListRoundedIcon />}
              label={`${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""}`}
              onDelete={() => onColumnFiltersChange?.({})}
            />
          )}

          {activeToolbarActions.map((action, i) => (
            <Tooltip key={i} title={action.label}>
              <IconButton
                size="small"
                color={action.color || "default"}
                onClick={action.onClick}
                aria-label={action.label}
              >
                {action.icon}
              </IconButton>
            </Tooltip>
          ))}

          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={onRefresh} aria-label="Refresh">
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {enableDensityToggle && (
            <Tooltip title={dense ? "Comfortable density" : "Compact density"}>
              <IconButton
                size="small"
                onClick={() => setInternalDense((d) => !d)}
                aria-label="Toggle row density"
              >
                {dense ? (
                  <DensityMediumRoundedIcon fontSize="small" />
                ) : (
                  <DensitySmallRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Show/hide columns">
            <IconButton
              size="small"
              onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
              aria-label="Show or hide columns"
            >
              <Badge
                color="primary"
                variant="dot"
                invisible={hiddenFields.size === 0}
              >
                <ViewColumnRoundedIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          {exportable && (
            <Tooltip title="Export">
              <IconButton
                size="small"
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                aria-label="Export table data"
              >
                <FileDownloadRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Toolbar>

      <Divider />

      {/* ---------------------------------------------------------------- Table */}
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader={stickyHeader} size={dense ? "small" : "medium"}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={someOnPageSelected}
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    inputProps={{ "aria-label": "Select all rows on this page" }}
                  />
                </TableCell>
              )}
              {visibleColumns.map((col) => {
                const isSorted = sort?.field === col.field;
                const isFiltered =
                  columnFilters[col.field] !== undefined &&
                  columnFilters[col.field] !== "";
                return (
                  <TableCell
                    key={col.field || col.headerName}
                    align={col.align || "left"}
                    sx={{
                      width: col.width,
                      minWidth: col.minWidth,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontSize: 12,
                      letterSpacing: "0.03em",
                      color: "text.secondary",
                      bgcolor: "grey.50",
                      whiteSpace: "nowrap",
                    }}
                    sortDirection={isSorted ? sort.direction : false}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      {col.sortable === false || !col.field ? (
                        col.headerName
                      ) : (
                        <TableSortLabel
                          active={isSorted}
                          direction={isSorted ? sort.direction : "asc"}
                          onClick={() => handleSort(col.field)}
                        >
                          {col.headerName}
                        </TableSortLabel>
                      )}
                      {col.filter && (
                        <Tooltip title={`Filter ${col.headerName}`}>
                          <IconButton
                            size="small"
                            onClick={(e) => openColumnFilter(e, col)}
                            aria-label={`Filter ${col.headerName}`}
                            color={isFiltered ? "primary" : "default"}
                          >
                            <FilterListRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {showFullSkeleton &&
              Array.from({ length: rowsPerPage }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Skeleton variant="rectangular" width={18} height={18} />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell key={col.field || col.headerName} sx={{ py: cellPadding }}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {error && !loading && (
              <TableRow>
                <TableCell colSpan={colSpan} sx={{ py: 6 }}>
                  <Stack alignItems="center" spacing={1.5}>
                    <InfoRoundedIcon color="error" sx={{ fontSize: 40 }} />
                    <Typography color="text.secondary" align="center">
                      {error.message || "Something went wrong loading this data."}
                    </Typography>
                    {onRetry && (
                      <IconButton onClick={onRetry} aria-label="Retry" color="primary">
                        <RefreshRoundedIcon />
                      </IconButton>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            )}

            {showEmpty && (
              <TableRow>
                <TableCell colSpan={colSpan} sx={{ py: 6, border: 0 }}>
                  <Stack alignItems="center" spacing={1.5}>
                    {emptyState?.icon || (
                      <InfoRoundedIcon color="disabled" sx={{ fontSize: 40 }} />
                    )}
                    <Typography fontWeight={600}>
                      {emptyState?.title || "No results"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                      {emptyState?.description ||
                        "Try adjusting your search or filters."}
                    </Typography>
                    {emptyState?.action}
                  </Stack>
                </TableCell>
              </TableRow>
            )}

            {!showFullSkeleton &&
              !error &&
              rows.map((row) => {
                const id = getRowId(row);
                const isSelected = selectedSet.has(id);
                return (
                  <TableRow
                    key={id}
                    hover
                    selected={isSelected}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter") onRowClick(row);
                          }
                        : undefined
                    }
                    sx={{
                      cursor: onRowClick ? "pointer" : "default",
                      transition: "background-color 120ms ease",
                      "@media (prefers-reduced-motion: reduce)": {
                        transition: "none",
                      },
                    }}
                  >
                    {selectable && (
                      <TableCell
                        padding="checkbox"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleSelectRow(id)}
                          inputProps={{ "aria-label": `Select row ${id}` }}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={col.field || col.headerName}
                        align={col.align || "left"}
                        sx={{ py: cellPadding }}
                      >
                        {col.renderCell
                          ? col.renderCell(row)
                          : String(getColumnValue(col, row) ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider />

      <TablePagination
        component="div"
        rowsPerPageOptions={rowsPerPageOptions}
        count={totalRows}
        rowsPerPage={rowsPerPage}
        page={Math.max(page - 1, 0)}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      {/* ---------------------------------------------------------------- Menus */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
      >
        {columns.map((col) => (
          <MenuItem
            key={col.field || col.headerName}
            disabled={col.hideable === false}
            onClick={() => {
              setHiddenFields((prev) => {
                const next = new Set(prev);
                next.has(col.field) ? next.delete(col.field) : next.add(col.field);
                return next;
              });
            }}
          >
            <ListItemIcon>
              <Checkbox
                edge="start"
                size="small"
                checked={!hiddenFields.has(col.field)}
                disabled={col.hideable === false}
                tabIndex={-1}
              />
            </ListItemIcon>
            <ListItemText primary={col.headerName} />
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExport("csv")}>Export as CSV</MenuItem>
        <MenuItem onClick={() => handleExport("xlsx")}>Export as Excel</MenuItem>
        <MenuItem onClick={() => handleExport("pdf")}>Export as PDF</MenuItem>
      </Menu>

      <ColumnFilterMenu
        column={filterColumn}
        anchorEl={filterAnchor}
        value={filterColumn ? columnFilters[filterColumn.field] : ""}
        onApply={applyColumnFilter}
        onClear={clearColumnFilter}
        onClose={() => setFilterAnchor(null)}
      />
    </Paper>
  );
}