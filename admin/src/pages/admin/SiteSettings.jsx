// src/pages/admin/SiteSettings.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider,
  Grid, IconButton, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { Add, Delete, Refresh, Save } from "@mui/icons-material";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { globalAlertType } from "../../components/alert/alertType";
import { getSiteSettings, updateSiteSettings } from "../../api/siteSettingsAPI";

// Field names exactly match the current MySQL site_settings schema.
const fields = {
  general: [
    ["site_name", "Site name", 100, "text"],
    ["site_tagline", "Tagline", 200, "text"],
    ["about", "About the business", null, "multiline"],
  ],
  contact: [
    ["email", "Support email", 100, "email"],
    ["whatsapp", "WhatsApp number", 30, "tel"],
  ],
  location: [
    ["gps", "GhanaPost GPS address", 255, "text"],
    ["address", "Street / postal address", 255, "text"],
    ["city", "City", 100, "text"],
    ["region", "Region", 100, "text"],
    ["country", "Country", 100, "text"],
    ["map_link", "Google Maps link", 255, "url"],
  ],
  community: [
    ["whatsappGroupLink", "WhatsApp group invite link", 255, "url"],
    ["whatsappChannelLink", "WhatsApp channel link", 255, "url"],
  ],
  social: [
    ["social_facebook", "Facebook", 255, "url"],
    ["social_x", "X (Twitter)", 255, "url"],
    ["social_tiktok", "TikTok", 255, "url"],
    ["social_whatsapp", "WhatsApp profile link", 255, "url"],
    ["social_whatsapp_group", "WhatsApp group social link (legacy)", 255, "url"],
    ["social_instagram", "Instagram", 255, "url"],
    ["social_youtube", "YouTube", 255, "url"],
    ["social_linkedin", "LinkedIn", 255, "url"],
  ],
  branding: [
    ["logo", "Logo URL or stored asset path", 255, "asset"],
    ["favicon", "Favicon URL or stored asset path", 255, "asset"],
  ],
};

const allFields = Object.values(fields).flat();
const defaults = Object.fromEntries(allFields.map(([name]) => [name, ""]));
const defaultValues = {
  ...defaults,
  site_name: "Gab Powerful Consult",
  services: [],
  businessPhones: [{ value: "" }],
  officePhones: [{ value: "" }],
};

const optionalString = (max) => {
  let rule = yup.string().transform((value) => value == null ? "" : value).trim();
  if (max) rule = rule.max(max, `Maximum ${max} characters`);
  return rule;
};
const urlRule = (max) => optionalString(max).test(
  "valid-url", "Enter a valid http(s) URL", (value) => {
    if (!value) return true;
    try { return ["http:", "https:"].includes(new URL(value).protocol); }
    catch { return false; }
  },
);
const phoneRule = optionalString(30).test(
  "valid-phone", "Enter a valid phone number", (value) =>
    !value || /^\+?[0-9() .-]{7,30}$/.test(value),
);

const shape = Object.fromEntries(allFields.map(([name, , max, type]) => [
  name,
  type === "url" ? urlRule(max) : type === "email"
    ? optionalString(max).email("Enter a valid email address")
    : type === "tel" ? phoneRule : optionalString(max),
]));
shape.site_name = optionalString(100).required("Site name is required");
shape.businessPhones = yup.array().of(yup.object({ value: phoneRule })).required();
shape.officePhones = yup.array().of(yup.object({ value: phoneRule })).required();
shape.services = yup.array().of(yup.object({
  title: optionalString(200).required("Service title is required"),
  description: optionalString(),
  icon: optionalString(100),
})).required();
const schema = yup.object(shape);

const parseArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};
const unwrap = (response) => {
  // Supports axios {data: {...}}, {data: {data: {...}}}, or direct settings.
  const value = response?.data ?? response;
  const result = value?.data ?? value;
  return Array.isArray(result) ? result[0] : result;
};
const normalize = (response) => {
  const source = unwrap(response);
  if (!source || typeof source !== "object") return defaultValues;
  const values = Object.fromEntries(allFields.map(([name]) => [name, source[name] ?? ""]));
  return {
    ...values,
    services: parseArray(source.services).map((service) =>
      typeof service === "string"
        ? { title: service, description: "", icon: "" }
        : { title: service?.title ?? "", description: service?.description ?? "", icon: service?.icon ?? "" },
    ),
    businessPhones: (parseArray(source.businessPhones).length
      ? parseArray(source.businessPhones) : [""]).map((value) => ({ value: String(value ?? "") })),
    officePhones: (parseArray(source.officePhones).length
      ? parseArray(source.officePhones) : [""]).map((value) => ({ value: String(value ?? "") })),
  };
};
const toPayload = (values) => ({
  ...Object.fromEntries(allFields.map(([name]) => [name, values[name]?.trim() || null])),
  site_name: values.site_name.trim(),
  services: values.services.map(({ title, description, icon }) => ({
    title: title.trim(), description: description?.trim() || "", icon: icon?.trim() || "",
  })),
  businessPhones: values.businessPhones.map(({ value }) => value.trim()).filter(Boolean),
  officePhones: values.officePhones.map(({ value }) => value.trim()).filter(Boolean),
});

function Section({ title, description, children }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
      <Typography variant="h6" fontWeight={700}>{title}</Typography>
      {description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{description}</Typography>}
      <Divider sx={{ mb: 2 }} />
      {children}
    </Paper>
  );
}
function Field({ name, label, max, type, control, errors }) {
  const error = errors[name];
  return (
    <Grid item xs={12} sm={type === "multiline" ? 12 : 6}>
      <Controller name={name} control={control} render={({ field }) => (
        <TextField
          {...field} value={field.value ?? ""} fullWidth label={label}
          type={["email", "tel", "url"].includes(type) ? type : "text"}
          multiline={type === "multiline"} minRows={type === "multiline" ? 4 : undefined}
          inputProps={max ? { maxLength: max } : undefined}
          error={!!error} helperText={error?.message}
          size="small"
        />
      )} />
    </Grid>
  );
}
function FieldGroup({ items, control, errors }) {
  return (
    <Grid container spacing={2}>
      {items.map(([name, label, max, type]) =>
        <Field key={name} {...{ name, label, max, type, control, errors }} />)}
    </Grid>
  );
}
function PhoneEditor({ name, label, control, errors }) {
  const { fields: rows, append, remove } = useFieldArray({ control, name });
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography>
      <Stack spacing={1}>
        {rows.map((row, index) => (
          <Stack key={row.id} direction="row" alignItems="flex-start" spacing={1}>
            <Controller name={`${name}.${index}.value`} control={control} render={({ field }) => (
              <TextField {...field} value={field.value ?? ""} fullWidth size="small"
                label={`Phone ${index + 1}`} type="tel" inputProps={{ maxLength: 30 }}
                error={!!errors[name]?.[index]?.value}
                helperText={errors[name]?.[index]?.value?.message} />
            )} />
            <IconButton aria-label={`Remove ${label} ${index + 1}`} color="error"
              onClick={() => remove(index)}><Delete /></IconButton>
          </Stack>
        ))}
        <Button startIcon={<Add />} onClick={() => append({ value: "" })}
          variant="outlined" size="small" sx={{ alignSelf: "flex-start" }}>Add number</Button>
      </Stack>
    </Box>
  );
}
function ServicesEditor({ control, errors }) {
  const { fields: rows, append, remove } = useFieldArray({ control, name: "services" });
  return (
    <Stack spacing={2}>
      {rows.map((row, index) => (
        <Paper key={row.id} variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="flex-start">
            {[["title", "Service title"], ["description", "Description"], ["icon", "Icon identifier (optional)"]]
              .map(([key, label]) => (
                <Grid item xs={12} md={key === "description" ? 5 : key === "title" ? 4 : 3} key={key}>
                  <Controller name={`services.${index}.${key}`} control={control} render={({ field }) => (
                    <TextField {...field} value={field.value ?? ""} size="small" fullWidth label={label}
                      error={!!errors.services?.[index]?.[key]}
                      helperText={errors.services?.[index]?.[key]?.message} />
                  )} />
                </Grid>
              ))}
            <Grid item xs={12}>
              <Button color="error" size="small" startIcon={<Delete />}
                onClick={() => remove(index)}>Remove service</Button>
            </Grid>
          </Grid>
        </Paper>
      ))}
      <Button variant="outlined" startIcon={<Add />}
        onClick={() => append({ title: "", description: "", icon: "" })}
        sx={{ alignSelf: "flex-start" }}>Add service</Button>
    </Stack>
  );
}
function Preview({ control }) {
  const values = useWatch({ control });
  const services = values.services ?? [];
  return (
    <Paper variant="outlined" sx={{ p: 3, position: { md: "sticky" }, top: 16, borderRadius: 2 }}>
      <Typography variant="h6" fontWeight={700}>Live preview</Typography>
      <Divider sx={{ my: 2 }} />
      <Typography variant="h5">{values.site_name || "Site name"}</Typography>
      <Typography color="text.secondary">{values.site_tagline || "Tagline"}</Typography>
      <Typography sx={{ my: 2, whiteSpace: "pre-wrap" }}>{values.about}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        {services.filter((service) => service.title?.trim()).map((service, index) =>
          <Chip key={index} label={service.title} size="small" />)}
      </Stack>
      <Typography variant="subtitle2">Contact</Typography>
      <Typography variant="body2">{values.email}</Typography>
      <Typography variant="body2">Business: {values.businessPhones?.map((p) => p.value).filter(Boolean).join(", ")}</Typography>
      <Typography variant="body2">Office: {values.officePhones?.map((p) => p.value).filter(Boolean).join(", ")}</Typography>
      <Typography variant="body2">{[values.address, values.city, values.region, values.country].filter(Boolean).join(", ")}</Typography>
    </Paper>
  );
}
export default function SiteSettings() {
  const { customDispatch } = useCustomContext();
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["site-settings"], queryFn: getSiteSettings,
  });
  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm({
    resolver: yupResolver(schema), defaultValues, mode: "onBlur",
  });
  const normalized = useMemo(() => data ? normalize(data) : null, [data]);
  useEffect(() => { if (normalized && !isDirty) reset(normalized); }, [normalized, reset, isDirty]);

  const mutation = useMutation({
    mutationFn: updateSiteSettings,
    onSuccess: async (response) => {
      customDispatch(globalAlertType("success", "Site settings updated successfully"));
      // Prefer the server's canonical representation after saving.
      const saved = unwrap(response);
      if (saved && typeof saved === "object" && (saved.site_name || saved.id)) {
        reset(normalize(saved));
      } else {
        const fresh = await queryClient.fetchQuery({ queryKey: ["site-settings"], queryFn: getSiteSettings, staleTime: 0 });
        reset(normalize(fresh));
      }
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (err) => customDispatch(globalAlertType("error", err?.response?.data?.message || err.message || "Unable to save settings")),
  });
  const onSubmit = async (values) => {
    const result = await Swal.fire({
      title: "Save site settings?", text: "Your public website information will be updated.",
      icon: "question", showCancelButton: true, confirmButtonText: "Save changes",
    });
    if (result.isConfirmed) mutation.mutate(toPayload(values));
  };
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}><CircularProgress /></Box>;
  if (isError) return (
    <Container sx={{ py: 4 }}><Alert severity="error">{error?.message || "Failed to load site settings"}</Alert>
      <Button sx={{ mt: 2 }} onClick={() => refetch()}>Retry</Button></Container>
  );
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Site settings</Typography>
          <Typography color="text.secondary">Manage GPCPins website content, contact details and branding.</Typography>
        </Box>
        <Button variant="outlined" onClick={() => setShowPreview((value) => !value)}>
          {showPreview ? "Hide preview" : "Show preview"}
        </Button>
      </Stack>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Grid container spacing={3}>
          <Grid item xs={12} md={showPreview ? 8 : 12}>
            <Stack spacing={3}>
              <Section title="General information"><FieldGroup items={fields.general} control={control} errors={errors} /></Section>
              <Section title="Services" description="Edit the services shown on your website."><ServicesEditor control={control} errors={errors} /></Section>
              <Section title="Contact information">
                <Stack spacing={3}>
                  <FieldGroup items={fields.contact} control={control} errors={errors} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}><PhoneEditor name="businessPhones" label="Business phone numbers" control={control} errors={errors} /></Grid>
                    <Grid item xs={12} md={6}><PhoneEditor name="officePhones" label="Office phone numbers" control={control} errors={errors} /></Grid>
                  </Grid>
                </Stack>
              </Section>
              <Section title="Location"><FieldGroup items={fields.location} control={control} errors={errors} /></Section>
              <Section title="WhatsApp community"><FieldGroup items={fields.community} control={control} errors={errors} /></Section>
              <Section title="Social media"><FieldGroup items={fields.social} control={control} errors={errors} /></Section>
              <Section title="Branding" description="Enter an existing hosted image URL or asset path. Uploads require a separate media endpoint.">
                <FieldGroup items={fields.branding} control={control} errors={errors} />
              </Section>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button type="submit" variant="contained" startIcon={<Save />}
                  disabled={mutation.isPending || isFetching || !isDirty}>
                  {mutation.isPending ? "Saving..." : "Save changes"}
                </Button>
                <Button type="button" variant="outlined" startIcon={<Refresh />}
                  disabled={mutation.isPending || !isDirty}
                  onClick={async () => {
                    const result = await Swal.fire({ title: "Discard unsaved changes?", icon: "warning", showCancelButton: true });
                    if (result.isConfirmed && normalized) reset(normalized);
                  }}>Discard changes</Button>
              </Stack>
            </Stack>
          </Grid>
          {showPreview && <Grid item xs={12} md={4}><Preview control={control} /></Grid>}
        </Grid>
      </Box>
    </Container>
  );
}
