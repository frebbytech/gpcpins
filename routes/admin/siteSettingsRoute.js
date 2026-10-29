const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const knex = require("../../db/knex");
const verifySuperAdmin = require("../../middlewares/verifyAdmin");
const { verifyToken } = require("../../middlewares/verifyToken");

// ─── Helpers ─────────────────────────────────────────────────────────
const parseJSON = (value, fallback = []) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const formatSettings = (row) => ({
  ...row,
  services: parseJSON(row.services),
});

// ─── GET /admin/site-settings ────────────────────────────────────────
router.get(
  "/",
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req, res) => {
    const settings = await knex("site_settings").first();
    res.status(200).json(formatSettings(settings || {}));
  }),
);

router.get(
  "/public",
  asyncHandler(async (req, res) => {
    const settings = await knex("site_settings").first();
    if (!settings) return res.status(200).json({});
    // Parse services JSON
    res.status(200).json({
      ...settings,
      services: settings.services ? JSON.parse(settings.services) : [],
    });
  }),
);

// ─── PATCH /admin/site-settings ──────────────────────────────────────
router.patch(
  "/",
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const existing = await knex("site_settings").first();

    const data = {
      site_name: payload.site_name,
      site_tagline: payload.site_tagline,
      about: payload.about,
      services: JSON.stringify(payload.services || []),
      email: payload.email,
      phone: payload.phone,
      alternate_phone: payload.alternate_phone,
      office_phone: payload.office_phone,

      whatsapp: payload.whatsapp,
      address: payload.address,
      gps: payload.gps,
      city: payload.city,
      region: payload.region,
      country: payload.country,
      map_link: payload.map_link,
      social_facebook: payload.social_facebook,
      social_x: payload.social_x,
      social_tiktok: payload.social_tiktok,
      social_whatsapp: payload.social_whatsapp,
      social_whatsapp_group: payload.social_whatsapp_group,
      social_instagram: payload.social_instagram,
      social_youtube: payload.social_youtube,
      social_linkedin: payload.social_linkedin,
      logo: payload.logo,
      favicon: payload.favicon,
    };

    if (existing) {
      await knex("site_settings").where("id", existing.id).update(data);
    } else {
      await knex("site_settings").insert(data);
    }

    const updated = await knex("site_settings").first();
    res.status(200).json({
      message: "Site settings updated",
      data: formatSettings(updated),
    });
  }),
);

module.exports = router;
