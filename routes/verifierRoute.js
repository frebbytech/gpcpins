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
} = require("../middlewares/verifyToken");
const { isValidUUID2 } = require("../config/validation");
const verifyScanner = require("../middlewares/verifyScanner");
const { uploadPhoto } = require("../config/uploadFile");
const { mailTextShell } = require("../config/mailText");

const limit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // 5 requests per windowMs
  message: "Too many requests! Please try again later.",
});

const knex = require("../db/knex");
const { sendOTPSMS } = require("../config/sms");
const generateId = require("../config/generateId");
const { getVerifier } = require("./users/authUsers");
const generateRandomNumber = require("../config/generateRandomCode");
const redisClient = require("../config/redisClient");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { verifyOTP, storeOTP } = require("../services/otp.services");
const { safeJSON } = require("../config/helpers");
const generateDeviceId = require("../utils/deviceFingerprint");
const logger = require("../utils/logger");

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
  "/auth/token",
  limit,
  verifyRefreshToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    const verifier = await getVerifier(id);
    const accessToken = await signMainToken(verifier, "180d");

    res.status(200).json({
      accessToken,
    });
  }),
);

router.get(
  "/verify-identity",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { nid: userNID, dob: userDOB } = req.user;
    const { nid, dob } = req.query;

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
        console.warn(
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
        console.warn(
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

    const { permissions ,...rest } = verifier;
    delete rest.role

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
        return res
          .status(400)
          .json("An verifier with this account already exists!");
      }
      const doesPhoneNumberExists = await transx("vw_users_with_roles")
        .select("phonenumber")
        .where("phonenumber", newVerifier.phonenumber)
        .first();

      if (!_.isEmpty(doesPhoneNumberExists)) {
        return res
          .status(400)
          .json(`Phone number, '${newVerifier.phonenumber}' is not available!`);
      }

      const doesUserNameExists = await transx("vw_users_with_roles")
        .select("username")
        .where("username", newVerifier?.username)
        .first();

      if (!_.isEmpty(doesUserNameExists)) {
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
        res.status(400).json("Error saving verifier information!");
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
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await knex("users")
        .join("roles", "users.role_id", "roles.id")
        .select("email", "phonenumber", "password", "role_id", "code", "active")
        .where("email", email)
        .first();

      if (
        [process.env.ADMIN_ID, process.env.SCANNER_ID].indexOf(user?.code) ===
        -1
      ) {
        return res.status(401).json("Unauthorized Access!!");
      }
      // console.log(user);

      if (_.isEmpty(user)) {
        return res.status(400).json("Invalid Email or Password!!");
      }

      const passwordIsValid = await bcrypt.compare(password, user?.password);

      if (!passwordIsValid) {
        return res.status(400).json("Invalid Email or Password!");
      }

      if (user?.active === 0) {
        return res.status(400).json("Account disabled!");
      }

      const otp = await otpGen();

      if (process.env.NODE_ENV !== "production") {
        console.log(otp);
      }

      await storeOTP(user?.id, otp);

      const message = `
        <div style="width:100%;max-width:500px;margin-inline:auto;">
      <p>Please ignore this message if you did not request the OTP.</p>
        <p>Your verification code is</p>
        <h1>${otp}</h1>
        <p>If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.</p>

        <p>-- Gab Powerful Team --</p>
    </div>
        `;

      if (process.env.NODE_ENV !== "production") {
        console.log(otp);
      }

      await sendMail(user?.email, mailTextShell(message));

      await sendOTPSMS(
        `Please ignore this message if you did not request the OTP.Your verification code is ${otp}.If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.`,
        user?.phonenumber,
      );

      res.status(201).json({
        id: user?.id,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

//Verify Email or Phonenumber
router.post(
  "/send-otp",
  limit,
  asyncHandler(async (req, res) => {
    const { contact, type } = req.body;

    let verifier = {};
    if (type === "phone") {
      verifier = await knex("verifiers")
        .select("_id", "phonenumber", "active")
        .where("phonenumber", contact)
        .limit(1)
        .first();
    }
    if (type === "email") {
      verifier = await knex("verifiers")
        .select("_id", "email", "active")
        .where("email", contact)
        .limit(1)
        .first();
    }

    if (_.isEmpty(verifier)) {
      return res.status(400).json("We could not find your account!");
    }

    if (Boolean(verifier?.active) !== true) {
      return res.status(400).json("Account disabled!");
    }

    const code = await otpGen();
    await knex("tokens").upsert({
      email: contact,
      token: code,
    });

    // console.log(code);

    if (type === "phone") {
      sendOTPSMS(`Your verification code is ${code}.`, verifier?.phonenumber);
    }
    if (type === "email") {
      const message = `
      <div style="width:100%;max-width:500px;margin-inline:auto;">
  
      <p>Your verification code is</p>
      <h1>${code}</h1>

      <p>-- Gab Powerful Team --</p>
  </div>
      `;

      try {
        await sendMail(verifier?.email, mailTextShell(message));
      } catch (error) {
        await knex("tokens").where("id", verifier?.id).del();
        console.log(error);

        return res.status(500).json("An error has occurred!");
      }
    }

    res.sendStatus(201);
  }),
);

//Verify OTP
router.post(
  "/verify-otp",
  limit,
  asyncHandler(async (req, res) => {
    const { id, email, token } = req.body;
    // console.log(req.body);
    if (!email || !token) {
      return res.status(400).json("Invalid Code");
    }

    const result = await verifyOTP(id, Number(token));

    if (!result.success) {
      return res.status(400).json("Invalid Code");
    }

    await knex("users").where('email', email).update({ active: 1 });

    let user = await knex("vw_users_with_roles")
      .select("*")
      .where('email', email)
      .first();

    if (_.isEmpty(user)) {
      return res.status(401).json("Authentication Failed!");
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
      permissions: JSON.parse(user.permissions),
    };

    if (user?.role === process.env.ADMIN_ID) {
      accessData.isEnabled = true;
      accessData.isAdmin = true;
      accessData.isVerifierAdmin = true;
    }

    const updatedUser = {
      id: user?.id,
      role: user?.role,
      active: Boolean(user?.active),
      createdAt: user?.created_at,
    };
    const deviceId = generateDeviceId(req);

    const [sessionId] = await knex("user_sessions").insert({
      user_id: user.id,
      device_id: deviceId,
      device_name: req.headers["user-agent"],
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    const accessToken = await signMainToken(accessData, "180d");
    const refreshToken = signMainRefreshToken(updatedUser, "365d");

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    await knex("user_tokens").insert({
      user_id: user.id,
      session_id: sessionId,
      refresh_token: refreshToken,
      expiresAt: expires,
    });
    //logs
    await knex("activity_logs").insert({
      user_id: user.id,
      title: "Logged into account.",
      severity: "info",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/verifiers/auth/token",
    });

    res.status(201).json({
      refreshToken,
      accessToken,
    });
  }),
);

router.post(
  "/logout",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id, jti } = req.user;

    res.clearCookie("refreshToken");

    await knex("user_tokens")
      .where({ user_id: id })
      .update({ is_revoked: true });

    await knex("activity_logs").insert({
      user_id: id,
      title: "Logged out of account.",
      severity: "info",
    });

    await redisClient.del(`user:${jti}`);

    req.user = null;
    delete req.user;

    res.sendStatus(204);
  }),
);

router.put(
  "/",
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;

    const { id, ...rest } = req.body;

    const updatedVerifier = await knex("users").where("id", id).update(rest);

    if (updatedVerifier !== 1) {
      return res.status(400).json("Error updating verifier information.");
    }

    const verifier = await getVerifier(id);

    //logs
    await knex("verifier_activity_logs").insert({
      _id: generateId(10),
      user_id: USERID,
      title: "Updated account details.",
      severity: "info",
    });

    const accessToken = await signMainToken(verifier, "180d");

    res.status(201).json({
      accessToken,
    });
  }),
);

router.put(
  "/password",
  limit,
  verifyToken,
  // verifyScanner,
  asyncHandler(async (req, res) => {
    const { id, oldPassword, password } = req.body;

    const verifierPassword = await knex("users")
      .select("password")
      .where("id", id)
      .first();

    const passwordIsValid = await bcrypt.compare(
      oldPassword,
      verifierPassword?.password,
    );

    if (!passwordIsValid) {
      return res.status(400).json("Invalid Password!");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const modifiedVerifier = await knex("users").where("id", id).update({
      password: hashedPassword,
    });

    if (modifiedVerifier !== 1) {
      return res.status(404).json("Error! Could not save changes.");
    }

    res.status(201).json("Changes Saved!");
  }),
);

router.put(
  "/password/update",
  limit,
  asyncHandler(async (req, res) => {
    const { id, password } = req.body;

    if (!id) {
      return res.status(400).json("Invalid Request!");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const modifiedVerifier = await knex("users").where("id", id).update({
      password: hashedPassword,
    });

    if (modifiedVerifier !== 1) {
      return res.status(404).json("Failed! An unknown error has occurred.");
    }

    res.sendStatus(204);
  }),
);

router.put(
  "/password/reset",
  limit,
  verifyToken,
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json("Invalid Request!");
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

    setImmediate(async () => {
      if (process.env.NODE_ENV !== "production") {
        await sendMail(
          verifier?.email,
          mailTextShell(message),
          "Password Reset",
        );
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
    const { id } = req.body;

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
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;
    const { id, active } = req.body;

    const updatedVerifier = await knex("users")
      .where("id", id)
      .update({ active: active, is_enabled: active });

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
  verifyScanner,
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(401).json("Invalid Request!");
    }

    const verifier = await knex("verifiers").where("_id", id).del();

    if (!verifier) {
      return res.status(500).json("Invalid Request!");
    }

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
