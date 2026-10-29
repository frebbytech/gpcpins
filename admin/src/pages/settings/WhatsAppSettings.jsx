// src/pages/settings/WhatsAppSettings.jsx
import { Paper, Typography, Stack, Box } from "@mui/material";
import { WhatsApp, Construction } from "@mui/icons-material";

function WhatsAppSettings() {
  return (
    <Box
      sx={{
        margin: "auto",
        mt: 4,
        p: 3,
        bgcolor: "#fff",
      }}
    >
      <Typography variant="h4">WhatsApp Services</Typography>
      <Typography variant="body2">
        Configure your WhatsApp Business integration to send notifications,
        templates, and automated messages to your customers.
      </Typography>

      <Paper
        elevation={2}
        sx={{
          mt:3,
          p: { xs: 3, sm: 5 },
          borderRadius: 2,
          minHeight: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              bgcolor: "success.lighter",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WhatsApp sx={{ fontSize: 40, color: "success.main" }} />
          </Box>
          <Typography variant="h5" fontWeight="bold">
            WhatsApp Services
          </Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={480}>
            Configure your WhatsApp Business integration to send notifications,
            templates, and automated messages to your customers.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Construction fontSize="small" color="disabled" />
            <Typography variant="caption" color="text.disabled">
              Coming soon — this module is under development.
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default WhatsAppSettings;
