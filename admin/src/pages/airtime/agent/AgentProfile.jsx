// AgentProfile.jsx

import {
  Paper,
  Stack,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  // Grid,
  Unstable_Grid2 as Grid
} from "@mui/material";
import {
  EditRounded,
  Person,
  ContactPhone,
  Business,
  Badge,
  Cake,
  Phone,
  Email,
  Home,
  Storefront,
  LocationOn,
  Description,
} from "@mui/icons-material";
import { useSearchParams } from "react-router-dom";
import moment from "moment";
import {  useAuth } from "../../../context/providers/AuthProvider";

// ─── Helper component for each detail row ──────────────────────────
const DetailRow = ({ icon, label, value }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      py: 0.75,
      px: 1,
      borderRadius: 1,
      transition: "background-color 0.2s",
      "&:hover": { bgcolor: "action.hover" },
    }}
  >
    <Box sx={{ color: "primary.main", display: "flex", alignItems: "center" }}>
      {icon}
    </Box>
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight="medium">
        {value || "N/A"}
      </Typography>
    </Box>
  </Box>
);

// ─── Section component ──────────────────────────────────────────────
const Section = ({ title, subtitle, icon, children, onEdit, canEdit }) => (
  <Paper
    elevation={2}
    sx={{
      borderRadius: 1.2,
      p: 3,
      bgcolor: "background.paper",
      transition: "box-shadow 0.2s",
      "&:hover": { boxShadow: 4 },
    }}
  >
    <Stack spacing={2}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "primary.lighter",
              borderRadius: "50%",
              p: 1,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
        </Stack>
        {canEdit && (
          <Tooltip title="Edit section" arrow>
            <IconButton onClick={onEdit} size="small" sx={{ color: "primary.main" }}>
              <EditRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Divider />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {children}
      </Box>
    </Stack>
  </Paper>
);

// ─── Main Component ──────────────────────────────────────────────────
function AgentProfile({ values }) {
  const { user } =useAuth()
  const [searchParams, setSearchParams] = useSearchParams();


  const handleOpenEdit = (section) => {
    setSearchParams((params) => {
      params.set(section, "true");
      return params;
    });
  };

  const canEdit = user?.permissions?.includes("Edit agents");

  return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={3}>
        {/* Personal Details */}
        <Section
          title="Personal Details"
          subtitle="Manage agent personal information"
          icon={<Person color="primary" />}
          onEdit={() => handleOpenEdit("personal")}
          canEdit={canEdit}
        >
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <DetailRow icon={<Badge fontSize="small" />} label="First Name" value={values?.firstname} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow icon={<Badge fontSize="small" />} label="Last Name" value={values?.lastname} />
            </Grid>
            <Grid item xs={12}>
              <DetailRow icon={<Person fontSize="small" />} label="Username" value={values?.username} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                icon={<Cake fontSize="small" />}
                label="Date of Birth"
                value={values?.dob ? moment(values.dob).format("Do MMMM, YYYY") : "N/A"}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                icon={<Phone fontSize="small" />}
                label="Telephone"
                value={values?.phonenumber}
              />
            </Grid>
            <Grid item xs={12}>
              <DetailRow
                icon={<Badge fontSize="small" />}
                label="National ID / Voter's ID"
                value={values?.nid}
              />
            </Grid>
          </Grid>
        </Section>

        {/* Contact Details */}
        <Section
          title="Contact Details"
          subtitle="Agent contact information"
          icon={<ContactPhone color="primary" />}
          onEdit={() => handleOpenEdit("contact")}
          canEdit={canEdit}
        >
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <DetailRow
                icon={<Phone fontSize="small" />}
                label="Telephone"
                value={values?.phonenumber}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                icon={<Email fontSize="small" />}
                label="Email Address"
                value={values?.email}
              />
            </Grid>
            <Grid item xs={12}>
              <DetailRow
                icon={<Home fontSize="small" />}
                label="Residential Address"
                value={values?.residence}
              />
            </Grid>
          </Grid>
        </Section>

        {/* Business Information */}
        <Section
          title="Business Information"
          subtitle="Agent business details"
          icon={<Business color="primary" />}
          onEdit={() => handleOpenEdit("business")}
          canEdit={canEdit}
        >
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <DetailRow
                icon={<Storefront fontSize="small" />}
                label="Business Name"
                value={values?.businessName}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                icon={<LocationOn fontSize="small" />}
                label="Location"
                value={values?.businessLocation}
              />
            </Grid>
            <Grid item xs={12}>
              <DetailRow
                icon={<Description fontSize="small" />}
                label="Description"
                value={values?.businessDescription}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                icon={<Phone fontSize="small" />}
                label="Business Phone"
                value={values?.businessPhonenumber}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailRow
                icon={<Email fontSize="small" />}
                label="Business Email"
                value={values?.businessEmail}
              />
            </Grid>
          </Grid>
        </Section>
      </Stack>
    </Box>
  );
}

export default AgentProfile;