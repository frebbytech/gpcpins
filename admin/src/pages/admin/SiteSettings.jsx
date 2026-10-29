// src/pages/admin/SiteSettings.jsx
import { useEffect, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Stack,
  Grid,
  TextField,
  Button,
  Divider,
  IconButton,
  Box,
  Tooltip,
  Card,
  CardContent,
  Chip,
} from "@mui/material";
import {
  Add,
  Delete,
  Facebook,
  Twitter,
  WhatsApp,
  Instagram,
  LinkedIn,
  YouTube,
  MusicNote,
  Save,
} from "@mui/icons-material";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { globalAlertType } from "../../components/alert/alertType";
import { getSiteSettings, updateSiteSettings } from "../../api/siteSettingsAPI";
import CustomTitle from "../../components/custom/CustomTitle";
import Swal from "sweetalert2";

// ─── Validation ─────────────────────────────────────────────────────
const schema = yup.object({
  site_name: yup.string().required("Site name is required"),
  site_tagline: yup.string().nullable(),
  about: yup.string().nullable(),
  services: yup.array().of(
    yup.object({
      title: yup.string().required("Title is required"),
      description: yup.string().nullable(),
      icon: yup.string().nullable(),
    }),
  ),
  email: yup.string().email("Invalid email").nullable(),
  phone: yup.string().nullable(),
  alternate_phone: yup.string().nullable(),
  office_phone: yup.string().nullable(),
  whatsapp: yup.string().nullable(),
  address: yup.string().nullable(),
  gps: yup.string().nullable(),
  city: yup.string().nullable(),
  region: yup.string().nullable(),
  country: yup.string().nullable(),
  map_link: yup.string().nullable(),
  social_facebook: yup.string().nullable(),
  social_x: yup.string().nullable(),
  social_tiktok: yup.string().nullable(),
  social_whatsapp: yup.string().nullable(),
  social_whatsapp_group: yup.string().nullable(),
  social_instagram: yup.string().nullable(),
  social_youtube: yup.string().nullable(),
  social_linkedin: yup.string().nullable(),
  logo: yup.string().nullable(),
  favicon: yup.string().nullable(),
});

// ─── Helper Section Wrapper ────────────────────────────────────────
const Section = ({ title, description, children, icon }) => (
  <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
      {icon}
      <Typography variant="h6" fontWeight="bold">
        {title}
      </Typography>
    </Stack>
    {description && (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>
    )}
    <Divider sx={{ mb: 2 }} />
    {children}
  </Paper>
);

// ─── Main Component ────────────────────────────────────────────────
function SiteSettings() {
  const { customDispatch } = useCustomContext();
  const queryClient = useQueryClient();
  const [previewMode, setPreviewMode] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: getSiteSettings,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      site_name: "",
      site_tagline: "",
      about: "",
      services: [],
      email: "",
      phone: "",
      alternate_phone: "",
      whatsapp: "",
      gps: "",
      address: "",
      city: "",
      region: "",
      country: "",
      map_link: "",
      social_facebook: "",
      social_x: "",
      social_tiktok: "",
      social_whatsapp_group: "",
      social_whatsapp: "",
      social_instagram: "",
      social_youtube: "",
      social_linkedin: "",
      logo: "",
      favicon: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "services",
  });

  // Populate form on load
  useEffect(() => {
    if (settings) {
      reset({
        ...settings,
        services: settings.services || [],
      });
    }
  }, [settings, reset]);

  // Watch for live preview
  const formValues = watch();

  const mutation = useMutation({
    mutationFn: updateSiteSettings,
    onSuccess: (data) => {
      customDispatch(globalAlertType("success", "Site settings updated"));
      queryClient.invalidateQueries(["site-settings"]);
      reset(data.data);
    },
    onError: (error) => {
      customDispatch(
        globalAlertType("error", error.message || "Update failed"),
      );
    },
  });

  const onSubmit = (values) => {
    Swal.fire({
      title: "Save Changes?",
      text: "Are you sure you want to update the site settings?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, save",
    }).then((result) => {
      if (result.isConfirmed) {
        mutation.mutate(values);
      }
    });
  };

  return (
    <Box
      sx={{
        margin: "auto",
        mt: 4,
        p: 3,
        bgcolor: "#fff",
      }}
    >
      <Typography variant="h4" gutterBottom>
        Site Settings
      </Typography>
      <Typography variant="body2" gutterBottom>
        Manage the content and configuration of your public website
      </Typography>
      <Container maxWidth="lg" sx={{ py: 4 }}>
    

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={4}>
            {/* ─── Left: Form ──────────────────────────────────── */}
            <Grid item xs={12} md={previewMode ? 7 : 12}>
              {/* General Info */}
              <Section
                title="General Information"
                description="Basic details about your business"
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="site_name"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Site Name"
                          fullWidth
                          error={!!errors.site_name}
                          helperText={errors.site_name?.message}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="site_tagline"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Tagline" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Controller
                      name="about"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="About"
                          multiline
                          rows={4}
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Section>

              {/* Services */}
              <Section
                title="Services"
                description="List the services your business offers"
              >
                <Stack spacing={2}>
                  {fields.map((field, index) => (
                    <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                          <Controller
                            name={`services.${index}.title`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="Title"
                                fullWidth
                                size="small"
                                error={!!errors.services?.[index]?.title}
                                helperText={
                                  errors.services?.[index]?.title?.message
                                }
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Controller
                            name={`services.${index}.description`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="Description"
                                fullWidth
                                size="small"
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <Tooltip title="Remove">
                            <IconButton
                              color="error"
                              onClick={() => remove(index)}
                              size="small"
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                  <Button
                    startIcon={<Add />}
                    variant="outlined"
                    onClick={() => append({ title: "", description: "" })}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Add Service
                  </Button>
                </Stack>
              </Section>

              {/* Contact */}
              <Section
                title="Contact Information"
                description="How customers can reach you"
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Email"
                          type="email"
                          fullWidth
                          error={!!errors.email}
                          helperText={errors.email?.message}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Phone" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="alternate_phone"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Alternate Phone"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="office_phone"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Office Phone" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="whatsapp"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="WhatsApp Number"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Section>

              {/* Location */}
              <Section
                title="Location"
                description="Your physical address and map"
              >
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Controller
                      name="address"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Street Address"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Controller
                      name="gps"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Street Gps" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="city"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="City" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="region"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Region / State"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="country"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Country" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="map_link"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Google Maps Link"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Section>

              {/* Social Media */}
              <Section
                title="Social Media"
                description="Links to your social profiles"
              >
                <Grid container spacing={2}>
                  {[
                    {
                      name: "social_facebook",
                      label: "Facebook",
                      icon: <Facebook color="primary" />,
                    },
                    {
                      name: "social_x",
                      label: "X (Twitter)",
                      icon: <Twitter color="primary" />,
                    },
                    {
                      name: "social_tiktok",
                      label: "TikTok",
                      icon: <MusicNote color="primary" />,
                    },
                    {
                      name: "social_whatsapp",
                      label: "WhatsApp",
                      icon: <WhatsApp color="success" />,
                    },
                    {
                      name: "social_whatsapp_group",
                      label: "WhatsApp Group",
                      icon: <WhatsApp color="success" />,
                    },
                    {
                      name: "social_instagram",
                      label: "Instagram",
                      icon: <Instagram color="secondary" />,
                    },
                    {
                      name: "social_youtube",
                      label: "YouTube",
                      icon: <YouTube color="error" />,
                    },
                    {
                      name: "social_linkedin",
                      label: "LinkedIn",
                      icon: <LinkedIn color="primary" />,
                    },
                  ].map((social) => (
                    <Grid item xs={12} sm={6} key={social.name}>
                      <Controller
                        name={social.name}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label={social.label}
                            fullWidth
                            InputProps={{
                              startAdornment: (
                                <Box sx={{ mr: 1, display: "flex" }}>
                                  {social.icon}
                                </Box>
                              ),
                            }}
                          />
                        )}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Section>

              <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save />}
                  loading={isSubmitting || mutation.isPending}
                >
                  Save Settings
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  {previewMode ? "Hide Preview" : "Show Preview"}
                </Button>
              </Stack>
            </Grid>

            {/* ─── Right: Live Preview ─────────────────────────── */}
            {previewMode && (
              <Grid item xs={12} md={5}>
                <Paper
                  elevation={4}
                  sx={{ p: 3, borderRadius: 2, position: "sticky", top: 16 }}
                >
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Live Preview
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h5" fontWeight="bold">
                      {formValues.site_name || "Site Name"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formValues.site_tagline || "Tagline"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {formValues.about || "About us..."}
                    </Typography>
                  </Card>

                  <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Services
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      spacing={1}
                      sx={{ mt: 1 }}
                    >
                      {formValues.services?.map((s, i) => (
                        <Chip key={i} label={s.title} size="small" />
                      ))}
                    </Stack>
                  </Card>

                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Contact
                    </Typography>
                    <Typography variant="body2">{formValues.email}</Typography>
                    <Typography variant="body2">{formValues.phone}</Typography>
                    <Typography variant="body2">
                      {formValues.address}, {formValues.city}
                    </Typography>
                  </Card>
                </Paper>
              </Grid>
            )}
          </Grid>
        </form>
      </Container>
    </Box>
  );
}

export default SiteSettings;
