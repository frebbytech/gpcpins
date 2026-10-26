const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const bcrypt = require("bcryptjs");
const { otpGen } = require("otp-gen-agent");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");
const { signMainToken, signMainRefreshToken } = require("../config/token");
const sendMail = require("../config/sendEmail");
const {
  verifyToken,
  verifyRefreshToken,
  removeUser,
} = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { isValidUUID2 } = require("../config/validation");
const { uploadPhoto } = require("../config/uploadFile");
const { mailTextShell } = require("../config/mailText");

const limit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 5 requests per windowMs
  message: "Too many requests!. please try again later.",
});

const knex = require("../db/knex");
const { sendOTPSMS } = require("../config/sms");
const generateId = require("../config/generateId");
const redisClient = require("../config/redisClient");
const { storeOTP, verifyOTP } = require("../services/otp.services");
const {adminOTPSchema } = require("../utils/validationSchema");
const { validate } = require("../middlewares/validators");
const generateDeviceId = require("../utils/deviceFingerprint");
const { parseTimeToMs } = require("../utils/time");
const { getExpiryTimeByRole } = require("../utils/helper");

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

const getPermissions = async (roleId) => {
  const perms = await knex("role_permissions")
    .join("permissions", "role_permissions.permission_id", "permissions.id")
    .where("role_permissions.role_id", roleId)
    .pluck("permissions.description"); // Extracts values directly into a flat array

  return perms;
};

// Define the route for getting all non-admin users
router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { email } = req.user;

    // Fetch all non-admin users from the database
    const users = await knex("vw_users_with_roles")
      .where({ role: process.env.EMPLOYEE_ID })
      .whereIn("role", "IN", [process.env.EMPLOYEE_ID, process.env.ADMIN_ID])
      .whereNot("email", email);

    // Map through the users and modify the permissions property

    const modifiedusers = users.map(
      ({ role,...rest }) => {
        // Parse the permissions string to a JSON object
        return {
          ...rest,
          role: role === process.env.ADMIN_ID ? "Administrator" : "Employee",
          permissions: [],
        };
      },
    );

    // Send the modified users as a JSON response with a 200 status code
    res.status(200).json(modifiedusers);
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

    const permissions = await getPermissions(user?.role_id);

    const userData = {
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
      permissions: permissions,
      active: Boolean(user?.active),
      createdAt: user?.created_at,
    };

    if (user?.role === process.env.ADMIN_ID) {
      userData.isEnabled = true;
      userData.isAdmin = true;
    }

    res.status(200).json({
      user: userData,
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

router.post(
  "/verify",
  limit,
  asyncHandler(async (req, res) => {
    const { id, token } = req.body;

    if (!id || !isValidUUID2(id) || !token) {
      return res.status(400).json("An unknown error has occurred!");
    }

    const result = await verifyOTP(
      id,
      token,
      "gpcpins_password_reset",
      "gpcpins_password_reset_attempts",
    );

    if (!result.success) {
      return res.status(400).json("Invalid or expired token!");
    }

    res.status(201).json({
      user: {
        id,
      },
    });
  }),
);

//@GET user by email
router.post(
  "/login",
  limit,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await knex("users")
        .join("roles", "users.role_id", "roles.id")
        .select(
          "users.id",
          "email",
          "phonenumber",
          "password",
          "role_id",
          "code",
          "active",
        )
        .where("email", email)
        .first();

      if (
        [process.env.ADMIN_ID, process.env.EMPLOYEE_ID].indexOf(user?.code) ===
        -1
      ) {
        return res.status(400).json("Invalid Email or Password!!");
      }

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

      res.status(201).json({
        id: user?.id,
      });
      queueMicrotask(async () => {
        const otp = await otpGen();

        if (process.env.NODE_ENV !== "production") {
          console.log(otp);
        }

        await storeOTP(user?.id, Number(otp));

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
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

router.get(
  "/sms",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    try {
      const sms = await redisClient.get("sms");
      res.json({ sms });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Error fetching from Redis" });
    }
  }),
);

router.post(
  "/verify-otp",
  limit,
  validate(adminOTPSchema),
  asyncHandler(async (req, res) => {
    const { id, email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json("Invalid Code");
    }

    const result = await verifyOTP(id, Number(token));

    if (!result.success) {
      return res.status(400).json("Invalid Code");
    }

    await knex("users").where("email", email).update({ active: 1 });

    let user = await knex("vw_users_with_roles")
      .select("*")
      .where("email", email)
      .first();

    if (_.isEmpty(user)) {
      return res.status(401).json("Authentication Failed!");
    }

    const permissions = await getPermissions(user?.role_id);

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
      permissions: permissions,
    };

    if (user?.role === process.env.ADMIN_ID) {
      accessData.isEnabled = true;
      accessData.isAdmin = true;
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

    res.cookie("SSIDR", refreshToken, {
      httpOnly: true,
      secure: isProduction, // true in prod (required over HTTPS), false in dev (http)
      sameSite: "lax", // same-site in both dev and prod, no need for "none"
      path: "/api/gabs/v1/auth/token",
      maxAge: expiresMs,
      name: "USSIDR",
      signed: true,
    });

    // console.log(accessData);

    res.status(201).json({
      accessToken,
      user: accessData,
    });
  }),
);

router.post(
  "/sms",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { api } = req.body;

    try {
      await redisClient.set("sms", api);
      res.json("SMS API saved successfully");
    } catch (error) {
      console.log(error)
      res.status(500).json("Error saving to Redis");
    }
  }),
);

router.post(
  "/logout",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { sub: id } = req.authUser;

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

router.put(
  "/",
  limit,
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const { _id, ...rest } = req.body;

    const updateduser = await knex("users").where("id", _id).update(rest);

    if (updateduser !== 1) {
      return res.status(400).json("Error updating user information.");
    }
    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: "Updated account details.",
      severity: "info",
    });

    const user = await knex("vw_users_with_roles")
      .select("*")
      .where("id", _id)
      .first();

    const permissions = await getPermissions(user?.role_id);

    const userData = {
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
      permissions: permissions,
      active: Boolean(user?.active),
      createdAt: user?.created_at,
    };

    if (user?.role === process.env.ADMIN_ID) {
      userData.isEnabled = true;
      userData.isAdmin = true;
    }

    res.status(201).json(userData);
  }),
);

router.put(
  "/password",
  limit,
  asyncHandler(async (req, res) => {
    const { id, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    const modifiedUser = await knex("users").where("id", id).update({
      password: hashedPassword,
    });

    if (modifiedUser !== 1) {
      return res.status(404).json("Error updating userinformation.");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: "Updated account password!",
      severity: "info",
    });

    res.status(201).json("ok");
  }),
);

router.put(
  "/password-reset",
  limit,
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id, oldPassword, password } = req.body;

    const userPassword = await knex("users")
      .select("password")
      .where("id", id)
      .first();

    const passwordIsValid = await bcrypt.compare(
      oldPassword,
      userPassword?.password,
    );

    if (!passwordIsValid) {
      return res.status(400).json("Invalid Password!");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const modifiedUser = await knex("users").where("id", id).update({
      password: hashedPassword,
    });

    if (modifiedUser !== 1) {
      return res.status(404).json("Error updating user information.");
    }
    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: "Updated account password!",
      severity: "info",
    });

    res.status(201).json("ok");
  }),
);

router.put(
  "/profile",
  limit,
  verifyToken,
  verifyAdmin,
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

    const user = await knex("users").where("id", id).update({ profile: url });

    if (user !== 1) {
      return res.status(404).json("An unknown error has occurred!");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: "Updated account profile!",
      severity: "info",
    });

    res.status(201).json(url);
  }),
);

//@DELETE student
router.delete(
  "/:id",
  limit,
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(401).json("Invalid Request!");
    }

    const user = await knex("users").where("id", id).del();

    if (!user) {
      return res.status(500).json("Invalid Request!");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: USERID,
      title: "Deleted an user account!",
      severity: "error",
    });

    res.status(200).json("User Removed!");
  }),
);

module.exports = router;
