import { MoreHorizRounded } from "@mui/icons-material";
import { Box, Card, Divider, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * title    - card heading
 * subtitle - optional small caption under the heading
 * icon     - optional leading icon element, shown in a tinted chip
 * action   - optional element to replace the default "more" button (pass `null` to hide it)
 * width    - min column width for the auto-fit grid children (unchanged behavior)
 */
function CustomCard({ title, subtitle, icon, action, children, width, dense = false }) {
  return (
    <Card
      variant="outlined"
      sx={{
        p: dense ? 2 : 3,
        width: "100%",
        borderRadius: 1.2,
        borderColor: (theme) => alpha(theme.palette.text.primary, 0.08),
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          {icon && (
            <Box
              sx={{
                width: 34,
                height: 34,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 1.2,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                color: "primary.main",
              }}
            >
              {icon}
            </Box>
          )}
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {action !== undefined ? (
          action
        ) : (
          <IconButton size="small" color="secondary">
            <MoreHorizRounded fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <Divider sx={{ mb: 2.5 }} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${width || "200px"}, 1fr))`,
          gap: 2,
        }}
      >
        {children}
      </Box>
    </Card>
  );
}

export default CustomCard;