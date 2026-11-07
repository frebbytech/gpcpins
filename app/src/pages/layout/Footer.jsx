import { useMemo } from "react";
import {
  MailOutline,
  MapOutlined,
  PhoneOutlined,
  PinDropOutlined,
  MyLocationOutlined,
  Facebook,
  Instagram,
  LinkedIn,
  YouTube,
  WhatsApp,
  MusicNote,
  X,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Container,
  Divider,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const QUICK_LINKS = [
  { label: "Home", to: "/" },
  { label: "Vouchers & Tickets", to: "/evoucher" },
  { label: "Prepaid Units", to: "/electricity" },
  { label: "Airtime & Data Bundle", to: "/airtime" },
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms and Conditions", to: "/terms-and-conditions" },
];

const parsePhoneList = (value) => {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = parsed.trim() ? [parsed] : [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
};

const safeExternalUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const whatsappUrl = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
};

const PhoneGroup = ({ title, phones }) => {
  if (!phones.length) return null;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: "primary.main", mb: 0.5 }}>
        {title}
      </Typography>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5}>
        {phones.map((phone) => (
          <MuiLink
            key={phone}
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            underline="hover"
            color="inherit"
            sx={{ overflowWrap: "anywhere" }}
          >
            {phone}
          </MuiLink>
        ))}
      </Stack>
    </Box>
  );
};

function Footer() {
  const { data } = useSiteSettings();
  // Support both direct settings objects and { data: settings } API responses.
  const settings = data?.data?.siteSettings ?? data?.data ?? data?.siteSettings ?? data ?? {};

  const businessPhones = useMemo(
    () => parsePhoneList(settings.businessPhones),
    [settings.businessPhones],
  );
  const officePhones = useMemo(
    () => parsePhoneList(settings.officePhones),
    [settings.officePhones],
  );

  const directionsUrl = useMemo(() => {
    const configured = safeExternalUrl(settings.map_link);
    if (configured) return configured;
    const location = [settings.address, settings.city, settings.region, settings.country]
      .filter(Boolean)
      .join(", ") || settings.gps;
    return location
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`
      : null;
  }, [settings.map_link, settings.address, settings.city, settings.region, settings.country, settings.gps]);

  const socialLinks = [
    { label: "WhatsApp", url: safeExternalUrl(settings.social_whatsapp) || whatsappUrl(settings.whatsapp), Icon: WhatsApp },
    { label: "Facebook", url: safeExternalUrl(settings.social_facebook), Icon: Facebook },
    { label: "X", url: safeExternalUrl(settings.social_x), Icon: X },
    { label: "Instagram", url: safeExternalUrl(settings.social_instagram), Icon: Instagram },
    { label: "TikTok", url: safeExternalUrl(settings.social_tiktok), Icon: MusicNote },
    { label: "YouTube", url: safeExternalUrl(settings.social_youtube), Icon: YouTube },
    { label: "LinkedIn", url: safeExternalUrl(settings.social_linkedin), Icon: LinkedIn },
    { label: "WhatsApp Group", url: safeExternalUrl(settings.whatsappGroupLink) || safeExternalUrl(settings.social_whatsapp_group), Icon: WhatsApp },
    { label: "WhatsApp Channel", url: safeExternalUrl(settings.whatsappChannelLink), Icon: WhatsApp },
  ].filter(({ url }) => Boolean(url));

  const siteName = settings.site_name || "Gab Powerful Consult";
  const address = settings.address || "Menhyia - Opposite St. Anne's International School, P.O. Box KS 12656, Adum-Kumasi";
  const email = settings.email || "info@gpcpins.com";
  const gps = settings.gps || "AK-004-5284";

  return (
    <Box component="footer" className="main-footer" sx={{ bgcolor: "secondary.main", color: "secondary.contrastText", pt: 4, pb: { xs: 5, md: 2 } }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "1fr 1.25fr 1.5fr" }, gap: 4, pb: 4 }}>
          <Stack spacing={1.25}>
            <Typography variant="h6" color="primary.main" fontWeight={700}>Quick Links</Typography>
            {QUICK_LINKS.map(({ label, to }) => (
              <MuiLink key={to} component={RouterLink} to={to} color="inherit" underline="hover" sx={{ width: "fit-content" }}>
                {label}
              </MuiLink>
            ))}
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="h6" color="primary.main" fontWeight={700}>Contact Info</Typography>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <PinDropOutlined fontSize="small" />
              <Typography variant="body2">{address}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <MailOutline fontSize="small" />
              <MuiLink color="inherit" underline="hover" href={`mailto:${email}`}>{email}</MuiLink>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <MyLocationOutlined fontSize="small" />
              <Typography variant="body2">{gps}</Typography>
            </Stack>
            {settings.whatsapp && (
              <Stack direction="row" spacing={1} alignItems="center">
                <PhoneOutlined fontSize="small" />
                <MuiLink href={whatsappUrl(settings.whatsapp)} target="_blank" rel="noopener noreferrer" color="inherit" underline="hover">
                  WhatsApp: {settings.whatsapp}
                </MuiLink>
              </Stack>
            )}
            {directionsUrl && (
              <Button variant="outlined" size="small" startIcon={<MapOutlined />} component="a" href={directionsUrl} target="_blank" rel="noopener noreferrer" sx={{ alignSelf: "flex-start" }}>
                Get Directions
              </Button>
            )}
          </Stack>

          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" color="primary.main" fontWeight={700} gutterBottom>Call Center</Typography>
              <Typography variant="body2">Our Support & Sales Team is Available 24/7 to Answer Your Queries.</Typography>
            </Box>
            <PhoneGroup title="Business Lines" phones={businessPhones} />
            <PhoneGroup title="Office Lines" phones={officePhones} />
            {socialLinks.length > 0 && (
              <Box>
                <Typography variant="h6" color="primary.main" fontWeight={700} gutterBottom>Follow Us</Typography>
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                  {socialLinks.map(({ label, url, Icon }) => (
                    <MuiLink key={label} href={url} target="_blank" rel="noopener noreferrer" color="inherit" aria-label={label} title={label}
                      sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", p: 0.75, borderRadius: 1, border: "1px solid", borderColor: "divider", "&:hover": { color: "primary.main" } }}>
                      <Icon fontSize="small" />
                    </MuiLink>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
        <Divider sx={{ borderColor: "currentColor", opacity: 0.2 }} />
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" spacing={1} sx={{ pt: 2 }}>
          <Typography variant="body2" textAlign="center">© {new Date().getFullYear()} {siteName}. All rights reserved.</Typography>
          <Typography variant="body2" textAlign="center">
            Crafted by{" "}
            <MuiLink href="https://nanaakwasi.dev" target="_blank" rel="noopener noreferrer" sx={{ color: "#5CE0E6" }}>
              nanaakwasi.dev
            </MuiLink>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default Footer;



// import { Mail, MapOutlined, Phone } from "@mui/icons-material";
// import {
//   Box,
//   Button,
//   Container,
//   Divider,
//   Stack,
//   Typography,
// } from "@mui/material";
// import { Link } from "react-router-dom";
// import PinDropIcon from "@mui/icons-material/PinDrop";
// import MyLocationIcon from "@mui/icons-material/MyLocation";
// import Facebook from "@/components/jsx-icons/Facebook";
// import Whatsapp from "@/components/jsx-icons/Whatsapp";
// import Twitter from "@/components/jsx-icons/Twitter";
// import Instagram from "@/components/jsx-icons/Instagram";
// import { useSiteSettings } from "@/hooks/useSiteSettings";

// function Footer() {
//   const { data: siteSettings } = useSiteSettings();

//   // console.log("siteSettings", siteSettings);

//   const getLocation = () => {
//     const position = [6.70675631287526, -1.6189752122036272];
//     const destination = `${position[0]},${position[1]}`;
//     const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
//     window.open(googleMapsUrl, "_blank");
//   };

//   return (
//     <div className="main-footer">
//       <Box
//         sx={{
//           bgcolor: "secondary.main",
//           color: "secondary.contrastText",
//           py: 1,
//           pb: { xs: 5, md: 0 },
//         }}
//       >
//         <Container
//           sx={{
//             display: "flex",
//             flexDirection: { xs: "column", md: "row" },
//             justifyContent: "space-between",
//             alignItems: "flex-start",
//             py: 1,
//             gap: 2,
//           }}
//         >
//           <Stack spacing={1}>
//             <Typography variant="body1" color="primary" paragraph>
//               Quick Links
//             </Typography>
//             <Link className="footer-link" to="/">
//               Home
//             </Link>
//             <Link className="footer-link" to="/evoucher">
//               Vouchers & Tickets
//             </Link>
//             <Link className="footer-link" to="/electricity">
//               Prepaid Units
//             </Link>
//             <Link className="footer-link" to="/airtime">
//               Airtime & Data Bundle
//             </Link>
//             <Link className="footer-link" to="privacy-policy">
//               Privacy Policy
//             </Link>
//             <Link className="footer-link" to="terms-and-conditions">
//               Terms and Conditions
//             </Link>
//           </Stack>
//           <Stack spacing={1}>
//             <Typography variant="body1" color="primary" paragraph>
//               Contact Info
//             </Typography>
//             <Stack
//               width="100%"
//               alignItems="flex-start"
//               justifyContent="flex-start"
//               spacing={1}
//             >
//               <div className="footer-contact-item">
//                 <PinDropIcon fontSize="small" />
//                 <span>
//                   {siteSettings?.address ||
//                     "Manhyia-Opposite St. Anne&apos;s International School"}
//                 </span>
//               </div>
//               <div className="footer-contact-item">
//                 <Phone fontSize="small" />
//                 <span>
//                   {" "}
//                   { "P.O Box KS 12656,Adum-Kumasi"}
//                 </span>
//               </div>
//               <div className="footer-contact-item">
//                 <Mail fontSize="small" />
//                 <span> {siteSettings?.email || "info@gpcpins.com"}</span>
//               </div>
//               <div className="footer-contact-item">
//                 <MyLocationIcon fontSize="small" />
//                 <span> {siteSettings?.gps || "AK-004-5284"}</span>
//               </div>
//               <Button
//                 variant="outlined"
//                 size="small"
//                 sx={{ py: 0, px: 1 }}
//                 startIcon={<MapOutlined />}
//                 onClick={getLocation}
//               >
//                 Get Directions
//               </Button>
//             </Stack>
//           </Stack>

//           <Box>
//             <Stack>
//               <Typography variant="body1" color="primary" paragraph>
//                 Call Center
//               </Typography>
//               <Typography variant="body2">
//                 Our Support & Sales Team is Available 24/7 to Answer Your
//                 Queries.
//               </Typography>
//               <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
//                 <Typography color="#f78e2a">Business Lines :</Typography>
//                 <a className="footer-line-link" href="tel:+233244012766">
//                   {siteSettings?.businessPhone || "+233244012766"}
//                 </a>
//                 <a className="footer-line-link" href="tel:+233277155144">
//                   {siteSettings?.businessPhone2 || "+233277155144"}
//                 </a>
//                 <a className="footer-line-link" href="tel:+233208775458">
//                   {siteSettings?.businessPhone3 || "+233208775458"}
//                 </a>
//                 <a className="footer-line-link" href="tel:+233555763713">
//                   {siteSettings?.businessPhone4 || "+233555763713"}
//                 </a>
//               </div>
//               <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
//                 <Typography color="#f78e2a">Office Lines : </Typography>
//                 <a className="footer-line-link" href="tel:0322036582">
//                   {siteSettings?.officePhone || "0322036582"}
//                 </a>
//                 <a className="footer-line-link" href="tel:0555763713">
//                   {siteSettings?.officePhone2 || "0555763713"}
//                 </a>
//                 <a className="footer-line-link" href="tel:+233277155144">
//                   {siteSettings?.officePhone3 || "+233277155144"}
//                 </a>
//                 <a className="footer-line-link" href="tel:+233208775458">
//                   {siteSettings?.officePhone4 || "+233208775458"}
//                 </a>
//               </div>
//             </Stack>
//             <Stack>
//               <Typography variant="body1" color="primary" paragraph>
//                 Follow Us
//               </Typography>
//               <Stack direction="row" spacing={1}>
//                 <Whatsapp height={24} width={24} />
//                 <Facebook height={24} width={24} />
//                 <Twitter height={24} width={24} />
//                 <Instagram height={24} width={24} />
//               </Stack>
//             </Stack>
//           </Box>
//         </Container>
//         <Divider flexItem />
//         <Container
//           sx={{
//             py: 1,
//             pb: 4,
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "space-between",
//             gap: 1,
//           }}
//         >
//           <Typography variant="body2" textAlign="center" paragraph pt={1}>
//             Copyright &copy; {new Date().getFullYear()} | Gab Powerful Consult
//           </Typography>
//           <Typography textAlign="center" variant="body2">
//             Crafted by
//             <a
//               rel="noreferrer"
//               target="_blank"
//               href="https://nanaakwasi.dev"
//               style={{
//                 textDecoration: "underline",
//                 color: "#5CE0E6",
//                 marginLeft: "4px",
//               }}
//             >
//               nanaakwasi.dev
//             </a>
//             {"  "}
//           </Typography>
//         </Container>
//       </Box>
//     </div>
//   );
// }

// export default Footer;
