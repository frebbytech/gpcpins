const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const knex = require("../db/knex");
const generateId = require("../config/generateId");
const { sendSMS } = require("../config/sms");
const sendEMail = require("../config/sendEmail");
const { mailTextShell } = require("../config/mailText");
const { rateLimit } = require("express-rate-limit");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { verifyToken } = require("../middlewares/verifyToken");
const { getInternationalMobileFormat } = require("../config/PhoneCode");
const { generateNextId } = require("../config/helpers/generated-ids");

// ─── Rate limiter for public submission ──────────────────────────────
const complaintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 complaints per IP per window
  message: "Too many complaints submitted. Please try again later.",
});

// ─── Validation helper ──────────────────────────────────────────────
const validateComplaint = (data) => {
  const { serviceType, paymentMode, comment, meterNo } = data;
  if (!serviceType || !comment) {
    throw new Error("Missing required fields: serviceType, comment");
  }
  if (
    !["prepaid", "postpaid", "bundle", "airtime", "voucher", "meter"].includes(
      serviceType,
    )
  ) {
    throw new Error(
      "serviceType must be one of: prepaid, postpaid, bundle, airtime, voucher, meter",
    );
  }
  if (["prepaid", "postpaid", "meter"].includes(serviceType) && !meterNo) {
    throw new Error(
      "meter_no is required when serviceType is prepaid, postpaid, or meter",
    );
  }
  if (!["wallet", "mobile_money", "other"].includes(paymentMode)) {
    throw new Error("paymentMode must be wallet, mobile_money, or other");
  }
};

// ─── Routes ──────────────────────────────────────────────────────────

/**
 * GET /complaints
 * Admin only – list all complaints with optional filters
 * Query: status, service_type, page, limit
 */
router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    if (
      ![process.env.ADMIN_ID, process.env.EMPLOYEE_ID].includes(req.user.role)
    ) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    const { permissions = [] } = req.user;

    // Define permission mapping to database service types
    const permissionMapping = {
      "Manage Airtime Transfer Complaints": "airtime",
      "Manage Data Bundle Complaints": "bundle", // Kept your double space matching the array
      "Manage Prepaid Complaints": "prepaid",
      "Manage Vouchers & Tickets Complaints": "voucher",
      "Manage Meter Complaints": "meter",
      "Manage Wallet Complaints": "wallet",
    };

    // Extract database service types authorized by user's permissions
    const allowedServiceTypes = permissions
      .map((p) => permissionMapping[p])
      .filter(Boolean);

    const { status, service_type, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = knex("complaints")
      .select(
        "id",
        "incident_date",
        "service_type",
        "transaction_id",
        "meter_no",
        "payment_mode",
        "phonenumber",
        "comment",
        "status",
        "assigned_to",
        "resolution",
        "created_at",
        "updated_at",
      )
      .whereNull("deleted_at")
      .orderBy("created_at", "desc");

    // Enforce permission-based filtering
    if (allowedServiceTypes.length === 0) {
      // User has none of the required permissions: return empty results early
      return res.status(200).json({
        data: [],
        pagination: { page: Number(page), limit: Number(limit), total: 0 },
      });
    }

    if (service_type) {
      // If a specific service type is requested, ensure the user has permission for it
      if (allowedServiceTypes.includes(service_type)) {
        query = query.where("service_type", service_type);
      } else {
        // Requested a service type they are not allowed to see
        return res.status(200).json({
          data: [],
          pagination: { page: Number(page), limit: Number(limit), total: 0 },
        });
      }
    } else {
      // No specific type requested: filter by all service types they own permission for
      query = query.whereIn("service_type", allowedServiceTypes);
    }

    // Apply status filter
    if (status) query = query.where("status", status);

    // Apply search (match against transaction_id, meter_no, phonenumber)
    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`;
      query = query.where(function () {
        this.where("transaction_id", "LIKE", searchTerm)
          .orWhere("id", "LIKE", searchTerm)
          .orWhere("meter_no", "LIKE", searchTerm)
          .orWhere("phonenumber", "LIKE", searchTerm);
      });
    }

    // Clone for total count
    const totalQuery = query
      .clone()
      .clearSelect()
      .clearOrder()
      .count("id as total");

    const [data, totalResult] = await Promise.all([
      query.limit(limit).offset(offset),
      totalQuery.first(),
    ]);

    res.status(200).json({
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalResult?.total || 0,
      },
    });
  }),
);

/**
 * GET /complaints/:id
 * Admin only – get single complaint details
 */
router.get(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    if (
      ![process.env.ADMIN_ID, process.env.EMPLOYEE_ID].includes(req.user.role)
    ) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const { id } = req.params;
    const complaint = await knex("complaints")
      .select(
        "id",
        "incident_date",
        "service_type",
        "transaction_id",
        "meter_no",
        "payment_mode",
        "phonenumber",
        "comment",
        "status",
        "assigned_to",
        "resolution",
        "created_at",
        "updated_at",
      )

      .where({ id, deleted_at: null })
      .first();

    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    // Optionally fetch user details (name, email, phone)
    // const user = await knex("vw_users_with_roles")
    //   .select("name", "email", "phonenumber")
    //   .where({ id: complaint.user_id })
    //   .first();
    // complaint.user = user || {};

    res.status(200).json(complaint);
  }),
);

/**
 * POST /complaints
 * Public – submit a new complaint (rate limited)
 */
router.post(
  "/",
  complaintLimiter,

  asyncHandler(async (req, res) => {
    const payload = req.body;

    try {
      validateComplaint(payload);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // You may want to associate complaint with user if logged in
    // For now we store user_id as null (or from token if present)
    // We'll also store phonenumber if provided (optional)
    const { user_id = null, phonenumber = null, ...rest } = payload;

    const lastComplaint = await knex("complaints")
      .select("id")
      .orderBy("created_at", "desc")
      .first();

    const lastId = lastComplaint ? lastComplaint.id : "";
    const complaintId = generateNextId(lastId) || generateId(12); // Fallback to random ID if needed

    await knex("complaints").insert({
      id: complaintId,
      incident_date: rest.incidentDate
        ? new Date(rest.incidentDate)
        : knex.fn.now(),
      service_type: rest.serviceType,
      transaction_id: rest?.transactionId || null,
      meter_no: rest.meterNo || null,
      payment_mode: rest.paymentMode || "other",
      comment: rest.comment,
      phonenumber: phonenumber || null,
      status: "pending",
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });

    res.status(201).json({
      id: complaintId,
      message: "Complaint submitted successfully",
    });

    setImmediate(async () => {
      // ─── Send SMS to user (if phonenumber exists) ──────────────────
      if (phonenumber) {
        try {
          await sendSMS(
            `Dear customer, we have received your complaint (ID: ${complaintId}). We will get back to you shortly.`,
            getInternationalMobileFormat(phonenumber, false),
          );
        } catch (smsErr) {
          // Log error but don't block response
          console.error("SMS send error:", smsErr.message);
        }
      }

      // ─── Optionally send email to support/admin ──────────────────────
      try {
        const adminEmails = await knex("vw_users_with_roles")
          .where("role_name", "Administrator")
          .pluck("email");

        if (adminEmails.length) {
          const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>New Complaint Received</h2>
          <p><strong>Complaint ID:</strong> ${complaintId}</p>
          <p><strong>Incident Date:</strong> ${new Date(rest.incidentDate).toLocaleDateString()}</p>
          <p><strong>Service Type:</strong> ${rest.serviceType}</p>
          <p><strong>Transaction ID:</strong> ${rest.transactionId}</p>
          <p><strong>Meter No:</strong> ${rest.meterNo || "N/A"}</p>
          <p><strong>Payment Mode:</strong> ${rest.paymentMode}</p>
          <p><strong>Comment:</strong> ${rest.comment}</p>
          <p><strong>Phone:</strong> ${phonenumber || "N/A"}</p>
          <a href="${process.env.APP_URL}/complaints/${complaintId}">View Complaint</a>
        </div>`;
          await sendEMail(
            adminEmails.join(","),
            mailTextShell(html),
            "New Customer Complaint",
          );
        }
      } catch (emailErr) {
        console.error("Admin email error:", emailErr.message);
      }
    });
  }),
);

/**
 * PATCH /complaints/:id
 * Admin only – update status, resolution, assigned_to
 */
router.patch(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    if (
      ![process.env.ADMIN_ID, process.env.EMPLOYEE_ID].includes(req.user.role)
    ) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const { id } = req.params;
    const { status, resolution, assigned_to } = req.body;
    // console.log(req.body);

    // Validate status if provided
    if (
      status &&
      !["pending", "open", "resolved", "unresolved"].includes(status)
    ) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // Check if complaint exists and not deleted
    const existing = await knex("complaints")
      .where({ id, deleted_at: null })
      .first("id", "status", "phonenumber");
    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    // Build update object
    const updates = {
      updated_at: knex.fn.now(),
    };
    if (status !== undefined) updates.status = status;
    if (resolution !== undefined) updates.resolution = resolution;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;

    await knex("complaints").where({ id }).update(updates);

    // ─── Send SMS on status change to resolved/unresolved ──────────
    if (
      status &&
      ["resolved", "unresolved"].includes(status) &&
      existing.phonenumber
    ) {
      const statusMsg = status === "resolved" ? "resolved" : "unresolved";
      try {
        await sendSMS(
          `Dear customer, your complaint #${id} has been ${statusMsg}. ${
            resolution ? `Note: ${resolution}` : ""
          }`,
          existing.phonenumber,
        );
      } catch (smsErr) {
        console.error("SMS send error:", smsErr.message);
      }
    }

    // If resolved, we could also send email to user (but SMS is enough)

    res.status(200).json({ message: "Complaint updated successfully" });
  }),
);

/**
 * DELETE /complaints/:id
 * Admin only – soft delete complaint
 */
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await knex("complaints")
      .where({ id, deleted_at: null })
      .first("id");
    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    await knex("complaints")
      .where({ id })
      .update({ deleted_at: knex.fn.now() });

    res.status(200).json({ message: "Complaint deleted successfully" });
  }),
);

module.exports = router;
