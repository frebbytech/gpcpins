const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const moment = require("moment");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const { randomBytes } = require("crypto");
const { otpGen, customOtpGen } = require("otp-gen-agent");
const { signMainToken, signMainRefreshToken } = require("../config/token");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");
// const sendMail = require("../config/sendEmail");
const {
  verifyToken,
  verifyRefreshToken,
  removeUser,
} = require("../middlewares/verifyToken");
const { isValidUUID2 } = require("../config/validation");
const verifyAgent = require("../middlewares/verifyAgent");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { mailTextShell } = require("../config/mailText");
const generateId = require("../config/generateId");

const limit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 5 requests per windowMs
  message: "Too many requests! please try again later.",
});

//model
const { parseDateRange } = require("../config/dateConfigs");

const knex = require("../db/knex");
const {
  sendBundle,
  sendAirtime,
  getBundleList,
  accountBalance,
} = require("../config/sendMoney");
const { MTN, VODAFONE, AIRTELTIGO } = require("../config/bundleList");
const {
  getPhoneNumberInfo,
  getInternationalMobileFormat,
} = require("../config/PhoneCode");
const verifyAdminORAgent = require("../middlewares/verifyAdminORAgent");
const sendEMail = require("../config/sendEmail");
const generateRandomNumber = require("../config/generateRandomCode");
const { sendSMS, sendOTPSMS } = require("../config/sms");
const currencyFormatter = require("../config/currencyFormatter");
const redisClient = require("../config/redisClient");
const { safeJSON } = require("../config/helpers");
const generateDeviceId = require("../utils/deviceFingerprint");
const { uploadPhoto } = require("../config/uploadFile");
const { getExpiryTimeByRole } = require("../utils/helper");
const { parseTimeToMs } = require("../utils/time");
const { airtimeQueue, bulkAirtimeQueue } = require("../queues/airtime.queue");
const logger = require("../utils/logger");
const { bundleQueue } = require("../queues/bundle.queue");

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

router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const agents = await knex("vw_user_business_view").select("*").where({
      role: process.env.AGENT_ID,
    });

    if (_.isEmpty(agents)) return res.status(200).json([]);

    res.status(200).json(agents);
  }),
);

router.get(
  "/auth",
  limit,
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    const agent = await knex("vw_user_business_view")
      .select(
        "id",
        "user_id",
        "firstname",
        "lastname",
        "username",
        "name",
        "email",
        "role",
        "phonenumber",
        "profile",
        "modules",
        "businessName",
        "businessLocation",
        "businessDescription",
        "active",
        "createdAt",
      )
      .where("user_id", id)
      .first();

    if (_.isEmpty(agent) || agent?.active === 0) {
      return res.sendStatus(204);
    }

    res.status(200).json({
      user: {
        id: agent?.id,
        firstname: agent?.firstname,
        lastname: agent?.lastname,
        username: agent?.username,
        name: agent?.name,
        email: agent?.email,
        role: agent?.role,
        phonenumber: agent?.phonenumber,
        profile: agent?.profile,
        modules: safeJSON(agent?.modules),
        //business
        businessName: agent?.businessName,
        businessLocation: agent?.businessLocation,
        businessDescription: agent?.businessDescription,
        active: agent?.active,
        createdAt: agent?.createdAt,
      },
    });
  }),
);

// @GET Agent commission
router.get(
  "/commission/:id",
  verifyToken,
  verifyAdminORAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const commissions = await knex("agent_commissions")
      .where("user_id", id)
      .select("*");

    res.status(200).json(commissions);
  }),
);

router.get(
  "/logs",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const { startDate, endDate } = req.query;

    const { start, end, error } = parseDateRange(startDate, endDate);

    if (error) {
      return res.status(400).json(error);
    }

    const logs = await knex("vw_user_logs_view")
      .select(
        "*",
        knex.raw("DATE_FORMAT(createdAt, '%D %M %Y %h:%i:%s %p') as loggedAt"),
      )
      .where({ userId: id, isActive: true })
      .whereBetween("createdAt", [start, end]);

    if (_.isEmpty(logs)) {
      return res.status(200).json([]);
    }

    return res.status(200).json(logs);
  }),
);

// PUT Remove All Selected Logs
router.put(
  "/logs",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { logs } = req.body;

    await knex("activity_logs").where("id", "IN", logs).update({
      is_active: false,
    });
    return res.sendStatus(204);
  }),
);

router.get(
  "/verify-identity",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const { nid, dob } = req.query;

    const agent = await knex("users")
      .where({ id })
      .select("nid", "dob", knex.raw("DATE_FORMAT(dob,'%D %M %Y') as dobb"))
      .limit(1);

    if (_.isEmpty(agent[0])) {
      return res.status(400).json("Invalid Request!");
    }

    if (nid && agent[0]?.nid !== nid) {
      return res.status(400).json("Sorry.We couldn't find your National ID.");
    }

    if (dob) {
      const formattedDate = moment(dob).format("Do MMMM YYYY");

      if (agent[0]?.dobb !== formattedDate) {
        return res
          .status(400)
          .json("Sorry.We couldn't find your date of birth.");
      }
    }

    return res.status(200).json("OK");
  }),
);

router.get(
  "/phonenumber/token",
  limit,
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const { code } = req.query;

    if (code) {
      const agentToken = await knex("verify_tokens")
        .select("_id", "code")
        .where({
          _id: id,
          code,
        })
        .limit(1);

      if (
        _.isEmpty(agentToken) ||
        Number(code) !== Number(agentToken[0]?.code)
      ) {
        return res.status(400).json("Invalid code.Try again");
      }
    } else {
      const agent = await knex("users")
        .select("_id", "phonenumber", "active")
        .where("_id", id)
        .limit(1);

      if (_.isEmpty(agent) && !agent[0]?.phonenumber) {
        return res.status(400).json("Invalid Request");
      }

      const code = await otpGen();
      await knex("verify_tokens").upsert({
        _id: id,
        code,
      });
      console.log(code);

      await sendOTPSMS(
        `Please ignore this message if you did not request the OTP.Your verification code is ${code}.Don't share this code with anyone; Our employees will never ask for the code.If the code is incorrect or expired, you will not be able to proceed. Request a new code if necessary.`,
        agent[0]?.phonenumber,
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
    const agent = await knex("vw_user_business_view")
      .join("wallets", "vw_user_business_view.user_id", "=", "wallets.user_id")
      .select("vw_user_business_view.*", "wallets.amount")
      .where("vw_user_business_view.user_id", id)
      .first();
    // .select("*");

    if (_.isEmpty(agent)) return res.status(200).json({});

    res.status(200).json(agent);
  }),
);

// router.get(
//   "/auth/token",
//   limit,
//   verifyRefreshToken,
//   asyncHandler(async (req, res) => {
//     const { id } = req.user;

//     const agent = await knex("vw_user_business_view")
//       .select(
//         "id",
//         "user_id",
//         "firstname",
//         "lastname",
//         "username",
//         "name",
//         "email",
//         "role",
//         "phonenumber",
//         "profile",
//         "businessName",
//         "businessLocation",
//         "businessDescription",
//         "active",
//         "createdAt",
//       )
//       .where("user_id", id)
//       .first();

//     if (_.isEmpty(agent) || Boolean(agent?.active) === false) {
//       return res.sendStatus(204);
//     }

//     const accessToken = await signMainToken(agent, "180d");

//     res.status(200).json({
//       accessToken,
//     });
//   }),
// );

// @POST Agent
router.post(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    const transaction = await knex.transaction();
    try {
      const {
        business_name,
        business_location,
        business_description,
        business_email,
        business_phonenumber,
        ...rest
      } = req.body;

      // 1. Parallelize early validation and role lookup
      const [existingEmail, existingUsername, existingPhoneNumber] =
        await Promise.all([
          knex("users").select("email").where("email", rest.email).first(),
          knex("users")
            .select("username")
            .where("username", rest.username)
            .first(),
          knex("users")
            .select("phonenumber")
            .whereIn("phonenumber", [
              rest.phonenumber,
              getInternationalMobileFormat(rest.phonenumber),
              getInternationalMobileFormat(rest.phonenumber, false),
            ])
            .first(),
        ]);

      if (existingEmail) {
        return res.status(400).json(`Email, '${rest.email}' is not available!`);
      }
      if (existingUsername) {
        return res
          .status(400)
          .json(`Username, '${rest.username}' is not available!`);
      }
      if (existingPhoneNumber) {
        return res
          .status(400)
          .json(`Phone number, '${rest.phonenumber}' already exists!`);
      }

      const agent_id = generateId();
      const password = generateRandomNumber(10);
      const hashedPassword = await bcrypt.hash(password, 12);

      //Save Agent Personal Information
      await transaction("users").insert({
        id: agent_id,
        role_id: 1,
        firstname: rest?.firstname,
        lastname: rest?.lastname,
        email: rest?.email?.toLowerCase(),
        username: `${rest.username}`,
        phonenumber: rest?.phonenumber,
        residence: rest?.residence,
        permissions: JSON.stringify([]),
        dob: rest?.dob,
        nid: rest?.nid,
        profile: rest?.profile,
        password: hashedPassword,
        active: 1,
      });

      //Save Agent Business Information
      await transaction("agent_businesses").insert({
        id: generateId(),
        user_id: agent_id,
        name: business_name,
        location: business_location,
        description: business_description,
        email: business_email,
        phonenumber: business_phonenumber,
        active: 1,
      });

      //Create Agent Wallet Information
      const user_key = await customOtpGen({ length: 4 });
      const hashedPin = await bcrypt.hash(user_key, 12);

      await transaction("wallets").insert({
        id: generateId(),
        user_id: agent_id,
        user_key: hashedPin,
      });

      //Create Agent Wallet Information

      await transaction("agent_commissions").insert([
        {
          user_id: agent_id,
          provider: "MTN",
          rate: 0.2,
        },
        {
          user_id: agent_id,
          provider: "Vodafone",
          rate: 0.25,
        },
        {
          user_id: agent_id,
          provider: "AirtelTigo",
          rate: 0.25,
        },
      ]);
      await transaction.commit();

      const message = `<div>
      <h1 style='text-transform:uppercase;'>Welcome to GAB POWERFUL CONSULT.</h1><br/>
      <div style='text-align:left;'>

      <p><strong>Dear ${rest?.firstname} ${rest?.lastname},</strong></p>

      <p>We are delighted to inform you that your application to become an agent at GAB POWERFUL CONSULT has been accepted! Congratulations and welcome aboard!</p>
      <p>As an agent at GAB POWERFUL CONSULT, you will have access to a wide range of resources, support, and opportunities for growth and success. We are committed to providing you with the tools and assistance you need to thrive in your new role.</p>
      <p>Please let us know if you have any questions or if there is anything we can do to assist you as you get started. We are here to help every step of the way.</p>
      <p>Once again, welcome to the team! We look forward to working with you and witnessing your contributions to our company's success.</p>
      

      <p><strong>Details:</strong></p><br/>
      <p><strong>Login URL:</strong> <a href='https://agent.gpcpins.com'>https://agent.gpcpins.com</a></p><br/>
      <p><strong>Username:</strong> ${rest?.phonenumber}</p><br/>
      <p><strong>Default Password:</strong> ${password}</p><br/>
      <p><strong>Email Address:</strong> ${rest?.email}</p><br/>
      <p><strong>Wallet PIN:</strong> ${user_key}</p><br/>
      <p>We recommend you change your <b>Default Password</b> and <b>Wallet Pin</b> when you log into your account.</p>

      <p>Best regards,</p>
      <p>GAB Powerful Consult Team</p>
      </div>

      </div>`;

      const smsMessage = `We are delighted to inform you that your application to become an agent at GAB POWERFUL CONSULT has been accepted!
      Login URL:https://agent.gpcpins.com, Username: ${rest?.phonenumber},Default Password:${password},Email Address:${rest?.email},Wallet PIN: ${user_key}.
     We recommend you change your Default Password and Wallet Pin when you log into your account.
      `;

      //logs
      await knex("activity_logs").insert({
        user_id: id,
        title: "Created new agent account!",
        severity: "info",
      });

      res.sendStatus(201);

      setImmediate(async () => {
        if (process.env.NODE_ENV === "production") {
          await sendEMail(
            rest?.email,
            mailTextShell(message),
            "Welcome to GAB POWERFUL CONSULT.",
          );

          await sendSMS(smsMessage, rest?.phonenumber);
        }
      });
    } catch (error) {
      await transaction.rollback();

      res.status(500).json("An unknown error has occurred!");
    }
  }),
);

//@POST Request to be an agent
router.post(
  "/request",
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

    res.status(200).json("Request Sent!");
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
    } catch (error) {
      res.status(500).json("An unknown error has occurred");
    }
  }),
);

// @POST Agent commission
router.post(
  "/commission",
  verifyToken,
  verifyAdminORAgent,
  asyncHandler(async (req, res) => {
    const { rate, agent_id, provider } = req.body;

    await knex("agent_commissions")
      .where({
        user_id: agent_id,
        provider,
      })
      .upsert({
        rate,
        user_id: agent_id,
        provider,
      });
    res.status(200).json("Commission Updated");
  }),
);

//@GET agent by email
router.post(
  "/login",
  limit,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const agent = await knex("users")
      .join("roles", "users.role_id", "roles.id")
      .select(
        "email",
        "phonenumber",
        "password",
        "role_id",
        "code",
        "active",
        "is_enabled as isEnabled",
      )
      .where("email", email)
      .first();

    if (_.isEmpty(agent)) {
      return res.status(400).json("User does not exist!");
    }

    if ([process.env.AGENT_ID].indexOf(agent?.code) === -1) {
      return res.status(401).json("Unauthorized Access!!");
    }

    const passwordIsValid = await bcrypt.compare(password, agent?.password);

    if (!passwordIsValid) {
      return res.status(400).json("Invalid login credentials!");
    }

    if (
      Boolean(agent?.active) === false ||
      Boolean(agent?.isEnabled) === false
    ) {
      return res.status(400).json("Account disabled! Please try again later.");
    }

    //
    const agentBusiness = await knex("vw_user_business_view")
      .select(
        "id",
        "user_id",
        "name",
        "firstname",
        "lastname",
        "username",
        "email",
        "phonenumber",
        "role",
        "profile",
        "active",
        "businessName",
        "businessLocation",
        "businessDescription",
        "active",
        "createdAt",
      )
      .where("email", agent?.email)
      .first();

    if (_.isEmpty(agent)) {
      return res.status(401).json("Authentication Failed!");
    }
    let accessData = {
      id: agentBusiness?.id,
      name: agentBusiness?.name,
      firstname: agentBusiness?.firstname,
      lastname: agentBusiness?.lastname,
      email: agentBusiness?.email,
      phonenumber: agentBusiness?.phonenumber,
      role: agentBusiness?.role,
      profile: agentBusiness?.profile,
      businessName: agentBusiness?.businessName,
      businessLocation: agentBusiness?.businessLocation,
      businessDescription: agentBusiness?.businessDescription,
      active: Boolean(agentBusiness?.active),
      createdAt: agentBusiness?.createdAt,
    };

    const updatedAgent = {
      sub: agentBusiness?.user_id,
      role: agentBusiness?.role,
    };

    const deviceId = generateDeviceId(req);

    const [sessionId] = await knex("user_sessions").insert({
      user_id: agentBusiness.user_id,
      device_id: deviceId,
      device_name: req.headers["user-agent"],
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    const accessToken = await signMainToken(updatedAgent, accessData);
    const refreshToken = signMainRefreshToken(updatedAgent);

    const expires = getExpiryTimeByRole(process.env.ADMIN_ID).refreshTime;
    const expiresMs = parseTimeToMs(expires);

    await knex("user_tokens").insert({
      user_id: agentBusiness.user_id,
      session_id: sessionId,
      refresh_token: refreshToken,
      expiresAt: new Date(expiresMs * 1000),
    });

    //logs
    await knex("activity_logs").insert({
      user_id: agentBusiness?.user_id,
      title: "Logged into account.",
      severity: "info",
    });

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("RSSIDR", refreshToken, {
      httpOnly: true,
      secure: isProduction, // true in prod (required over HTTPS), false in dev (http)
      sameSite: "lax", // same-site in both dev and prod, no need for "none"
      path: "/api/gabs/v1/auth/token",
      maxAge: expiresMs,
      name: "RSSIDR",
      signed: true,
    });

    res.status(201).json({
      user: accessData,
      accessToken,
    });
  }),
);

router.post(
  "/logout",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { sub: id } = req.authUser;

    res.clearCookie("RSSIDR");

    await removeUser(id);

    req.authUser = null;
    req.user = null;
    delete req.user;
    delete req.authUser;

    res.sendStatus(204);
  }),
);

router.put(
  "/",
  verifyToken,
  verifyAdminORAgent,
  asyncHandler(async (req, res) => {
    const { id: userId, role } = req.user;
    const { id, agent_id, ...rest } = req.body;

    // console.log(req.body)

    if (agent_id) {
      await knex("agent_businesses")
        .where("id", rest.business_id)
        .upsert({
          id: rest?.business_id || generateId(),
          user_id: agent_id,
          name: rest?.business_name,
          location: rest?.business_location,
          description: rest?.business_description,
          email: rest?.business_email,
          phonenumber: rest?.business_phonenumber,
        });
    }

    const updatedAgent = await knex("users").where("id", id).update(rest);

    if (updatedAgent !== 1) {
      return res.status(400).json("Error updating agent information.");
    }

    if (role === process.env.ADMIN_ID) {
      //logs
      await knex("activity_logs").insert({
        user_id: userId,
        title: "Modified an agent account.",
        severity: "info",
      });

      return res.status(201).json("Changes Saved!");
    }

    const agent = await knex("vw_user_business_view")
      .select(
        "id",
        "user_id",
        "firstname",
        "lastname",
        "username",
        "name",
        "email",
        "role",
        "phonenumber",
        "profile",
        "businessName",
        "businessLocation",
        "businessDescription",
        "active",
        "createdAt",
      )
      .where("user_id", agent_id)
      .first();

    //logs
    await knex("activity_logs").insert({
      user_id: agent?.id,
      title: "Modified your account details.",
      severity: "info",
    });

    res.status(201).json({
      user: agent,
    });

    const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333333;">Important: Profile Update Notification</h2>
    <p>Dear ${agent?.name || "Customer"},</p>
    <p> Your profile information has been updated.</p>
    <p>For security purposes, we wanted to ensure that you are aware of these changes. If you did not make these adjustments yourself or if you believe your account may have been compromised, please take immediate action by contacting our support team at <a href='mailto:info@gpcpins.com'>info@gpcpins</a>.</p>
    <p>If you have made these changes intentionally, please disregard this message.</p>
    <p>Thank you for your attention to this matter.</p>

    <p>Best regards,</p>
    <p>Gab Powerful Team<br>
</div>
    `;

    setImmediate(async () => {
      await sendEMail(agent?.email, message, "Profile Update Notification");
      const smsMessage = `Your profile information has been updated.For security purposes, we wanted to ensure that you are aware of these changes. If you did not make these adjustments yourself or if you believe your account may have been compromised, please take immediate action by contacting our support team.If you have made these changes intentionally, please disregard this message.`;
      await sendOTPSMS(smsMessage, agent?.phonenumber);
    });
  }),
);

router.put(
  "/password",
  limit,
  verifyToken,
  verifyAdminORAgent,
  asyncHandler(async (req, res) => {
    const { id: ID, role } = req.user;
    const { id, oldPassword, password } = req.body;

    if (role === process.env.AGENT_ID) {
      const agentPassword = await knex("users")
        .select("password")
        .where("id", id)
        .first();

      const passwordIsValid = await bcrypt.compare(
        oldPassword,
        agentPassword?.password,
      );

      if (!passwordIsValid) {
        return res.status(400).json("Invalid Password!");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const modifiedAgent = await knex("users").where("id", id).update({
      password: hashedPassword,
    });

    if (modifiedAgent !== 1) {
      return res.status(404).json("Error updating agent information.");
    }

    if (role === process.env.ADMIN_ID) {
      //logs
      await knex("activity_logs").insert({
        user_id: ID,
        title: "Modified an agent password.",
        severity: "info",
      });

      return res.status(200).json("Changes Saved");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: id,
      title: "Modified your account password.",
      severity: "info",
    });

    return res.status(200).json("Changes Saved");
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

    let url = req.file?.filename;
    url = await uploadPhoto(req.file);

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

//Enable or Disable Agent Account
router.put(
  "/account",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: _id } = req.user;
    const { id, active } = req.body;

    const updatedAgent = await knex("users")
      .where("id", id)
      .update({ active: active, is_enabled: active });

    if (updatedAgent !== 1) {
      return res.status(400).json("Error updating agent info");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: _id,
      title: `${
        Boolean(active) === true
          ? "Activated an agent account!"
          : "Disabled an agent account!"
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

//Enable or Disable Agent Account
router.patch(
  "/:id/modules",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: _id } = req.user;
    const agentId = req.params.id;
    const { modules } = req.body;

    const updatedAgent = await knex("users")
      .where("id", agentId)
      .update({ modules: JSON.stringify(modules) });

    if (updatedAgent !== 1) {
      return res.status(400).json("Error updating agent info");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: _id,
      title: "updated agent account",
      severity: "warning",
    });

    res.status(201).json("Changes Saved");
  }),
);

//@DELETE agent account (soft delete)
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: _id } = req.user;
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(401).json("Invalid Request!");
    }

    const agent = await knex("users").where("id", id).update({
      active: 0,
      is_enabled: 0,
    });

    if (!agent) {
      return res.status(500).json("Invalid Request!");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: _id,
      title: "Deleted an agent account!",
      severity: "error",
    });

    res.status(200).json("Agent Account Removed!");
  }),
);

//////////////////...............Business............////////////

router.get(
  "/business/:id",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const business = await knex("agent_businesses")
      .select("*")
      .where("user_id", id)
      .first();

    if (_.isEmpty(business)) res.status(200).json({});

    res.status(200).json(business);
  }),
);

router.put(
  "/business",
  limit,
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;
    const { id, ...newBusiness } = req.body;

    const business = await knex("agent_businesses")
      .where("id", id)
      .update({
        ...newBusiness,
      });

    if (business !== 1) {
      return res.status(404).json("Changes Failed");
    }

    //logs
    await knex("activity_logs").insert({
      user_id: USERID,
      title: "Modified your account details.",
      severity: "info",
    });

    res.status(201).json("Changes Saved!!!");
  }),
);

////////////////.............Wallet..................///////////

router.get(
  "/top-up/wallet",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    const wallet = await knex("wallets")
      .where("user_id", id)
      .select("amount")
      .first();

    if (_.isEmpty(wallet)) {
      res.status(200).json(0);
    }

    res.status(200).json(wallet?.amount);
  }),
);

router.get(
  "/wallet/transactions",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const { startDate, endDate } = req.query;

    // const sDate = moment(startDate).format("YYYY-MM-DD");
    // const eDate = moment(endDate).format("YYYY-MM-DD");

    const transactions = await knex("vw_wallet_transactions_issuer_view")
      .where({
        userId: id,
        type: "credit",
      })
      .whereBetween("createdAt", [startDate, endDate])
      .select(
        "id",
        "userId",
        "amount",
        "wallet",
        "type",
        "comment",
        "status",
        "createdAt",
        "issuerName",
        // "DATE(created_at) AS purchaseDate",
      )
      .orderBy("createdAt", "desc");

    res.status(200).json(transactions);
  }),
);

// /airtime/template
router.get(
  "/airtime/template",
  verifyToken,
  asyncHandler(async (req, res) => {
    const filePath = path.join(process.cwd(), "/views/", `template.xlsx`);

    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    } else {
      return res.sendStatus(204);
    }
  }),
);

//update wallet pin
router.put(
  "/wallet",
  verifyToken,
  verifyAdminORAgent,
  asyncHandler(async (req, res) => {
    const { id, email } = req.user;
    const { _id, pin, isAdmin, agentEmail } = req.body;

    const userId = isAdmin ? _id : id;
    const emailAddress = isAdmin ? agentEmail : email;

    const hashedPin = await bcrypt.hash(pin, 10);

    const wallet = await knex("wallets")
      .where("user_id", userId)
      .update("user_key", hashedPin);

    if (wallet !== 1) {
      return res
        .status(400)
        .json("Error updating wallet pin! Please try again later.");
    }

    if (isAdmin) {
      //logs
      await knex("activity_logs").insert({
        user_id: id,
        title: "Updated an User Wallet pin.",
        severity: "info",
      });
    } else {
      //logs
      await knex("user_activity_logs").insert({
        user_id: userId,
        title: "Updated Wallet pin.",
        severity: "info",
      });
    }

    const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333333;">Important: Profile Update Notification</h2>
    <p>Dear Customer ,</p>
    <p> Your profile information has been updated.</p>
    <p>For security purposes, we wanted to ensure that you are aware of these changes. If you did not make these adjustments yourself or if you believe your account may have been compromised, please take immediate action by contacting our support team at <a href='mailto:info@gpcpins.com'>info@gpcpins</a>.</p>
    <p>If you have made these changes intentionally, please disregard this message.</p>
    <p>Thank you for your attention to this matter.</p>

    <p>Best regards,</p>
    <p>Gab Powerful Team<br>
</div>
    `;

    await sendEMail(emailAddress, message, "Profile Update Notification");

    res.status(200).json("Wallet Pin Changed!");
  }),
);

router.get(
  "/top-up/transaction",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    let { startDate, endDate, type } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required" });
    }
    // Use extracted function
    const { start, end, error } = parseDateRange(startDate, endDate);

    if (error) {
      return res.status(400).json(error);
    }

    // Build query
    const transactions = await knex("agent_transactions")
      .where({ user_id: id, type })
      .whereBetween("created_at", [start, end])
      .select(
        "id",
        "user_id",
        "reference",
        "type",
        "recipient",
        "provider",
        "info",
        "commission",
        "amount as amt",
        "total_amount as amount",
        "year",
        "active",
        "status",
        "created_at as createdAt",
      )
      .orderBy("created_at", "desc");

    // Transform results (parse JSON info)
    const transformed = transactions.map(({ info, ...rest }) => ({
      ...rest,
      info: safeJSON(info),
    }));

    res.status(200).json(transformed);
  }),
);

router.delete(
  "/top-up/transaction",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id } = req.query;

    await knex("agent_transactions").where("id", id).del();

    res.sendStatus(204);
  }),
);

//Check Transaction Status
router.get(
  "/top-up/status",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const reference_id = req.query?.reference;

    try {
      const response = await topUpStatus(reference_id);

      res.status(200).json(response);
    } catch (error) {
      res.status(401).json(error?.response?.data);
    }
  }),
);

//Get List of all bundles
router.get(
  "/top-up/bundlelist",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const network = req.query?.network;
    let response = [];
    try {
      if (process.env.NODE_ENV === "production") {
        response = await getBundleList(network);
      } else {
        if (network === "4") {
          response = MTN;
        }
        if (network === "6") {
          response = VODAFONE;
        }
        if (network === "1") {
          response = AIRTELTIGO;
        }
      }

      const bundles = response?.bundles?.map((bundle) => {
        const { meta, network, ...rest } = bundle;
        if (Number(rest.price) === 0) return;
        return rest;
      });

      res.status(200).json(_.compact(bundles));
    } catch (error) {
      res.status(401).json("An unknown error has occurred");
    }
  }),
);

//Send airtime to recipient
router.post(
  "/top-up/airtime",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { id, phonenumber } = req.user;
    const info = req.body;
    const amount = Number(info?.amount);

    // 1. External Vendor Balance Check (Fail-fast out of DB context)
    const balanceResponse = await accountBalance();
    const vendorBalance = Number(balanceResponse?.balance);

    if (vendorBalance < amount) {
      await insufficientBalanceWarning(vendorBalance).catch(logger.error);
      return res.status(503).json("Service Not Available. Try again later.");
    }

    // 2. Fetch Wallet Data Early to run Bcrypt OUTSIDE the transaction
    const agentWallet = await knex("wallets")
      .select("id", "user_key", "amount", "active")
      .where({ user_id: id })
      .first();

    if (
      !agentWallet ||
      !(await bcrypt.compare(info?.token, agentWallet.user_key))
    ) {

      return res.status(400).json("Invalid pin!");
    }

    if (Number(agentWallet.amount) < amount) {
      // Async save failure notification safely outside response lifecycle
      saveFailureNotification(
        id,
        `Your airtime transfer of ${currencyFormatter(amount)} to ${info?.recipient} failed due to insufficient wallet balance.`,
      );
      return res
        .status(400)
        .json("Insufficient wallet balance to complete transaction!");
    }

    // 3. Begin Database Mutating Transaction
    const transx = await knex.transaction();
    try {
      const commissionData = await transx("agent_commissions")
        .select("rate")
        .where({ user_id: id, provider: info?.network })
        .first();

      if (!commissionData) {
        await transx.rollback();
        return res
          .status(400)
          .json(
            "Agent commission details not available. Contact administrator for help",
          );
      }

      const transactionId = generateId();
      const transaction_reference = randomBytes(24).toString("hex"); // Fixed reference

      const commission = ((commissionData?.rate || 0.2) / 100) * amount;
      const payableAmount = amount - commission;

      // Lock row for update and decrement balance safely
      await transx("wallets")
        .where("user_id", id)
        .decrement({ amount: payableAmount });

      // Note: Make sure the table name matches your worker ("agent_transaction" vs "agent_transactions")
      const transactionInfo = {
        id: transactionId,
        user_id: id,
        reference: transaction_reference,
        type: "airtime",
        recipient: info?.recipient,
        provider: info?.network,
        info: JSON.stringify({
          recipient: info?.recipient,
          ref: transaction_reference,
          amount: payableAmount,
        }),
        amount: payableAmount,
        commission,
        total_amount: amount,
        status: "pending",
      };

      await transx("agent_transactions").insert(transactionInfo);
      await transx.commit();

      // 4. Dispatch to BullMQ using the UNIQUE transaction ID, not the user ID
      await airtimeQueue.add(
        "send-airtime",
        {
          userID: id, // Fixed: ensure your worker maps this correctly to 'userID'
          transactionId, // Fixed: previously passed user 'id'
          paymentReference: transaction_reference,
          phonenumber,
          commissionData,
          ...info,
        },
        {
          jobId: transactionId, // Fixed: allowing users to perform multiple transactions sequentially
          attempts: 5,
          removeOnComplete: 100,
        },
      );

      return res.status(200).json("Processing Complete. Awaiting Transfer!");
    } catch (error) {
      if (transx) await transx.rollback();
      console.log(error);
      logger.error("Airtime route failed:", error);

      saveFailureNotification(
        id,
        `Your airtime transfer of ${currencyFormatter(amount)} to ${info?.recipient} failed. Please try again later.`,
      );
      return res.status(500).json("Transaction failed! An error has occurred.");
    }
  }),
);

// Helper function to process notifications out of the critical main loop path safely
function saveFailureNotification(agentId, bodyText) {
  knex("notifications")
    .insert({
      id: generateId(),
      agent_id: agentId,
      type: "airtime",
      title: "Airtime Transfer Failed!",
      body: bodyText,
    })
    .catch((err) =>
      logger.error("Failed to save background notification:", err),
    );
}

//Send airtime to recipient
router.post(
  "/top-up/bulk/airtime",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    const { content, token } = req.body; // 'token' extracted correctly here
    const { id, phonenumber } = req.user;

    if (!Array.isArray(content) || content.length === 0) {
      return res
        .status(400)
        .json("Invalid payload. Recipient content is required.");
    }

    // Step 1: Calculate total face value amount
    const totalFaceAmount = _.sumBy(content, (info) =>
      Number(info?.amount || 0),
    );

    // 1. External Vendor Balance Check (Fail-fast out of DB context)
    const balanceResponse = await accountBalance();
    const vendorBalance = Number(balanceResponse?.balance);

    if (vendorBalance < totalFaceAmount) {
      await insufficientBalanceWarning(vendorBalance).catch(logger.error);
      return res.status(503).json("Service Not Available. Try again later.");
    }

    // 2. Fetch Wallet Data Early to run Bcrypt OUTSIDE the transaction
    const agentWallet = await knex("wallets")
      .select("id", "user_key", "amount", "active")
      .where({ user_id: id })
      .first();

    // Fixed typo: swapped 'info?.token' for the correctly extracted 'token' variable
    if (!agentWallet || !(await bcrypt.compare(token, agentWallet.user_key))) {
      return res.status(401).json("Invalid pin!");
    }

    if (Number(agentWallet.amount) < totalFaceAmount) {
      saveFailureNotification(
        id,
        `Your bulk airtime transfer of ${currencyFormatter(totalFaceAmount)} failed due to insufficient wallet balance.`,
      );
      return res
        .status(400)
        .json("Insufficient wallet balance to complete transaction!");
    }

    // 3. Pre-fetch ALL agent commissions in a SINGLE batch query to eliminate N+1 loops
    const uniqueProviders = [
      ...new Set(
        content.map(
          (info) =>
            getPhoneNumberInfo(info?.recipient?.toString()).providerName,
        ),
      ),
    ];
    const commissionsList = await knex("agent_commissions")
      .select("provider", "rate")
      .where({ user_id: id })
      .whereIn("provider", uniqueProviders);

    // Convert to dictionary for O(1) lightning-fast lookups
    const commissionMap = _.keyBy(commissionsList, "provider");

    const transaction_reference = randomBytes(24).toString("hex");
    const transx = await knex.transaction();

    try {
      // Step 4: Map transaction objects completely in-memory
      const transactions = content.map((info) => {
        const parsed = getPhoneNumberInfo(info?.recipient?.toString());
        const faceAmount = Number(info.amount);

        const airtimeInfo = {
          recipient: info.recipient,
          amount: faceAmount,
          network: parsed.code,
          transaction_reference,
        };

        const rate = commissionMap[parsed.providerName]?.rate || 0.2; // Standard fallback
        const commissionAmount = (rate / 100) * faceAmount;
        const payableAmount = faceAmount - commissionAmount;

        const transactionInfo = {
          id: generateId(),
          user_id: id,
          reference: transaction_reference,
          type: "airtime",
          recipient: parsed.phoneNumber,
          provider: parsed.providerName,
          info: JSON.stringify({
            recipient: info.recipient,
            ref: transaction_reference,
            amount: payableAmount,
          }),
          amount: payableAmount,
          commission: commissionAmount,
          total_amount: faceAmount,
          status: "pending",
        };

        return { transactionInfo, airtimeInfo, payableAmount };
      });

      const totalPayable = _.sumBy(transactions, "payableAmount");

      // Step 5: Verify real-time net balances inside the isolated transaction block
      if (Number(agentWallet.amount) < totalPayable) {
        await transx.rollback();
        return res
          .status(400)
          .json("Insufficient net wallet balance to complete transaction!");
      }

      // Deduct net cost from agent's wallet
      await transx("wallets")
        .where("user_id", id)
        .decrement({ amount: totalPayable });

      // Bulk batch insert all database records in a single statement
      await transx("agent_transactions").insert(
        transactions.map((t) => t.transactionInfo),
      );

      await transx.commit();

      // 6. Forward the batch work to your processing queue
      await bulkAirtimeQueue.add(
        "send-bulk-airtime",
        {
          userID: id,
          paymentReference: transaction_reference,
          phonenumber,
          // Sending only raw data structures over Redis to keep memory lightweight
          payloads: transactions.map((t) => ({
            id: t.transactionInfo.id,
            commission: t.transactionInfo.commission,
            airtimeInfo: t.airtimeInfo,
          })),
        },
        {
          jobId: transaction_reference,
          attempts: 5,
          removeOnComplete: 100,
        },
      );

      return res.status(200).json("Processing Complete. Awaiting Transfer!");
    } catch (err) {
      if (transx) await transx.rollback();
      logger.error("Bulk airtime route failed:", err);

      saveFailureNotification(
        id,
        `Your bulk airtime transfer of ${currencyFormatter(totalFaceAmount)} failed. Please try again later.`,
      );

      return res.status(500).json("Transaction failed! An error has occurred.");
    }
  }),
);

// // Asynchronous background notification engine
// function saveFailureNotification(agentId, bodyText) {
//   knex("notifications").insert({
//     id: generateId(),
//     agent_id: agentId,
//     type: "airtime",
//     title: "Bulk Airtime Transfer Failed!",
//     body: bodyText
//   }).catch(err => logger.error("Failed to save background notification:", err));
// }

//Send bundle to recipient

router.post(
  "/top-up/bundle",
  verifyToken,
  verifyAgent,
  asyncHandler(async (req, res) => {
    // Fixed: 'bundle' contains the pricing details directly in this route context
    const { bundle, recipient, token, network } = req.body;
    const { id, phonenumber } = req.user; // Fixed: Extract phonenumber from req.user for the queue
    // console.log(req.body);

    // Fixed: Ensure bundle and amount exist safely
    const bundlePrice = Number(bundle?.price || 0);
    if (!bundlePrice || !recipient) {
      return res
        .status(400)
        .json("Invalid bundle details or recipient specified.");
    }

    // 1. External Vendor Balance Check (Fail-fast out of DB context)
    const balanceResponse = await accountBalance();
    const vendorBalance = Number(balanceResponse?.balance);

    if (vendorBalance < bundlePrice) {
      await insufficientBalanceWarning(vendorBalance).catch(logger.error);
      return res.status(503).json("Service Not Available. Try again later.");
    }

    // 2. Fetch Wallet Data Early to run Bcrypt OUTSIDE the transaction
    const agentWallet = await knex("wallets")
      .select("id", "user_key", "amount", "active")
      .where({ user_id: id })
      .first();

    if (!agentWallet || !(await bcrypt.compare(token, agentWallet.user_key))) {
      return res.status(401).json("Invalid pin!");
    }

    if (Number(agentWallet.amount) < bundlePrice) {
      saveBundleFailureNotification(
        id,
        `Your data bundle purchase of ${currencyFormatter(bundlePrice)} to ${recipient} failed due to insufficient wallet balance.`,
      );
      return res
        .status(400)
        .json("Insufficient wallet balance to complete transaction!");
    }

    // 3. Begin Database Mutating Transaction
    const transx = await knex.transaction();
    try {
      // Fixed: Generate a SINGLE immutable transaction ID to tie database and queue together
      const transactionId = generateId();
      const transaction_reference = randomBytes(24).toString("hex");

      // Lock row for update and decrement balance safely
      await transx("wallets")
        .where("user_id", id)
        .decrement({ amount: bundlePrice });

      const bundleInfo = {
        recipient,
        data_code: bundle.plan_id,
        network: bundle.network_code || 0,
        transaction_reference,
      };

      const transactionInfo = {
        id: transactionId, // Fixed: Using synchronized ID
        user_id: id,
        reference: transaction_reference,
        type: "bundle",
        recipient,
        provider: network,
        info: JSON.stringify({
          recipient,
          ref: transaction_reference,
          amount: bundlePrice,
          ...bundle,
        }),
        amount: bundlePrice,
        commission: 0,
        total_amount: bundlePrice,
        status: "pending", // Fixed: Added missing state key
      };

      await transx("agent_transactions").insert(transactionInfo);
      await transx.commit();

      // 4. Dispatch to BullMQ using matched keys
      await bundleQueue.add(
        "send-bundle",
        {
          userID: id,
          transactionId, // Securely mapped to matching DB row
          paymentReference: transaction_reference,
          phonenumber, // Safely provided from req.user
          bundleInfo,
          amount: bundlePrice,
        },
        {
          jobId: transactionId,
          attempts: 5,
          removeOnComplete: 100,
        },
      );

      return res.status(200).json("Processing Complete. Awaiting Transfer!");
    } catch (error) {
      if (transx) await transx.rollback();
      logger.error("Data bundle route failed:", error);

      // Fixed string interpolations using active scope parameters
      saveBundleFailureNotification(
        id,
        `Your data bundle transfer of ${currencyFormatter(bundlePrice)} to ${recipient} failed. Please try again later.`,
      );
      return res.status(500).json("Transaction failed! An error has occurred.");
    }
  }),
);

// Asynchronous background notification helper
function saveBundleFailureNotification(agentId, bodyText) {
  knex("notifications")
    .insert({
      id: generateId(),
      user_id: agentId,
      type: "bundle", // Adjusted contextual type tag
      title: "Data Bundle Transfer Failed!",
      body: bodyText,
    })
    .catch((err) =>
      logger.error("Failed to save background notification:", err),
    );
}

const insufficientBalanceWarning = async (bal) => {
  const body = `
    Your one-4-all top up account balance is running low. Your remaining balance is GHS ${currencyFormatter(bal)}.
    Please recharge to avoid any inconveniences. Thank you.
  `;

  if (process.env.NODE_ENV === "production") {
    await sendEMail(
      process.env.MAIL_CLIENT_USER,
      mailTextShell(`<p>${body}</p>`),
      "LOW TOP UP ACCOUNT BALANCE",
    );

    await sendSMS(body, process.env.CLIENT_PHONENUMBER);
  }
};

module.exports = router;
