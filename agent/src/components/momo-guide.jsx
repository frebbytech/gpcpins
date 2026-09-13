import { useState, useMemo } from "react";
import { Button, Popover, Typography, Divider, Box } from "@mui/material";
import { HelpOutline as HelpIcon } from "@mui/icons-material";

const guideSteps = {
  "mtn-gh": {
    title: "MTN MoMo",
    steps: [
      "Dial *170# and select Option 10 (My Wallet).",
      "Select Option 3 (My Approvals).",
      "Enter your PIN to view pending approvals.",
      "Select the pending transaction.",
      "Choose Option 1 (YES) to approve or Option 2 (NO) to reject.",
    ],
  },
  "vodafone-gh": {
    title: "Vodafone Cash",
    steps: [
      "Dial *110# and select Option 6 (My Account).",
      "Select Option 5 (Approvals).",
      "Enter your PIN to view pending approvals.",
      "Select the pending transaction.",
      "Choose Option 1 (YES) to approve or Option 2 (NO) to reject.",
    ],
  },
  "tigo-gh": {
    title: "AirtelTigo Money",
    steps: [
      "Dial *110# and select Option 6 (My Account).",
      "Select Option 5 (Approvals).",
      "Enter your PIN to view pending approvals.",
      "Select the pending transaction.",
      "Choose Option 1 (YES) to approve or Option 2 (NO) to reject.",
    ],
  },
};

export default function MomoGuide({ mobilePartner = "mtn-gh" }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const id = open ? "momo-guide-popover" : undefined;

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  // Get guide content based on mobilePartner
  const guide = useMemo(() => {
    return guideSteps[mobilePartner] || guideSteps["mtn-gh"];
  }, [mobilePartner]);

  return (
    <>
      <Button
        variant="text"
        onClick={handleClick}
        sx={{
          textTransform: "none",
          color: "text.secondary",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <HelpIcon fontSize="small" sx={{ mr: 0.5 }} />
        Not receiving prompt?
        <Typography
          component="span"
          variant="body2"
          sx={{
            ml: 1,
            textDecoration: "underline",
            color: "info.main",
            fontWeight: 500,
            fontSize: 12,
          }}
        >
          View Guide
        </Typography>
      </Button>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: 320, sm: 400 },
              maxWidth: "100%",
              maxHeight: { xs: "80vh", md: "90vh" },
              overflowY: "auto",
              p: 2,
              borderRadius: 2,
              boxShadow: 4,
            },
          },
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          How to Approve Transactions
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ mb: 2 }}>
          <Typography
            variant="subtitle2"
            color="error.main"
            fontWeight="bold"
            textTransform="uppercase"
            gutterBottom
          >
            {guide.title}
          </Typography>
          <Box
            component="ol"
            sx={{
              pl: 2,
              mt: 1,
              "& li": {
                fontSize: "0.75rem",
                mb: 0.5,
                lineHeight: 1.4,
              },
            }}
          >
            {guide.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </Box>
        </Box>
      </Popover>
    </>
  );
}
