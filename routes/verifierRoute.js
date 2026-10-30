const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const bcrypt = require("bcryptjs");
const { otpGen } = require("otp-gen-agent");
const { signMainToken, signMainRefreshToken } = require("../config/token");
const multer = require("multer");
const moment = require("moment");
const { rateLimit } = require("express-rate-limit");
const sendMail = require("../config/sendEmail");
const {
  verifyToken,
  verifyRefreshToken,
  removeUser,
} = require("../middlewares/verifyToken");
const { isValidUUID2 } = require("../config/validation");
const verifyScanner = require("../middlewares/verifyScanner");
const { uploadPhoto } = require("../config/uploadFile");
const { mailTextShell } = require("../config/mailText");
const { signResetToken, verifyResetToken } = require("../config/resetToken");
const crypto = require("crypto");

const limit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // 200 requests per windowMs (per IP)
  message: "Too many requests! Please try again later.",
});

// Per-account limiter for credential / OTP endpoints. Keyed by the account
// identifier in the body (falls back to IP) so an attacker cannot brute-force
// one account's 6-digit OTP by rotating IPs.
const normalizeIdentifier = (body = {}) =>
  String(body.email ?? body.contact ?? body.id ?? "")
    .trim()
    .toLowerCase();

const accountLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => normalizeIdentifier(req.body) || req.ip,
  validate: false,
  message: "Too many attempts! Please try again later.",
});

const PASSWORD_MIN_LENGTH = 8;
const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

const ROLE_CODES = () => [process.env.ADMIN_ID, process.env.SCANNER_ID];

// Finds an ADMIN/SCANNER account by email or phone number.
const findAccount = async (db, { contact, type }) => {
  if (!isNonEmptyString(contact)) return null;
  const column =
    type === "phone" ? "phonenumber" : type === "email" ? "email" : null;
  if (!column) return null;

  const user = await db("users")
    .join("roles", "users.role_id", "roles.id")
    .select(
      "users.id",
      "users.email",
      "users.phonenumber",
      "users.password",
      "users.active",
      "users.is_enabled",
      "roles.code",
    )
    .where(`users.${column}`, contact.trim())
    .first();

  return user && ROLE_CODES().includes(user.code) ? user : null;
};

const isAccountOpen = (user) =>
  Boolean(user) && Number(user.active) !== 0 && Number(user.is_enabled) !== 0;

const revokeUserTokens = (db, userId) =>
  db("user_tokens").where({ user_id: userId }).update({ is_revoked: true });

const knex = require("../db/knex");
const { sendOTPSMS } = require("../config/sms");
const generateId = require("../config/generateId");
const { getVerifier } = require("./users/authUsers");
const generateRandomNumber = require("../config/generateRandomCode");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { verifyOTP, storeOTP } = require("../services/otp.services");
const { safeJSON } = require("../config/helpers");
const generateDeviceId = require("../utils/deviceFingerprint");
const logger = require("../utils/logger");
const { getExpiryTimeByRole } = require("../utils/helper");
const { parseTimeToMs } = require("../utils/time");

const Storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./images/");
  },
  filename: function (req, file, cb) {
    const ext = file?.mimetype?.split("/")[1];

    cb(null, `${generateId(10)}.${ext}`);
  },
});

const Upload = multer({ storage: Storage });

// Define the route for getting all non-scanner verifiers
router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    // Fetch all non-scanner verifiers from the database
    const verifiers = await knex("vw_users_with_roles")
      .select(
        "id",
        "firstname",
        "lastname",
        "username",
        "name",
        "email",
        "phonenumber",
        "nid",
        "dob",
        "residence",
        "permissions",
        "role",
        "profile",
        "active",
      )
      .where("role", process.env.SCANNER_ID);

    // Map through the verifiers and modify the permissions property
    const modifiedVerifiers = verifiers.map(({ permissions, ...rest }) => {
      // Parse the permissions string to a JSON object
      return {
        ...rest,
        role: "Verifier",
        permissions: safeJSON(permissions),
      };
    });

    // Send the modified verifiers as a JSON response with a 200 status code
    res.status(200).json(modifiedVerifiers);
  }),
);

router.get(
  "/auth",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid ID!");
    }

    const user = await knex("vw_users_with_roles")
      .select("*")
      .where("id", id)
      .whereNot("email", "customer@gpcpins.com")
      .first();

    if (
      _.isEmpty(user) ||
      Boolean(user?.active) === false ||
      user?.email === "customer@gpcpins.com"
    ) {
      return res.sendStatus(204);
    }

    res.status(200).json({
      user: {
        id: user?.id,
        firstname: user?.firstname,
        lastname: user?.lastname,
        name: user?.name,
        email: user?.email,
        role: user?.role,
        nid: user?.nid,
        dob: user?.dob,
        phonenumber: user?.phonenumber,
        profile: user?.profile,
        active: Boolean(user?.active),
      },
    });
  }),
);

router.get(
  "/auth/token",
  limit,
  verifyRefreshToken,
  asyncHandler(async (req, res) => {
    const accessToken = req.accessToken;

    res.status(200).json({
      accessToken,
    });
  }),
);

// Confirm NID and/or date of birth against the signed-in account.
// POST with a JSON body: values in a query string end up in access logs,
// proxies and browser history. Values are compared with the database row (not
// token claims), in constant time, with one generic mismatch message, and
// are never logged. Limited to 10 attempts / 15 min per account.
const identityLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  validate: false,
  message: "Too many attempts! Please try again later.",
});

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a ?? "").trim());
  const y = Buffer.from(String(b ?? "").trim());
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

router.post(
  "/verify-identity",
  verifyToken,
  verifyScanner,
  identityLimit,
  asyncHandler(async (req, res) => {
    const { nid, dob } = req.body ?? {};

    if (!isNonEmptyString(nid) && !isNonEmptyString(dob)) {
      return res
        .status(400)
        .json(
          "Please provide either National ID (nid) or Date of Birth (dob).",
        );
    }

    const stored = await knex("users")
      .select("nid", "dob")
      .where("id", req.user.id)
      .first();

    if (!stored) {
      return res
        .status(400)
        .json("Unable to verify identity. Please contact support.");
    }

    if (isNonEmptyString(nid)) {
      if (!stored.nid || !safeEqual(nid, stored.nid)) {
        logger.warn(`Identity verification failed for user ${req.user.id}`);
        return res
          .status(400)
          .json("The details provided do not match our records.");
      }
    }

    if (isNonEmptyString(dob)) {
      if (!stored.dob || !moment(dob).isSame(moment(stored.dob), "day")) {
        logger.warn(`Identity verification failed for user ${req.user.id}`);
        return res
          .status(400)
          .json("The details provided do not match our records.");
      }
    }

    res.status(200).json("OK");
  }),
);

router.get(
  "/phonenumber/token",
  limit,
  verifyToken,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { code } = req.query;

    if (code) {
      const result = await verifyOTP(user.id, Number(code));

      if (!result.success) {
        return res.status(400).json("Invalid Code");
      }
    } else {
      if (_.isEmpty(user) && !user?.phonenumber) {
        return res.status(400).json("Invalid Request");
      }

      const code = await otpGen();

      if (process.env.NODE_ENV !== "production") {
        console.log(code);
      }

      await storeOTP(user?.id, code);

      await sendOTPSMS(
        `Please ignore this message if you did not request the OTP.Your verification code is ${code}.Don't share this code with anyone; Our employees will never ask for the code.If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.`,
        user?.phonenumber,
      );
    }

    res.sendStatus(201);
  }),
);

router.get(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid ID!");
    }

    const verifier = await knex("vw_users_with_roles")
      .select(
        "id",
        "firstname",
        "lastname",
        "username",
        "name",
        "email",
        "nid",
        "dob",
        "residence",
        "permissions",
        "phonenumber",
        "role",
        "profile",
        "active",
      )
      .where({
        id: id,
      })
      .first();

    if (_.isEmpty(verifier)) {
      return res.status(400).json({});
    }

    const { permissions, ...rest } = verifier;
    delete rest.role;

    const modifiedVerifier = {
      ...rest,
      permissions: safeJSON(permissions),
      role: "Verifier",
    };

    res.status(200).json(modifiedVerifier);
  }),
);

router.post(
  "/",
  verifyToken,
  verifyAdmin,
  Upload.single("profile"),
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;
    const newVerifier = req.body;

    const transx = await knex.transaction();

    try {
      const doesVerifierExists = await transx("vw_users_with_roles")
        .select("email")
        .where("email", newVerifier.email)
        .first();

      if (!_.isEmpty(doesVerifierExists)) {
        await transx.rollback();
        return res
          .status(400)
          .json("An verifier with this account already exists!");
      }
      const doesPhoneNumberExists = await transx("vw_users_with_roles")
        .select("phonenumber")
        .where("phonenumber", newVerifier.phonenumber)
        .first();

      if (!_.isEmpty(doesPhoneNumberExists)) {
        await transx.rollback();
        return res
          .status(400)
          .json(`Phone number, '${newVerifier.phonenumber}' is not available!`);
      }

      const doesUserNameExists = await transx("vw_users_with_roles")
        .select("username")
        .where("username", newVerifier?.username)
        .first();

      if (!_.isEmpty(doesUserNameExists)) {
        await transx.rollback();
        return res
          .status(400)
          .json(`Username, '${newVerifier?.username}' is not available!`);
      }

      newVerifier.role = process.env.SCANNER_ID;
      let url = req.file?.filename;

      if (req.file) {
        url = await uploadPhoto(req.file);
      }

      const verifierId = generateId();
      const password = generateRandomNumber(10);
      const hashedPassword = await bcrypt.hash(password, 12);

      const role = await transx("roles")
        .select("id")
        .where("code", process.env.SCANNER_ID)
        .first();

      const verifier = await transx("users").insert({
        id: verifierId,
        username: newVerifier.username,
        email: newVerifier.email,
        password: hashedPassword,
        firstname: newVerifier.firstname,
        lastname: newVerifier.lastname,
        phonenumber: newVerifier.phonenumber,
        profile: url,
        dob: newVerifier.dob,
        nid: newVerifier.nid,
        residence: newVerifier.residence,
        permissions: JSON.stringify([]),
        role_id: role.id,
        active: true,
        is_enabled: true,
      });

      if (_.isEmpty(verifier)) {
        await transx.rollback();
        return res.status(400).json("Error saving verifier information!");
      }

      //logs
      await transx("activity_logs").insert({
        id: generateId(),
        user_id: USERID,
        title: "Created new verifier account.",
        severity: "info",
      });

      await transx.commit();
      res.status(201).json("Verifier saved successfully!!!");

      setImmediate(async () => {
        // console.log('email', newVerifier?.email);
        // console.log('passwrod', password);
        const message = `<div>
      <h1 style='text-transform:uppercase;'>Welcome to GAB POWERFUL CONSULT.</h1><br/>
      <div style='text-align:left;'>

      <p><strong>Dear ${newVerifier?.firstname} ${newVerifier?.lastname},</strong></p>

      <p>welcome to the team! We look forward to working with you and witnessing your contributions to our company's success.</p>
      

      <p><strong>Details:</strong></p>
      <p><strong>Login URL:</strong> <a href='https://verification.gpcpins.com'>https://verification.gpcpins.com</a></p>
      <p><strong>Username/Email Address:</strong> ${newVerifier?.email}</p>
      <p><strong>Default Password:</strong> ${password}</p>
      <p>We recommend you change your <b>Default Password</b> when you log into your account.</p>

      <p>Best regards,</p>
      
      <p>GAB Powerful Consult Team</p>
   
      </div>

      </div>`;

        await sendMail(
          newVerifier?.email,
          mailTextShell(message),
          "Welcome to GAB POWERFUL CONSULT.",
        );
      });
    } catch (error) {
      await transx.rollback();
      logger.error(`"An error has occurred.Try again later"-${error?.message}`);
      return res.status(400).json("An error has occurred.Try again later");
    }
  }),
);

//@GET verifier by email
//@GET user by email
router.post(
  "/login",
  limit,
  accountLimit,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json("Invalid Email or Password!");
    }

    try {
      const user = await findAccount(knex, { contact: email, type: "email" });

      // Same message for unknown account / wrong role / wrong password so the
      // endpoint cannot be used to discover which emails exist.
      const passwordIsValid = user
        ? await bcrypt.compare(password, user.password)
        : false;

      if (!passwordIsValid) {
        return res.status(400).json("Invalid Email or Password!");
      }

      if (!isAccountOpen(user)) {
        return res.status(400).json("Account disabled!");
      }

      const otp = await otpGen();

      if (process.env.NODE_ENV !== "production") {
        console.log(otp);
      }

      await storeOTP(user.id, otp);

      const message = `
        <div style="width:100%;max-width:500px;margin-inline:auto;">
      <p>Please ignore this message if you did not request the OTP.</p>
        <p>Your verification code is</p>
        <h1>${otp}</h1>
        <p>If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.</p>

        <p>-- Gab Powerful Team --</p>
    </div>
        `;

      await sendMail(user.email, mailTextShell(message));

      await sendOTPSMS(
        `Please ignore this message if you did not request the OTP.Your verification code is ${otp}.If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.`,
        user.phonenumber,
      );

      res.status(201).json({
        id: user.id,
      });
    } catch (error) {
      logger.error(`Login failed: ${error?.message}`);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

//Request a one-time code (forgot password).
//The code is stored with the same service the login flow uses, so that
///verify-otp can check it.
router.post(
  "/send-otp",
  limit,
  accountLimit,
  asyncHandler(async (req, res) => {
    const { contact, type } = req.body ?? {};

    const user = await findAccount(knex, { contact, type });

    // Always answer 201: do not reveal whether the account exists.
    if (!isAccountOpen(user)) {
      return res.sendStatus(201);
    }

    const code = await otpGen();

    if (process.env.NODE_ENV !== "production") {
      console.log(code);
    }

    await storeOTP(user.id, code);

    try {
      if (type === "phone") {
        await sendOTPSMS(
          `Your verification code is ${code}.`,
          user.phonenumber,
        );
      } else {
        const message = `
      <div style="width:100%;max-width:500px;margin-inline:auto;">

      <p>Your verification code is</p>
      <h1>${code}</h1>

      <p>-- Gab Powerful Team --</p>
  </div>
      `;
        await sendMail(user.email, mailTextShell(message));
      }
    } catch (error) {
      logger.error(`send-otp delivery failed: ${error?.message}`);
      return res.status(500).json("An error has occurred!");
    }

    res.sendStatus(201);
  }),
);

//Verify OTP
//  login  : { id, token }               -> { accessToken, refreshToken }
//  reset  : { email|contact, type, token, reset: true } -> { id, resetToken }
router.post(
  "/verify-otp",
  limit,
  accountLimit,
  asyncHandler(async (req, res) => {
    const { id, email, contact, type, token, reset } = req.body ?? {};

    console.log(req.body);

    if (!token || Number.isNaN(Number(token))) {
      return res.status(400).json("Invalid Code");
    }

    // --- Password reset: identify the account by the contact the code was
    // sent to, never by a client supplied id.
    if (reset) {
      const identifier = contact ?? email;
      const account = await findAccount(knex, {
        contact: identifier,
        type: type === "phone" ? "phone" : "email",
      });

      if (!isAccountOpen(account)) {
        return res.status(400).json("Invalid Code");
      }

      const result = await verifyOTP(account.id, Number(token));
      if (!result.success) {
        return res.status(400).json("Invalid Code");
      }

      return res.status(200).json({
        id: account.id,
        resetToken: signResetToken(account.id, account.password),
      });
    }

    // --- Login: the OTP was stored under the id returned by /login. The
    // account is loaded from that id only. (The old code verified the OTP for
    // `id` but issued tokens for the `email` in the body, so any user could
    // sign in as anybody.)
    if (!isNonEmptyString(id)) {
      return res.status(400).json("Invalid Code");
    }

    const result = await verifyOTP(id, Number(token));
    console.log(result);

    if (!result.success) {
      return res.status(400).json("Invalid Code");
    }

    const user = await knex("vw_users_with_roles")
      .select("*")
      .where("id", id)
      .first();

    if (_.isEmpty(user) || !ROLE_CODES().includes(user.role)) {
      return res.status(401).json("Authentication Failed!");
    }

    if (Number(user.active) === 0) {
      return res.status(400).json("Account disabled!");
    }

    let accessData = {
      id: user.id,
      name: user?.name,
      firstname: user?.firstname,
      lastname: user?.lastname,
      email: user?.email,
      dob: user?.dob,
      nid: user?.nid,
      phonenumber: user?.phonenumber,
      role: user?.role,
      profile: user?.profile,
      active: Boolean(user?.active),
      createdAt: user?.created_at,
      permissions: safeJSON(user.permissions),
    };

    if (user?.role === process.env.ADMIN_ID) {
      accessData.isEnabled = true;
      accessData.isAdmin = true;
      accessData.isVerifierAdmin = true;
    }

    const updatedUser = {
      sub: user?.id,
      role: user?.role,
    };
    const deviceId = generateDeviceId(req);

    const [sessionId] = await knex("user_sessions").insert({
      user_id: user.id,
      device_id: deviceId,
      device_name: req.headers["user-agent"],
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    const accessToken = await signMainToken(updatedUser, accessData);
    const refreshToken = signMainRefreshToken(updatedUser);

    const expires = getExpiryTimeByRole(user?.role).refreshTime;
    const expiresMs = parseTimeToMs(expires);

    await knex("user_tokens").insert({
      user_id: user.id,
      session_id: sessionId,
      refresh_token: refreshToken,
      expiresAt: new Date(expiresMs * 1000),
    });
    //logs
    await knex("activity_logs").insert({
      user_id: user.id,
      title: "Logged into account.",
      severity: "info",
    });
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("SSIDV", refreshToken, {
      httpOnly: true,
      secure: isProduction, // true in prod (required over HTTPS), false in dev (http)
      sameSite: "lax", // same-site in both dev and prod, no need for "none"
      path: "/api/gabs/v1/auth/token",
      maxAge: expiresMs,
      name: "SSIDV",
      signed: true,
    });

    res.status(201).json({
      accessToken,
      user: accessData,
    });
  }),
);

router.post(
  "/logout",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { sub: id } = req.authUser;

    res.clearCookie("SSIDV");

    await removeUser(id);

    await knex("activity_logs").insert({
      user_id: id,
      title: "Logged out of account.",
      severity: "info",
    });

    req.authUser = null;
    req.user = null;
    delete req.user;
    delete req.authUser;

    res.sendStatus(204);
  }),
);

// Update account details. Only whitelisted fields can change, and a user can
// only edit their own account (admins may pass `id` to edit a verifier).
// The old code passed the whole request body to `update()`, so any signed-in
// user could change `role_id`, `password`, `active`... on any account.
const PROFILE_FIELDS = ["firstname", "lastname", "dob"];

router.put(
  "/",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id: USERID, isAdmin } = req.user;
    const body = req.body ?? {};

    const targetId = isAdmin && isNonEmptyString(body.id) ? body.id : USERID;
    // blank values are ignored so a partial form can never wipe a name
    const changes = _.pickBy(
      _.pick(body, PROFILE_FIELDS),
      (v) => v !== undefined && v !== null && String(v).trim() !== "",
    );

    if (_.isEmpty(changes)) {
      return res.status(400).json("Nothing to update.");
    }

    const updatedVerifier = await knex("users")
      .where("id", targetId)
      .update(changes);

    if (updatedVerifier !== 1) {
      return res.status(400).json("Error updating verifier information.");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: USERID,
      title: "Updated account details.",
      severity: "info",
    });

    // Only re-issue a token when the caller edited themselves; an admin
    // editing someone else must not receive that person's token.
    if (targetId !== USERID) {
      return res.status(201).json("Changes Saved!");
    }

    const verifier = await getVerifier(targetId);
    const accessToken = await signMainToken(verifier, "180d");

    res.status(201).json({
      accessToken,
    });
  }),
);

router.put(
  "/password",
  limit,
  accountLimit,
  verifyToken,
  asyncHandler(async (req, res) => {
    // Always the signed-in user. The old code trusted `id` from the body.
    const { id } = req.user;
    const { oldPassword, password } = req.body ?? {};

    if (
      !isNonEmptyString(oldPassword) ||
      !isNonEmptyString(password) ||
      password.length < PASSWORD_MIN_LENGTH
    ) {
      return res
        .status(400)
        .json(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    }

    const current = await knex("users")
      .select("password")
      .where("id", id)
      .first();

    const passwordIsValid = current
      ? await bcrypt.compare(oldPassword, current.password)
      : false;

    if (!passwordIsValid) {
      return res.status(400).json("Invalid Password!");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const modifiedVerifier = await knex("users")
      .where({ id, password: current.password })
      .update({ password: hashedPassword });

    if (modifiedVerifier !== 1) {
      return res.status(404).json("Error! Could not save changes.");
    }

    res.status(201).json("Changes Saved!");
  }),
);

// Final step of "forgot password". Requires the `resetToken` returned by
// POST /verify-otp (reset) together with the account id. The token is bound
// to the current password hash, so it works exactly once.
router.put(
  "/password/update",
  limit,
  accountLimit,
  asyncHandler(async (req, res) => {
    const { id, token, password } = req.body ?? {};

    if (!isNonEmptyString(id) || !isNonEmptyString(token)) {
      return res.status(400).json("Invalid Request!");
    }

    if (!isNonEmptyString(password) || password.length < PASSWORD_MIN_LENGTH) {
      return res
        .status(400)
        .json(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    }

    const user = await knex("users")
      .join("roles", "users.role_id", "roles.id")
      .select(
        "users.id",
        "users.password",
        "users.active",
        "users.is_enabled",
        "roles.code",
      )
      .where("users.id", id)
      .first();

    if (
      !user ||
      !ROLE_CODES().includes(user.code) ||
      !isAccountOpen(user) ||
      !verifyResetToken(user.id, user.password, token)
    ) {
      return res.status(400).json("This reset link is invalid or has expired.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // compare-and-set: two simultaneous requests cannot both succeed
    const modifiedVerifier = await knex("users")
      .where({ id: user.id, password: user.password })
      .update({ password: hashedPassword });

    if (modifiedVerifier !== 1) {
      return res.status(400).json("This reset link is invalid or has expired.");
    }

    // sign the account out everywhere
    await revokeUserTokens(knex, user.id);

    await knex("activity_logs").insert({
      user_id: user.id,
      title: "Reset account password.",
      severity: "warning",
    });

    res.sendStatus(204);
  }),
);

// Admin resets a verifier's password and e-mails them the new one.
router.put(
  "/password/reset",
  limit,
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.body ?? {};

    if (!isNonEmptyString(id)) {
      return res.status(400).json("Invalid Request!");
    }

    const target = await knex("vw_users_with_roles")
      .select("id", "role")
      .where("id", id)
      .first();

    if (!target || target.role !== process.env.SCANNER_ID) {
      return res.status(404).json("Error updating verifier information.");
    }

    const code = await otpGen();
    const password = generateRandomNumber(10);

    const newPassword = `${password}${code}@gpc`;
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const modifiedVerifier = await knex("users").where("id", id).update({
      password: hashedPassword,
    });

    if (modifiedVerifier !== 1) {
      return res.status(404).json("Error updating verifier information.");
    }

    await revokeUserTokens(knex, id);

    const verifier = await getVerifier(id);

    const message = `<div>
    <h1 style='text-transform:uppercase;'>Welcome to GAB POWERFUL CONSULT.</h1><br/>
    <div style='text-align:left;'>

    <p><strong>Dear ${verifier?.firstname} ${verifier?.lastname},</strong></p>

    <p>Your password has been changed!</p>
    <p>Your new Password is:<strong> ${newPassword}</strong></p>
    <p>We recommend you change your <b>Your Password</b> when you log into your account.</p>

    <p>Best regards,</p>
    
    <p>GAB Powerful Consult Team</p>
 
    </div>

    </div>`;
    res.status(200).send("Password reset complete!");

    // NOTE: the original only sent this e-mail when NODE_ENV !== "production",
    // so in production the password was reset and nobody was told it.
    setImmediate(async () => {
      try {
        await sendMail(
          verifier?.email,
          mailTextShell(message),
          "Password Reset",
        );
      } catch (error) {
        logger.error(`Password reset e-mail failed: ${error?.message}`);
      }
    });
  }),
);

router.put(
  "/profile",
  verifyToken,
  verifyScanner,
  Upload.single("profile"),
  asyncHandler(async (req, res) => {
    // Own photo only (admins may pass an id).
    const id =
      req.user.isAdmin && isNonEmptyString(req.body?.id)
        ? req.body.id
        : req.user.id;

    if (!req.file) {
      return res.status(404).json("No Image was found!");
    }

    let url = req.file?.filename;

    if (req.file) {
      url = await uploadPhoto(req.file);
    }

    const verifier = await knex("users")
      .where("id", id)
      .update({ profile: url });

    if (verifier !== 1) {
      return res.status(404).json("An unknown error has occurred!");
    }

    //logs
    await knex("activity_logs").insert({
      id: generateId(10),
      user_id: id,
      title: "Updated account profile!",
      severity: "info",
    });

    res.status(201).json(url);
  }),
);

//Enable or Disable Verifier Account
router.put(
  "/account",
  limit,
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;
    const { id, active } = req.body ?? {};

    if (!isNonEmptyString(id) || id === USERID) {
      return res.status(400).json("Invalid Request!");
    }

    const updatedVerifier = await knex("users")
      .where("id", id)
      .update({ active: active, is_enabled: active });

    if (!Boolean(active)) {
      await revokeUserTokens(knex, id);
    }

    if (updatedVerifier !== 1) {
      return res.status(400).json("Error updating verifier info");
    }

    //logs
    await knex("activity_logs").insert({
      id: generateId(10),
      user_id: USERID,
      title: `${
        Boolean(active) === true
          ? "Activated an verifier account!"
          : "Disabled an verifier account!"
      }`,
      severity: "warning",
    });

    res
      .status(201)
      .json(
        Boolean(active) === true ? "Account enabled!" : "Account disabled!",
      );
  }),
);

//@DELETE verifier
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;
    const { id } = req.params;

    if (!isValidUUID2(id) || id === USERID) {
      return res.status(400).json("Invalid Request!");
    }

    const target = await knex("vw_users_with_roles")
      .select("id", "role")
      .where("id", id)
      .first();

    if (!target || target.role !== process.env.SCANNER_ID) {
      return res.status(404).json("Invalid Request!");
    }

    let removed;
    try {
      // The original deleted from the legacy `verifiers` table.
      removed = await knex("users").where("id", id).del();
    } catch (error) {
      if (error?.code === "ER_ROW_IS_REFERENCED_2") {
        return res
          .status(409)
          .json(
            "This verifier has activity on record. Disable the account instead.",
          );
      }
      throw error;
    }

    if (!removed) {
      return res.status(404).json("Invalid Request!");
    }

    await revokeUserTokens(knex, id);

    //logs
    await knex("activity_logs").insert({
      id: generateId(),
      user_id: USERID,
      title: "Deleted an verifier account!",
      severity: "error",
    });

    res.status(200).json("Verifier Removed!");
  }),
);

module.exports = router;
