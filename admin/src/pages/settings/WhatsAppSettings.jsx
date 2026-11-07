// src/pages/settings/WhatsAppSettings.jsx
import { Paper, Typography, Stack, Box } from "@mui/material";
import { WhatsApp, Construction } from "@mui/icons-material";
import { WhatsAppPanel } from "@/whatsapp";

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
          mt: 3,
          p: { xs: 3, sm: 5 },
          borderRadius: 2,
          minHeight: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={2} alignItems="center" textAlign="center">
          <WhatsAppPanel />
        </Stack>
      </Paper>
    </Box>
  );
}

export default WhatsAppSettings;
