import { cloneElement } from "react";
import { Box, Card, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * title - caption under the value
 * value - the headline (string, number, or a <CountUp/>/<Typography/> element)
 * icon  - a bare icon element, e.g. <PaymentRounded /> (no need to set its color)
 * color - hex/rgb used to tint the icon chip and color the icon itself
 */
const ItemCard = ({ title, value, icon, color = "#0F172A" }) => {
  return (
    <Card
      variant="outlined"
      sx={{
        width: "100%",
        p: 2,
        borderRadius: 1.2,
        borderColor: (theme) => alpha(theme.palette.text.primary, 0.08),
        bgcolor: "background.paper",
        transition: "transform .15s ease, box-shadow .15s ease",
        "&:hover": {
          boxShadow: "0 6px 16px rgba(16, 24, 40, 0.08)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Stack spacing={1.5}>
        <Box
          sx={{
            width: 38,
            height: 38,
            display: "grid",
            placeItems: "center",
            borderRadius: 1.2,
            bgcolor: alpha(color, 0.12),
            color,
          }}
        >
          {icon && cloneElement(icon, { sx: { fontSize: 20, color: "inherit" } })}
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.3 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
};

export default ItemCard;