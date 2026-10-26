const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const knex = require("../db/knex");
const generateId = require("../config/generateId");
const { verifyToken } = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");
// const verifySuperAdmin = require("../middlewares/verifySuperAdmin");

const CATEGORIES = [
  "Administrator",
  "Employee",
  "Agent",
  "Verifier",
  "System User",
];

// ─── Helper: Check if role has permissions ──────────────────────────
const getRolePermissions = async (roleId) => {
  const perms = await knex("role_permissions")
    .join("permissions", "role_permissions.permission_id", "permissions.id")
    .where("role_permissions.role_id", roleId)
    // .whereNotIn("name", CATEGORIES)
    .select(
      "permissions.id",
      "permissions.name",
      "permissions.resource",
      "permissions.action",
    );
  return perms;
};

// ─── Routes ──────────────────────────────────────────────────────────

// GET /admin/roles – list all roles (with their permissions)
router.get(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const roles = await knex("roles")
      .whereNull("deleted_at")
      .whereNotIn("name", CATEGORIES)
      .orderBy("name");
    const rolesWithPerms = await Promise.all(
      roles.map(async (role) => {
        const perms = await getRolePermissions(role.id);
        return { ...role, permissions: perms };
      }),
    );
    res.status(200).json(rolesWithPerms);
  }),
);

// GET /admin/permissions – list all permissions
router.get(
  "/permissions",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const permissions = await knex("permissions")
      .whereNull("deleted_at")
      .orderBy("resource", "action");
    res.status(200).json(permissions);
  }),
);

// GET /admin/roles/:id – get single role with permissions
router.get(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const role = await knex("roles").where({ id, deleted_at: null }).first();
    if (!role) return res.status(404).json({ error: "Role not found" });
    const permissions = await getRolePermissions(id);
    res.status(200).json({ ...role, permissions });
  }),
);

// POST /admin/roles – create a new role
router.post(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { name, category, description, permissionIds = [] } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required" });

    const code =
      category === "Administrator"
        ? process.env.ADMIN_ID
        : category === "Employee"
          ? process.env.EMPLOYEE_ID
          : category === "Agent"
            ? process.env.AGENT_ID
            : category === "Verifier"
              ? process.env.SCANNER_ID
              : process.env.USER_ID;

    const existing = await knex("roles")
      .where({ name, deleted_at: null })
      .first();
    if (existing) return res.status(409).json({ error: "Role already exists" });

    const id = generateId();
    await knex("roles").insert({ name, code, description });

    // Assign permissions
    if (permissionIds.length) {
      const rolePerms = permissionIds.map((pid) => ({
        role_id: id,
        permission_id: pid,
      }));
      await knex.batchInsert("role_permissions", rolePerms, 100);
    }

    res.status(201).json({ id, message: "Role created successfully" });
  }),
);

// PATCH /admin/roles/:id – update role (name, description, permissions)
router.patch(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;

    const role = await knex("roles").where({ id, deleted_at: null }).first();
    if (!role) return res.status(404).json({ error: "Role not found" });

    // Update name/description if provided
    if (name !== undefined || description !== undefined) {
      const update = {};
      if (name) update.name = name;
      if (description !== undefined) update.description = description;
      await knex("roles").where({ id }).update(update);
    }

    // Update permissions if provided (replace all)
    if (permissionIds !== undefined) {
      await knex("role_permissions").where({ role_id: id }).del();
      if (permissionIds.length) {
        const rolePerms = permissionIds.map((pid) => ({
          role_id: id,
          permission_id: pid,
        }));
        await knex.batchInsert("role_permissions", rolePerms, 100);
      }
    }

    res.status(200).json({ message: "Role updated successfully" });
  }),
);

// DELETE /admin/roles/:id – soft delete role (prevent deletion of super_admin)
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const role = await knex("roles").where({ id, deleted_at: null }).first();
    if (!role) return res.status(404).json({ error: "Role not found" });
    if (role.name === "super_admin") {
      return res.status(403).json({ error: "Cannot delete super_admin role" });
    }
    await knex("roles").where({ id }).update({ deleted_at: knex.fn.now() });
    res.status(200).json({ message: "Role deleted successfully" });
  }),
);

// ─── Permissions routes ──────────────────────────────────────────────

// POST /admin/permissions – create a new permission
router.post(
  "/permissions",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { name, resource, action, description } = req.body;
    if (!name || !resource || !action) {
      return res
        .status(400)
        .json({ error: "name, resource, action are required" });
    }
    const existing = await knex("permissions")
      .where({ name, deleted_at: null })
      .first();
    if (existing)
      return res.status(409).json({ error: "Permission already exists" });

    const id = generateId();
    await knex("permissions").insert({
      id,
      name,
      resource,
      action,
      description,
    });
    res.status(201).json({ id, message: "Permission created successfully" });
  }),
);

// DELETE /admin/permissions/:id – soft delete permission
router.delete(
  "/permissions/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const perm = await knex("permissions")
      .where({ id, deleted_at: null })
      .first();
    if (!perm) return res.status(404).json({ error: "Permission not found" });
    await knex("permissions")
      .where({ id })
      .update({ deleted_at: knex.fn.now() });
    res.status(200).json({ message: "Permission deleted successfully" });
  }),
);

module.exports = router;
