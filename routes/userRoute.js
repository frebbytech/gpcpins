const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateId = require("../config/generateId");
const { otpGen, customOtpGen } = require("otp-gen-agent");
const multer = require("multer");
const moment = require("moment");
const { rateLimit } = require("express-rate-limit");
const { signMainToken, signMainRefreshToken } = require("../config/token");
const {
  verifyToken,
  verifyRefreshToken,
  removeUser,
} = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");
const sendMail = require("../config/sendEmail");
const { uploadPhoto } = require("../config/uploadFile");

const limit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 5 requests per windowMs
  message: "Too many requests!. please try again later.",
});

//db
const knex = require("../db/knex");
const { isValidUUID2, isValidEmail } = require("../config/validation");
const sendEMail = require("../config/sendEmail");
const { sendOTPSMS, sendSMS } = require("../config/sms");
const { mailTextShell } = require("../config/mailText");
const { getInternationalMobileFormat } = require("../config/PhoneCode");
const generateDeviceId = require("../utils/deviceFingerprint");
const { storeOTP, verifyOTP } = require("../services/otp.services");
const {
  registrationSchema,
  googleRegistrationSchema,
  otpSchema,
  userIdentitySchema,
  loginSchema,
} = require("../utils/validationSchema");
const { validate } = require("../middlewares/validators");
const logger = require("../utils/logger");
const { getExpiryTimeByRole } = require("../utils/helper");
const { parseTimeToMs } = require("../utils/time");

const Storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./images/");
  },
  filename: function (req, file, cb) {
    const ext = file?.mimetype?.split("/")[1];

    cb(null, `${generateId()}.${ext}`);
  },
});

const Upload = multer({ storage: Storage });

const isProduction = process.env.NODE_ENV === "production";

const getPermissions = async (roleId) => {
  const perms = await knex("role_permissions")
    .join("permissions", "role_permissions.permission_id", "permissions.id")
    .where("role_permissions.role_id", roleId)
    .pluck("permissions.description"); // Extracts values directly into a flat array

  return perms;
};

router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const users = await knex("vw_users_with_roles")
      .select(
        "*",
        knex.raw("DATE_FORMAT(dob,'%D %M, %Y') as dobb"),
        "created_at as createdAt",
      )
      .where("role", process.env.USER_ID);

    res.status(200).json(users);
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
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await knex("vw_user_business_view")
      .join("wallets", "vw_user_business_view.id", "=", "wallets.user_id")
      .select("vw_user_business_view.*", "wallets.amount")
      .where("vw_user_business_view.id", id)
      .where("vw_user_business_view.role", process.env.USER_ID)
      .whereNot("email", "customer@gpcpins.com")
      .first();

    if (_.isEmpty(user)) res.status(200).json({});
    // console.log(user);

    res.status(200).json(user);
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

//@GET user by email
router.post(
  "/login",
  limit,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, type } = req.body;

    const loginOption = type === "email" ? "email" : "phonenumber";

    const transx = await knex.transaction();
    try {
      if (type === "email") {
        if (!isValidEmail(email)) {
          return res.status(400).json("Invalid Email Address!");
        }
      }

      const user = await transx("users")
        .select("id", "email", "phonenumber", "active", "is_enabled")
        .where(loginOption, email)
        .first();

      if (_.isEmpty(user)) {
        return res.status(404).json(`We could not find your ${loginOption}!`);
      }

      if (Boolean(user?.is_enabled) === false) {
        return res.status(400).json("Account disabled! Try again later.");
      }

      const otp = await otpGen();

      if (process.env.NODE_ENV !== "production") {
        console.log(otp);
      }

      await storeOTP(user?.id, otp);

      const message = `
        <div style="width:100%;max-width:500px;margin-inline:auto;">
        <h2>Gab Powerful Consult</h2>
        <p>Please ignore this message if you did not request the OTP.</p>
        <p>Your verification code is</p>
        <h1>${otp}</h1>
<p>Don't share this code with anyone; Our employees will never ask for the code.</p>
         <p>If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.</p>

        <p>-- Gab Powerful Team --</p>
    </div>
        `;

      await sendMail(user?.email, mailTextShell(message));

      if (type === "phone") {
        await sendOTPSMS(
          `Please ignore this message if you did not request the OTP.Your verification code is ${otp}.Don't share this code with anyone; Our employees will never ask for the code.If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.`,
          user?.phonenumber,
        );
      }

      await transx.commit();

      res.status(201).json({
        id: user?.id,
      });
    } catch (error) {
      await transx.rollback();
      console.log(error);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

router.post(
  "/login-google-tap",
  limit,
  asyncHandler(async (req, res) => {
    const { credential } = req.body;
    let register = false;
    let user_key = null;

    if (!credential) {
      return res.status(400).json("Authentication Failed");
    }
    const decodedUser = jwt.decode(credential);

    let user = await knex("users")
      .select("email", "is_enabled")
      .where("email", decodedUser?.email)
      .first();

    if (_.isEmpty(user)) {
      const info = {
        id: generateId(),
        name: decodedUser?.name,
        firstname: decodedUser?.given_name,
        lastname: decodedUser?.family_name,
        email: decodedUser?.email,
        phonenumber: decodedUser?.phoneNumber,
        profile: decodedUser?.picture,
        role_id: process.env.USER_ROLE_ID,
        active: true,
      };

      await knex("users").insert(info);

      user_key = await customOtpGen({ length: 4 });

      const hashedPin = await bcrypt.hash(user_key, 12);

      await knex("wallets").insert({
        id: generateId(),
        user_id: info?.id,
        user_key: hashedPin,
      });
      register = true;
    } else {
      if (Boolean(user?.is_enabled) === false) {
        return res.status(400).json("Account disabled! Try again later.");
      }

      await knex("users").where("email", decodedUser?.email).update({
        firstname: decodedUser?.given_name,
        lastname: decodedUser?.family_name,
        phonenumber: decodedUser?.phoneNumber,
        active: 1,
      });
    }
    user = await knex("vw_users_with_roles")
      .select("*")
      .where("email", decodedUser?.email)
      .first();

    if (_.isEmpty(user)) {
      return res.status(401).json("Authentication Failed!");
    }

    await generateAuthSession({
      req,
      res,
      knex,
      authUser: user,
      isRegistering: register,
    });
  }),
);

router.post(
  "/login-google",
  limit,
  validate(googleRegistrationSchema),
  asyncHandler(async (req, res) => {
    const { email, firstname, lastname, phonenumber, profile, register } =
      req.body;

    let user_key = null;
    let userId = "";
    let isRegistering = register;

    let user = await knex("users")
      .select("id", "email", "is_enabled")
      .where("email", email)
      .first();

    if (_.isEmpty(user)) {
      if (!register) {
        return res.status(400).json("User Account not found!");
      }

      const userId = generateId();
      const hashedPassword = await bcrypt.hash(email, 12);

      const info = {
        id: userId,
        firstname,
        lastname,
        email,
        phonenumber,
        profile,
        permissions: JSON.stringify([]),
        password: hashedPassword,
        role_id: process.env.USER_ROLE_ID,
        active: true,
      };

      await knex("users").insert(info);

      user_key = await customOtpGen({ length: 4 });

      const hashedPin = await bcrypt.hash(user_key, 12);

      await knex("wallets").insert({
        id: generateId(),
        user_id: info?.id,
        user_key: hashedPin,
      });

      isRegistering = true;
    } else {
      if (Boolean(user?.is_enabled) === false) {
        return res.status(400).json("Account disabled! Try again later.");
      }
      isRegistering = false;

      userId = user?.id;
    }

    const authUser = await knex("vw_users_with_roles")
      .select("*")
      .where("id", userId)
      .first();

    if (_.isEmpty(authUser)) {
      return res.status(401).json("Authentication Failed!");
    }

    await generateAuthSession({
      req,
      res,
      knex,
      authUser,
      isRegistering: isRegistering,
    });
  }),
);

router.post(
  "/",
  limit,
  validate(registrationSchema),
  asyncHandler(async (req, res) => {
    const newUser = req.body;

    const transx = await knex.transaction();

    try {
      const doesUserExists = await transx("users")
        .select("email")
        .where("email", newUser.email)
        .first();

      if (!_.isEmpty(doesUserExists)) {
        await transx.rollback();
        return res.status(400).json("Email address already taken!");
      }

      const intNumber = getInternationalMobileFormat(newUser.phonenumber);

      const doesPhoneExists = await transx("users")
        .select("phonenumber")
        .where("phonenumber", "IN", [newUser.phonenumber, intNumber]);

      if (!_.isEmpty(doesPhoneExists)) {
        await transx.rollback();

        return res
          .status(400)
          .json("An account with this telephone number already exists!");
      }

      const id = generateId();
      const hashedPassword = await bcrypt.hash(newUser.phonenumber, 12);

      const newAuthUser = {
        id: id,
        email: newUser?.email,
        phonenumber: newUser?.phonenumber,
        role_id: process.env.USER_ROLE_ID,
        password: hashedPassword,
        permissions: JSON.stringify([]),
      };

      const user = await transx("users").insert(newAuthUser);

      if (_.isEmpty(user)) {
        await transx.rollback();
        return res.status(400).json("Error occurred.Could not create user.");
      }

      const user_key = await customOtpGen({ length: 4 });
      const hashedPin = await bcrypt.hash(user_key, 12);

      await transx("wallets").insert({
        id: generateId(),
        user_id: id,
        user_key: hashedPin,
      });

      const otp = await otpGen();
      if (process.env.NODE_ENV !== "production") {
        console.log(otp);
      }

      await storeOTP(id, otp);

      if (newUser?.phonenumber) {
        await sendOTPSMS(
          `Please ignore this message if you did not request the OTP.Your verification code is ${otp}.Don't share this code with anyone; Our employees will never ask for the code.If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.`,
          newUser?.phonenumber,
        );
      }

      //   Send Email to the User with Verification Code
      // await sendMail(userData[0]?.email, mailTextShell(message));
      await transx.commit();

      return res.status(201).json({
        id,
      });
    } catch (error) {
      await transx.rollback();
      console.log(error);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

router.post(
  "/verify-otp",
  limit,
  validate(otpSchema),
  asyncHandler(async (req, res) => {
    const { id, email, type, token } = req.body;

    if (!email || !token) {
      return res.status(400).json("Invalid Code");
    }

    const result = await verifyOTP(id, Number(token));

    if (!result.success) {
      return res.status(400).json("Invalid Code");
    }

    const loginOption = type === "email" ? "email" : "phonenumber";

    await knex("users").where(loginOption, email).update({ active: 1 });

    let user = await knex("vw_users_with_roles")
      .select("*")
      .where(loginOption, email)
      .first();

    if (_.isEmpty(user)) {
      return res.status(401).json("Authentication Failed!");
    }

    await generateAuthSession({
      req,
      res,
      knex,
      authUser: user,
    });
  }),
);

router.post(
  "/logout",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { sub: id } = req.authUser;

    await knex("users").where("id", id).update({
      active: 0,
    });

    res.clearCookie("USSIDR");
    res.clearCookie("SSIDR");

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

router.post(
  "/verify-identity",
  verifyToken,
  validate(userIdentitySchema),
  asyncHandler(async (req, res) => {
    const { nid: userNID, dob: userDOB } = req.user;
    const { nid, dob } = req.body;

    // Validate at least one parameter is provided
    if (!nid && !dob) {
      return res
        .status(400)
        .json(
          "Please provide either National ID (nid) or Date of Birth (dob) for verification.",
        );
    }

    // Sanitize inputs
    const sanitizedNID = nid?.trim();
    const sanitizedDOB = dob?.trim();

    // Validate NID if provided
    if (sanitizedNID) {
      if (!userNID) {
        // User record doesn't have NID stored
        return res
          .status(400)
          .json("Unable to verify National ID. Please contact support.");
      }
      if (sanitizedNID !== userNID) {
        // Log mismatched NID attempt for security monitoring
        logger.warn(
          `Identity verification failed for user ${req.user.id}: NID mismatch`,
        );
        return res
          .status(400)
          .json("The National ID provided does not match our records.");
      }
    }

    // Validate DOB if provided
    if (sanitizedDOB) {
      if (!userDOB) {
        return res
          .status(400)
          .json("Unable to verify Date of Birth. Please contact support.");
      }

      const storedDate = moment(userDOB);
      const inputDate = moment(sanitizedDOB);

      // Compare dates at day precision
      if (!inputDate.isSame(storedDate, "day")) {
        logger.warn(
          `Identity verification failed for user ${req.user.id}: DOB mismatch`,
        );
        return res
          .status(400)
          .json("The Date of Birth provided does not match our records.");
      }
    }

    // All checks passed
    res.status(200).json("OK");
  }),
);

//@POST Request to be an agent
router.post(
  "/agents/request",
  limit,
  asyncHandler(async (req, res) => {
    const {
      business_name,
      business_location,
      business_description,
      business_email,
      business_phonenumber,
      ...rest
    } = req.body;

    try {
      const body = `<div>
      <h1 style='text-transform:uppercase;'> Application to Become an Agent</h1><br/>
      <div style='text-align:left;'>

      <p>I am writing to express my interest in joining GAB POWERFUL CONSULT as an agent.
    
      <p><strong>Personal details:</strong></p>
      <p><strong>Firstname:</strong> ${rest?.firstname}</p>
      <p><strong>Lastname:</strong> ${rest?.lastname}</p>
      <p><strong>Date of Birth:</strong> ${rest?.dob}</p>
      <p><strong>Email Address:</strong> ${rest?.email}</p>
      <p><strong>Telephone Number:</strong> ${rest?.phonenumber}</p>
      <p><strong>Address:</strong> ${rest?.residence}</p>
      <p><strong>ID</strong> ${rest?.nid}</p><br/>
      
      <p><strong>Business information:</strong></p>
      <p><strong>Business Name:</strong> ${business_name}</p>
      <p><strong>Business Address:</strong> ${business_location}</p>
      <p><strong>Description of Business:</strong> ${business_description}</p>
      <p><strong>Business Email Address:</strong> ${business_email || ""}</p>
      <p><strong>Business Telephone Line:</strong> ${
        business_phonenumber || ""
      }</p>

      <p>Thank you for considering my application. I look forward to the possibility of working together and contributing to the growth of GAB POWERFUL CONSULT.</p>
      </div>

      </div>`;

      if (process.env.NODE_ENV === "production") {
        await sendEMail(
          process.env.MAIL_CLIENT_USER,
          mailTextShell(body),
          " Application to Become an Agent",
        );
      }
      const message = `<div>
      <h1 style='text-transform:uppercase;'> Application to Become an Agent at GAB POWERFUL CONSULT.</h1><br/>
      <div style='text-align:left;'>

      <p><strong>Dear ${rest?.firstname} ${rest?.lastname},</strong></p>

      <p>Thank you for reaching out and expressing your interest in joining our team. We appreciate the time you took to provide us with your personal and business information.</p><br/>
      <p>Your application is currently under review by our hiring team. We will carefully assess your qualifications and experience to determine if there is a suitable fit for you within our organization.</p><br/>
      <p>We will be in touch with you soon regarding the next steps of the application process. In the meantime, if you have any questions or need further information, please don't hesitate to contact us.</p><br/>
      <p>Thank you again for your interest in becoming an agent at GAB POWERFUL CONSULT. We look forward to potentially welcoming you to our team.</p><br/>
      
      <p>Best regards,</p>
      <p>GAB Powerful Consult</p>
      </div>

      </div>`;

      setImmediate(async () => {
        await sendEMail(
          rest?.email,
          mailTextShell(message),
          " Application to Become an Agent at GAB POWERFUL CONSULT.",
        );

        await sendSMS(
          `Hi ${rest?.firstname} ${rest?.lastname},
Thank you for your application to become an agent at GAB POWERFUL CONSULT. We've received your details and are currently reviewing your application. We'll be in touch soon with further updates. If you have any questions, feel free to reach out.

Best regards,
GAB Powerful Consult      
        `,
          rest?.phonenumber,
        );
        res.status(200).json("Request Sent! We'll get back to you shortly.");
      });
    } catch (error) {
      console.log(error);
      res.status(500).json("An unknown error has occurred");
    }
  }),
);

router.put(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id, admin, google, register, ...rest } = req.body;

    if (!google && rest?.phonenumber) {
      const intNumber = getInternationalMobileFormat(rest?.phonenumber || "");
      const intWNumber = getInternationalMobileFormat(
        rest?.phonenumber || "",
        false,
      );

      const doesPhoneExists = await knex("users")
        .select("phonenumber")
        .where("phonenumber", "IN", [rest?.phonenumber, intWNumber, intNumber])
        .whereNot("id", id);

      if (!_.isEmpty(doesPhoneExists)) {
        return res.status(400).json("Telephone number already in use!");
      }
    }

    const modifiedUser = await knex("users").where("id", id).update(rest);

    if (modifiedUser !== 1) {
      return res.status(400).json("Error updating user information.");
    }
    if (admin) {
      return res.status(201).json("Changes Saved!");
    }

    const user = await knex("vw_users_with_roles")
      .select("*")
      .where("id", id)
      .first();

    if (!user) {
      return res.status(400).json("Error updating user information.");
    }
    const permissions = await getPermissions(user?.role_id);
    // set the user object on the request so it can be accessed in other routes
    const accessData = {
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
      createdAt: user?.created_at,
      active: Boolean(user?.active),
      permissions: permissions,
    };

    if (register) {
      await sendOTPSMS(
        `Welcome to GPC.You are recommended to setup your wallet pin at the wallet page of your account when you log into your account.Thank You!`,
        user?.phonenumber,
      );

      const message = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h2 style="color: #333333;">Important: Profile Update Notification</h2>
<p>Dear ${user?.name || "Customer"} ,</p>
<p> Welcome to GPC</p>
<p>You are recommended to setup your wallet pin at the wallet page of your account when you log into your account.</p>
<p>Thank you</p>

<p>Best regards,</p>
<p>Gab Powerful Team<p>
</div>`;

      await sendEMail(user?.email, message, "GPC Account Confirmation");
    } else {
      const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333333;">Important: Profile Update Notification</h2>
    <p>Dear ${user?.name || "Customer"} ,</p>
    <p> Your profile information has been updated.</p>
    <p>For security purposes, we wanted to ensure that you are aware of these changes. If you did not make these adjustments yourself or if you believe your account may have been compromised, please take immediate action by contacting our support team at <a href='mailto:info@gpcpins.com'>info@gpcpins</a>.</p>
    <p>If you have made these changes intentionally, please disregard this message.</p>
    <p>Thank you for your attention to this matter.</p>

    <p>Best regards,</p>
    <p>Gab Powerful Team<p>
</div>
    `;

      await sendEMail(user?.email, message, "Profile Update Notification");
    }
    res.status(201).json({
      user: accessData,
    });
  }),
);

router.put(
  "/profile",
  verifyToken,
  Upload.single("profile"),
  asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!req.file) {
      return res.status(404).json("No Image was found!");
    }

   const  url = await uploadPhoto(req.file);

    const user = await knex("users").where("id", id).update({ profile: url });

    if (user !== 1) {
      return res.status(404).json("An unknown error has occurred!");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: "Modified your account details.",
      severity: "info",
    });

    res.status(201).json(url);
  }),
);

//Enable or Disable User Account
router.put(
  "/account",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    // const { id: userId } = req.user;
    const { id, active } = req.body;

    const updatedUser = await knex("users")
      .where("id", id)
      .update({ active: active, is_enabled: active });

    if (updatedUser !== 1) {
      return res.status(400).json("Error updating user info");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: `${
        Boolean(active) === true
          ? "Activated a user account!"
          : "Disabled a user account!"
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

//@DELETE user
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    // const { id: userId } = req.user;
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(401).json("Invalid User information!");
    }

    const user = await knex("users").where("id", id).del();

    if (user !== 1) {
      return res.status(500).json("Invalid Request!");
    }
    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: "Deleted a user account!",
      severity: "error",
    });

    res.status(200).json("User Removed!");
  }),
);

module.exports = router;

/**
 * Generates authentication tokens, manages database sessions, and sets cookies.
 * @param {Object} params
 * @param {Object} params.authUser - The authenticated user data from the DB.
 * @param {Object} params.req - The Express request object.
 * @param {Object} params.res - The Express response object.
 * @param {Object} params.knex - The Knex database instance.
 * @param {boolean} [params.isRegistering=false] - Flag indicating if this is a new registration.
 */
async function generateAuthSession({
  req,
  res,
  knex,
  authUser,
  isRegistering = false,
}) {
  // 1. Format the user profile data
  const accessData = {
    id: authUser?.id,
    name: authUser?.name,
    firstname: authUser?.firstname,
    lastname: authUser?.lastname,
    email: authUser?.email,
    dob: authUser?.dob,
    nid: authUser?.nid,
    phonenumber: authUser?.phonenumber,
    role: process.env.USER_ID,
    profile: authUser?.profile,
    active: Boolean(authUser?.active),
    createdAt: authUser?.created_at,
  };

  const updatedUser = {
    sub: accessData?.id,
    role: accessData.role,
  };

  // 2. Track device and insert session
  const deviceId = generateDeviceId(req);
  const userAgent = req.headers["user-agent"];

  const [sessionId] = await knex("user_sessions").insert({
    user_id: accessData?.id, // Changed from user.id to authUser.id for consistency
    device_id: deviceId,
    device_name: userAgent,
    ip_address: req.ip,
    user_agent: userAgent,
  });

  // 3. Generate security tokens
  const accessToken = await signMainToken(updatedUser, accessData);
  const refreshToken = signMainRefreshToken(updatedUser);

  // 4. Calculate expiration times
  const expires = getExpiryTimeByRole(accessData?.role).refreshTime;
  const expiresMs = parseTimeToMs(expires);

  // 5. Store token in database
  await knex("user_tokens").insert({
    user_id: accessData.id,
    session_id: sessionId,
    refresh_token: refreshToken,
    expiresAt: new Date(expiresMs * 1000),
  });

  // 6. Set HTTP-only cookie
  res.cookie("USSIDR", refreshToken, {
    httpOnly: true,
    secure: isProduction, // true in prod (required over HTTPS), false in dev (http)
    sameSite: "lax", // same-site in both dev and prod, no need for "none"
    path: "/api/gabs/v1/auth/token",
    maxAge: expiresMs,
    name: "USSIDR",
    signed: true,
  });

  // 7. Send final client response
  return res.status(201).json({
    accessToken,
    user: accessData,
    register: isRegistering,
  });
}
