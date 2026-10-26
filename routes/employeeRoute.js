const router = require("express").Router();
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const { randomBytes } = require("crypto");
const _ = require("lodash");
const multer = require("multer");

const sendMail = require("../config/sendEmail");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { verifyToken, removeUser } = require("../middlewares/verifyToken");
const generateId = require("../config/generateId");
//model

const { mailTextShell } = require("../config/mailText");
const { uploadPhoto } = require("../config/uploadFile");

//db
const knex = require("../db/knex");
const { isValidUUID2, isValidEmail } = require("../config/validation");
const { storeOTP } = require("../services/otp.services");
const { getInternationalMobileFormat } = require("../config/PhoneCode");

const Storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./images/");
  },
  filename: function (req, file, cb) {
    const ext = file?.originalname?.split(".")[1];

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

router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.user;

    const employees = await knex("vw_users_with_roles")
      .select("*")
      .whereIn("role", [process.env.EMPLOYEE_ID, process.env.ADMIN_ID])
      .whereNot({ id });

    res.status(200).json(employees);
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

    const employee = await knex("vw_users_with_roles")
      .select("*")
      .where({
        id,
      })
      .first();

    if (_.isEmpty(employee)) {
      return res.status(400).json({});
    }

    const permissions = await getPermissions(employee?.role_id);

    const modifiedEmployee = {
      ...employee,
      permissions: permissions,
      role: employee.role_name,
    };

    res.status(200).json(modifiedEmployee);
  }),
);

router.post(
  "/",
  verifyToken,
  verifyAdmin,
  Upload.single("profile"),
  asyncHandler(async (req, res) => {
    const { id: USERID } = req.user;
    const newEmployee = { ...req.body }; // Shallow clone to prevent mutating req.body directly

    // 1. Parallelize early validation and role lookup
    const [existingEmail, existingUsername, existingPhoneNumber, role] =
      await Promise.all([
        knex("users").select("email").where("email", newEmployee.email).first(),
        knex("users")
          .select("username")
          .where("username", newEmployee.username)
          .first(),
        knex("users")
          .select("phonenumber")
          .whereIn("phonenumber", [
            newEmployee.phonenumber,
            getInternationalMobileFormat(newEmployee.phonenumber),
            getInternationalMobileFormat(newEmployee.phonenumber, false),
          ])
          .first(),
        knex("roles").select("id").where("name", newEmployee.role).first(),
      ]);

    if (existingEmail) {
      return res
        .status(400)
        .json("An employee with this account already exists!");
    }
    if (existingUsername) {
      return res
        .status(400)
        .json(`Username, '${newEmployee.username}' is not available!`);
    }
    if (existingPhoneNumber) {
      return res
        .status(400)
        .json(`Phone number, '${newEmployee.phonenumber}' already exists!`);
    }
    if (!role) {
      return res.status(400).json(`Role '${newEmployee.role}' does not exist!`);
    }

    // 2. Handle file uploading before starting the database transaction
    if (req.file) {
      newEmployee.profile = await uploadPhoto(req.file);
    }

    // Clean up properties not matching your DB schema columns
    delete newEmployee.role;
    const employeeId = generateId();

    const hashedPassword = await bcrypt.hash(newEmployee?.password, 12);

    const transx = await knex.transaction();
    try {
      // 3. Database operations enclosed in transaction
      await transx("users").insert({
        id: employeeId,
        profile: newEmployee.profile || null,
        firstname: newEmployee.firstname,
        lastname: newEmployee.lastname,
        username: newEmployee.username,
        email: newEmployee.email,
        dob: newEmployee.dob,
        residence: newEmployee.residence,
        nid: newEmployee.nid,
        phonenumber: newEmployee.phonenumber,
        role_id: role.id,
        password: hashedPassword,
        permissions: JSON.stringify([]),
      });

      // const token = randomBytes(32).toString("hex");
      // await storeOTP(employeeId, token); // Ensure storeOTP accepts transx if it writes to DB

      await transx("activity_logs").insert({
        user_id: USERID,
        title: "Created new employee account.",
        severity: "info",
      });

      await transx.commit();
      res.status(201).json("Employee saved successfully!!!");

      // 4. Offload email generation and delivery asynchronously
      // setImmediate(async () => {
      //   try {
      //     const baseUrl =
      //       process.env.NODE_ENV === "production"
      //         ? "https://admin.gpcpins.com"
      //         : "http://localhost:5003";

      //     const message_url = `${baseUrl}/auth/verify?id=${employeeId}&token=${token}&type=new`;

      //     const message = `
      //       <div style="width:500px; font-family: sans-serif;">
      //         <h2 style="text-align:center;">Verify your email</h2>
      //         <p style="text-align:center;">Please confirm that you want to use ${newEmployee.email} as your Gab Powerful Account email address.</p>
      //         <a href='${message_url}' style="display:block; margin:20px auto; text-align:center; background-color: #083d77; color: #fff; padding: 12px 15px; text-decoration: none; width: 200px;">Verify</a>
      //         <p>Link expires in 15 minutes</p>
      //       </div>`;

      //     await sendMail(newEmployee.email, mailTextShell(message));
      //   } catch (mailError) {
      //     console.error("Background email delivery failed:", mailError);
      //   }
      // });
    } catch (error) {
      await transx.rollback();
      console.error("Transaction Error:", error); // Essential for debugging
      return res
        .status(500)
        .json({ error: "An error has occurred. Try again later" });
    }
  }),
);

router.put(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user;

    const newEmployee = { ...req.body };
    const { id, ...rest } = newEmployee;

    const intNumber = getInternationalMobileFormat(rest?.phonenumber || "");
    const intWNumber = getInternationalMobileFormat(
      rest?.phonenumber || "",
      false,
    );

    const [doesPhoneExists, role] = await Promise.all([
      await knex("users")
        .select("phonenumber")
        .where("phonenumber", "IN", [rest?.phonenumber, intWNumber, intNumber])
        .whereNot("id", id),

      await knex("roles").where("name", rest.role).select("id").first(),
    ]);

    if (!_.isEmpty(doesPhoneExists)) {
      return res
        .status(400)
        .json(`Telephone number '${rest?.phonenumber}' already in use!`);
    }

    if (!role) {
      return res.status(400).json(`Role '${newEmployee.role}' does not exist!`);
    }

    const employee = await knex("users").where("id", id).update({
      firstname: rest?.firstname,
      lastname: rest?.lastname,
      username: rest?.username,
      dob: rest?.dob,
      nid: rest?.nid,
      phonenumber: rest?.phonenumber,
      residence: rest?.residence,
      role_id: role?.id,
    });

    if (employee !== 1) {
      res.status(404).json("Error updating employee information.");
    }

    await removeUser(id);

    //logs
    await knex("activity_logs").insert({
      user_id: userID,
      title: "Modified employee account details.",
      severity: "info",
    });
    //     await redisClient.get(`user:${jti}`);
    //  `user:profile:${jti}`;

    res.status(201).json("Changes saved successfully!!!");
  }),
);

//Enable or Disable Employee Account
router.put(
  "/status",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user;
    const { id, active } = req.body;

    const updatedUser = await knex("users")
      .where("id", id)
      .update({ active: active, is_enabled: active });

    if (updatedUser !== 1) {
      return res.status(400).json("Error updating user info");
    }

    await removeUser(id);

    //logs
    await knex("activity_logs").insert({
      user_id: userID,
      title: `${
        Boolean(active) === true
          ? "Activated an user account!"
          : "Disabled an user account!"
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

//Reset Password
router.put(
  "/reset",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json("Invalid Request.Email not available!");
    }

    try {
      const doesEmployeeExists = await knex("users")
        .select("id", "email")
        .where("email", email)
        .first();

      if (_.isEmpty(doesEmployeeExists)) {
        return res.status(201).json("Password Reset link sent!!!");
      }

      const token = randomBytes(32).toString("hex");

      //  const hashedToken = await bcrypt.hash(refreshToken, 12);

      await storeOTP(
        doesEmployeeExists.id,
        token,
        "gpcpins_password_reset",
        "gpcpins_password_reset_attempts",
      );

      let message_url = `http://localhost:5003/auth/verify?id=${doesEmployeeExists.id}&token=${token}&reset=true`;
      if (process.env.NODE_ENV === "production") {
        message_url = `https://admin.gpcpins.com/auth/verify?id=${doesEmployeeExists.id}&token=${token}&reset=true`;
      }

      const message = `
        <div style="width:500px;">
        <h2 style="display:block;text-align:center;">Password Reset</h2>

        <p style="text-align:center;">Please click on the link below to reset your password.Once it's done ,you would be able to reactivate your account.</p>
        <p style="text-align:center;margin-bottom:16px;">Click on the button.</p>

        <a href='${message_url}' target='_blank'
            style="display:block;margin-block:20px;text-decoration: none;text-align:center;background-color: #083d77;color: #fff;padding: 12px 15px; font-size: 18px;">Reset</a>
      
      
            <p>Button is not showing? <a href='${message_url}' target='_blank' style="color: #083d77;font-weight: bold;">Click here</a></p>

        <p style="text-align:center;">-- Gab Powerful Team --</p>
    </div>
        `;
      res.status(201).json("Password Reset link sent!!!");

      setImmediate(async () => {
        await sendMail(email, mailTextShell(message));
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json("An error has occurred!");
    }
  }),
);

//Reset Employee Password
router.put(
  "/password-reset",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user;
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
      user_id: userID,
      title: "Updated account password!",
      severity: "info",
    });

    res.status(201).json("Password reset successful!");
  }),
);

//@DELETE employees
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id: userID } = req.user;
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(401).json("Invalid Request!");
    }

    const user = await knex("users").where("id", id).del();

    if (user !== 1) {
      return res.status(500).json("Invalid Request!");
    }
    //logs
    await knex("activity_logs").insert({
      user_id: userID,
      title: "Deleted an user account!",
      severity: "error",
    });

    res.status(200).json("User Removed!");
  }),
);

module.exports = router;
