/* eslint-disable react/display-name */

import React, { useMemo } from "react";
import MaterialTable, { MTableToolbar } from "@material-table/core";
import { Box, Stack, Typography, Tooltip, useTheme } from "@mui/material";
import { InfoRounded, DeleteRounded, Refresh } from "@mui/icons-material";
import * as XLSX from "xlsx";
import { ExportCsv, ExportPdf } from "@material-table/exporters";
import { tableIcons } from "../../config/tableIcons";
import TableSkeleton from "../skeletons/TableSkeleton";

// Stable empty-array reference so a missing `actions` prop doesn't create a
// brand-new [] on every render and blow away the tableActions/tableOptions
// memoization below.
const EMPTY_ARRAY = [];

const CustomizedMaterialTable = React.memo(
  ({
    isLoading = false,
    showExportButton,
    title = "",
    subtitle = "",
    data = [],
    columns = [],
    search = false,
    emptyMessage,
    icon,
    onRowClick,
    onRefresh,
    actions = EMPTY_ARRAY,
    addButton,
    autocompleteComponent,
    onDeleteAll,
    style,
    options = {},
    onRowSelected,
    onSelectionChange,
    onSearchChange,
    // Server-side pagination contract exposed by this component:
    // `page` is 1-indexed (page 1 = first page), matching how most REST
    // APIs expect it. We convert to/from MaterialTable's 0-indexed page
    // internally so callers never have to think about the off-by-one.
    page,
    onPageChange,
    onRowsPerPageChange,
  }) => {
    const theme = useTheme();

    // Memoize columns to prevent unnecessary re-renders
    const memoizedColumns = useMemo(() => columns, [columns]);

    // Custom helper to safely convert structure data into an Excel workbook
    const exportToExcel = (cols, rawData, fileName) => {
      const cleanData = rawData.map((row) => {
        const copy = { ...row };
        delete copy.tableData;
        return copy;
      });

      const worksheet = XLSX.utils.json_to_sheet(cleanData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
      XLSX.writeFile(workbook, `${fileName || "TableData"}.xlsx`);
    };

    // Determine pagination requirements dynamically based on options configuration.
    // `options.totalCount` (server total) always wins over the local data length.
    const totalCount =
      options.totalCount !== undefined ? options.totalCount : data.length;

    // Memoize options with sensible defaults.
    // NOTE: this memo is only as good as the `options` reference the parent
    // passes in. If the parent inlines `options={{ ... }}` on every render,
    // this memo never actually skips work. See Logs.jsx for the fix
    // (useMemo the options object there too).
    const tableOptions = useMemo(
      () => ({
        showTitle: false,
        search: search || false,
        searchFieldVariant: "outlined",
        searchFieldStyle: {
          borderRadius: "20px",
          fontSize: "13px",
          marginTop: "10px",
          marginRight: "20px",
          height: "40px",
          width: "38svw",
          minWidth: 130,
        },
        searchFieldAlignment: "right",
        columnsButton: true,
        columnResizable: true,
        // If a server total count is provided, enable paging even if the
        // current data batch happens to be empty (e.g. filtered result set).
        paging: options.totalCount !== undefined ? true : totalCount !== 0,
        pageSize: 10,
        paginationType: "stepped",
        exportAllData: true,

        exportMenu: showExportButton
          ? [
              {
                label: "Export CSV",
                exportFunc: (cols, datas) =>
                  ExportCsv(cols, datas, title || "TableData"),
              },
              {
                label: "Export PDF",
                exportFunc: (cols, datas) =>
                  ExportPdf(cols, datas, title || "TableData", {
                    jsPDF: {
                      orientation: "landscape",
                    },
                    autoTable: {
                      startY: 35,
                      didDrawPage: (data) => {
                        const doc = data.doc;
                        doc.setFontSize(20);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(40, 40, 40);
                        doc.text("GAP POWERFUL CONSULT", 14, 18);

                        doc.setFontSize(10);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(100, 100, 100);
                        doc.text(`Report: ${title || "Data Export"}`, 14, 25);
                      },
                    },
                  }),
              },
              {
                label: "Export Excel",
                exportFunc: (cols, datas) =>
                  exportToExcel(cols, datas, title || "TableData"),
              },
            ]
          : [],

        headerStyle: {
          backgroundColor: theme.palette.grey[100],
          color: theme.palette.text.primary,
          textTransform: "uppercase",
          paddingBlock: "12px",
          fontWeight: "bold",
        },
        fixedColumns: false,
        ...options,
        // `page`/`totalCount` are root-level MaterialTable props, not
        // `options` keys. Strip them out here even if a caller accidentally
        // passes them in `options`, so they don't silently no-op AND cause
        // confusion about which value actually wins.
        page: undefined,
        totalCount: undefined,
      }),
      [search, showExportButton, title, totalCount, options, theme],
    );

    // Build actions array only once
    const tableActions = useMemo(() => {
      const baseActions = [];

      if (onRefresh) {
        baseActions.push({
          icon: () => (
            <Tooltip title="Refresh">
              <Refresh />
            </Tooltip>
          ),
          isFreeAction: true,
          onClick: onRefresh,
          iconProps: { role: "menu" },
        });
      }

      if (onDeleteAll) {
        baseActions.push({
          icon: () => <DeleteRounded />,
          position: "toolbarOnSelect",
          tooltip: "Delete selected",
          onClick: onDeleteAll,
        });
      }

      if (actions.length) {
        baseActions.push(...actions);
      }

      return baseActions;
    }, [onRefresh, onDeleteAll, actions]);

    // Custom toolbar component
    const CustomToolbar = useMemo(
      () => (props) => (
        <>
          <Stack width="100%" px={2} pt={2}></Stack>
          {autocompleteComponent && (
            <Box px={2} pt={1} pb={1}>
              {autocompleteComponent}
            </Box>
          )}
          <MTableToolbar {...props} />
        </>
      ),
      [autocompleteComponent],
    );

    // Custom empty state
    const emptyState = useMemo(
      () => (
        <Stack
          alignItems="center"
          justifyContent="center"
          minHeight={300}
          spacing={2}
        >
          {icon || (
            <InfoRounded color="primary" sx={{ width: 80, height: 80 }} />
          )}
          <Typography color="text.secondary" align="center">
            {isLoading ? "Loading..." : emptyMessage || "No data found"}
          </Typography>
          {addButton}
        </Stack>
      ),
      [icon, isLoading, emptyMessage, addButton],
    );

    if (isLoading) {
      return (
        <Box sx={{ width: "100%", mx: "auto", py: 2, ...style }}>
          <TableSkeleton
            columns={columns.length}
            rows={5}
            hasToolbar={true}
            hasSearch={search}
            hasActions={true}
          />
        </Box>
      );
    }

    return (
      <Box
        sx={{
          width: { xs: "calc(100vw - 32px)", md: "100%" },
          height: "100%",
          mx: "auto",
          py: 2,
          overflowX: "auto",
          borderRadius: 1.2,
          ...style,
        }}
        className="scroll-container"
      >
        <MaterialTable
          isLoading={isLoading}
          icons={tableIcons}
          columns={memoizedColumns}
          data={data}
          options={tableOptions}
          components={{ Toolbar: CustomToolbar }}
          localization={{
            body: {
              emptyDataSourceMessage: emptyState,
            },
            toolbar: {
              searchPlaceholder: "Search...",
            },
          }}
          onRowClick={onRowClick}
          onRowSelected={onRowSelected}
          onSelectionChange={onSelectionChange}
          actions={tableActions}
          // --- Server-side pagination -------------------------------------
          // The bug: MaterialTable/@material-table/core exposes
          // `onChangePage` and `onChangeRowsPerPage`, NOT `onPageChange`/
          // `onRowsPerPageChange`. Passing the wrong names means the library
          // never receives a handler, so clicking next/prev is a no-op
          // (rows-per-page happened to still work because that control was
          // wired separately). We also convert this component's public,
          // 1-indexed `page` down to MaterialTable's 0-indexed `page`.
          totalCount={totalCount}
          page={page != null ? Math.max(page - 1, 0) : undefined}
          onChangePage={(newPage) => onPageChange?.(newPage + 1)}
          // onChangeRowsPerPage={(newPageSize) =>
          //   onRowsPerPageChange?.(newPageSize)
          // }
          onPageChange={(newPage) => onPageChange?.(newPage + 1)}
          onRowsPerPageChange={(newPageSize) =>
            onRowsPerPageChange?.(newPageSize)
          }
          onSearchChange={onSearchChange}
          sx={{
            "& .MuiTableContainer-root": {
              scrollbarWidth: "none", // Firefox compatibility
              "&::-webkit-scrollbar": {
                display: "none", // Chrome, Safari, Edge compatibility
              },
            },
          }}
        />
      </Box>
    );
  },
);

CustomizedMaterialTable.displayName = "CustomizedMaterialTable";

export default CustomizedMaterialTable;
{
  /* <div class="MuiBox-root css-s7pidn" style="overflow-y: auto;">…</div>scroll */
}



// import { Box, Stack, Tooltip, Typography } from "@mui/material";
// import MaterialTable, { MTableToolbar } from "material-table";

// import { tableIcons } from "../../config/tableIcons";
// import { DeleteRounded, InfoRounded, Refresh } from "@mui/icons-material";

// const CustomizedMaterialTable = ({
//   isLoading,
//   showExportButton,
//   title,
//   data,
//   search,
//   columns,
//   emptyMessage,
//   icon,
//   onRowClick,
//   onRefresh,
//   actions,
//   addButton,
//   autocompleteComponent,
//   onDeleteAll,
//   style,
//   options,
//   onRowSelected,
//   onSelectionChange,
// }) => {
//   const modifiedColumns = columns.map((column) => {
//     return { ...column };
//   });

//   return (
//     // <AnimatedContainer>
//     <Box
//       sx={{
//         borderRadius: 1,
//         paddingBlock: "16px",
//         width: { xs: "92svw", md: "100%" },
//         // width:'100%',
//         height: "100%",
//         marginInline: "auto",
//         py: 4,
//       }}
//       className="scroll-container"
//     >
//       <MaterialTable
//         isLoading={isLoading}
//         title={
//           <>
//             <Stack
//               // display={{ xs: 'none', sm: 'block' }}
//               direction="row"
//               columnGap={1}
//               justifyContent="center"
//               alignItems="center"
//             >
//               {/* {emptyIcon} */}
//               <Typography variant="h5">{title}</Typography>
//             </Stack>
//           </>
//         }
//         icons={tableIcons}
//         columns={modifiedColumns}
//         data={data}
//         options={{
//           search: search || false,
//           searchFieldVariant: "outlined",
//           searchFieldStyle: {
//             borderRadius: "16px",
//             fontSize: "13px",
//             marginTop: "10px",
//             marginRight: "20px",
//             height: "40px",
//             paddingBlock: "20px",
//             width: 300,
//             minWidth: 130,
//           },
//           columnsButton: true,
//           columnResizable: true,
//           paging: data?.length !== 0 ? true : false,
//           pageSize: 10,
//           paginationType: "stepped",
//           exportAllData: true,
//           exportFileName: title,
//           // exportButton: showExportButton ? true : false,
//           exportButton: {
//             csv: showExportButton ? true : false,
//             pdf: false,
//           },
//           headerStyle: {
//             backgroundColor: "#fff",
//             color: "secondary.main",
//             paddingBlock: "12px",
//             textTransform: "uppercase",
//           },

//           ...options,
//         }}
//         style={{
//           boxShadow: "none",

//           ...style,
//         }}
//         components={{
//           Toolbar: (props) => {
//             return (
//               <>
//                 <MTableToolbar {...props} />
//                 <Box
//                   display="flex"
//                   flexDirection={{ xs: "column", sm: "row" }}
//                   justifyContent="space-between"
//                   alignItems="center"
//                   gap={2}
//                   padding={2}
//                 >
//                   {autocompleteComponent}
//                 </Box>
//               </>
//             );
//           },
//         }}
//         localization={{
//           body: {
//             emptyDataSourceMessage: (
//               <Stack
//                 alignItems="center"
//                 justifyContent="center"
//                 minHeight={300}
//                 spacing={1}
//               >
//                 {icon ? (
//                   icon
//                 ) : (
//                   <InfoRounded
//                     color="primary"
//                     sx={{ width: 100, height: 100 }}
//                   />
//                 )}
//                 <Typography>
//                   {isLoading
//                     ? "Please Wait..."
//                     : emptyMessage || "No data found!"}
//                 </Typography>
//                 {addButton}
//               </Stack>
//             ),
//           },
//         }}
//         onRowClick={onRowClick}
//         onRowSelected={onRowSelected}
//         onSelectionChange={onSelectionChange}
//         actions={
//           actions?.length > 0
//             ? [
//                 {
//                   icon: () => <DeleteRounded />,
//                   position: "toolbarOnSelect",
//                   tooltip: "Delete all",
//                   onClick: () => onDeleteAll(),
//                 },
//                 {
//                   icon: () => (
//                     <Tooltip title="Refresh">
//                       <Refresh />
//                     </Tooltip>
//                   ),
//                   isFreeAction: true,
//                   onClick: () => onRefresh(),

//                   iconProps: {
//                     role: "menu",
//                   },
//                 },
//                 ...actions,
//               ]
//             : [
//                 {
//                   icon: () => <DeleteRounded />,
//                   position: "toolbarOnSelect",
//                   tooltip: "Delete all",
//                   onClick: () => onDeleteAll(),
//                 },
//                 {
//                   icon: () => (
//                     <Tooltip title="Refresh">
//                       <Refresh />
//                     </Tooltip>
//                   ),
//                   isFreeAction: true,
//                   onClick: () => onRefresh(),

//                   iconProps: {
//                     role: "menu",
//                   },
//                 },
//               ]
//         }
//         totalCount={data?.length}
//       />
//     </Box>
//     // </AnimatedContainer>
//   );
// };

// export default CustomizedMaterialTable;
