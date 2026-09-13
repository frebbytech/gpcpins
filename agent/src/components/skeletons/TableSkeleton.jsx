import React, { useMemo } from "react";
import {
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Divider,
  useTheme,
} from "@mui/material";

const TableSkeleton = React.memo(({
  columns = 5,
  rows = 5,
  hasToolbar = true,
  hasSearch = false, // Defaults to match your CustomizedMaterialTable's search = false
  hasSubtitle = true,
}) => {
  const theme = useTheme();

  // Distribute columns nicely while mimicking your concrete table widths
  const columnWidths = useMemo(() => {
    return Array.from({ length: columns }, (_, i) => {
      if (i === 0) return "20%";
      if (i === columns - 1) return "12%";
      return `${68 / (columns - 2)}%`;
    });
  }, [columns]);

  return (
    <Box
      sx={{
        width: { xs: "calc(100vw - 32px)", md: "100%" },
        height: "100%",
        mx: "auto",
        py: 2,
        overflowX: "auto",
      }}
    >
      <TableContainer 
        component={Paper} 
        elevation={0} 
        sx={{ 
          borderRadius: 1.2,
          border: `1px solid ${theme.palette.divider}`,
          overflow: "hidden"
        }}
      >
        {/* Toolbar Skeleton matching CustomToolbar stack mapping */}
        {hasToolbar && (
          <Box sx={{ pt: 2, pb: 1 }}>
            <Stack width="100%" px={2} spacing={0.5}>
              {/* Title Mimic */}
              <Skeleton variant="text" width={180} height={32} animation="wave" sx={{ borderRadius: 1 }} />
              {/* Subtitle Mimic */}
              {hasSubtitle && (
                <Skeleton variant="text" width={280} height={20} animation="wave" sx={{ borderRadius: 0.5 }} />
              )}
            </Stack>
            
            <Divider sx={{ mt: 2 }} />
            
            {/* Action Bar / Search Row */}
            <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {/* Matches searchFieldStyle dimensions exactly */}
              {hasSearch ? (
                <Skeleton 
                  variant="rounded" 
                  animation="wave"
                  sx={{ 
                    borderRadius: "25px", 
                    width: "38svw", 
                    minWidth: 130, 
                    height: 36 
                  }} 
                />
              ) : (
                <Box />
              )}
              
              {/* Top-Right Free Actions (Refresh, Columns, Export buttons) */}
              <Stack direction="row" spacing={1.5}>
                <Skeleton variant="circular" width={34} height={34} animation="wave" />
                <Skeleton variant="circular" width={34} height={34} animation="wave" />
                <Skeleton variant="circular" width={34} height={34} animation="wave" />
              </Stack>
            </Box>
            <Divider />
          </Box>
        )}

        <Table>
          {/* Header Row matching theme.palette.grey[100] config */}
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.grey[100] }}>
              {Array.from({ length: columns }).map((_, i) => (
                <TableCell 
                  key={`head-${i}`} 
                  sx={{ 
                    paddingBlock: "16px", // Aligns with text capitalization spacing expansion
                    borderBottom: `1px solid ${theme.palette.divider}` 
                  }}
                >
                  <Skeleton 
                    variant="text" 
                    width={columnWidths[i]} 
                    height={20} 
                    animation="wave" 
                    sx={{ borderRadius: 0.5 }}
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          {/* Table Body Cells */}
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow key={`row-${rowIndex}`}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <TableCell 
                    key={`cell-${rowIndex}-${colIndex}`}
                    sx={{ paddingBlock: "16px" }}
                  >
                    <Skeleton
                      variant="text"
                      width={colIndex === columns - 1 ? "40%" : "85%"} // Gives a natural look to data distributions
                      height={20}
                      animation="wave"
                      sx={{ borderRadius: 0.5 }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
});

TableSkeleton.displayName = "TableSkeleton";

export default TableSkeleton;
