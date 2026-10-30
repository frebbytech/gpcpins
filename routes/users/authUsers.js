const { safeJSON } = require("../../config/helpers");
const knex = require("../../db/knex");

async function getVerifier(id) {
  const verifier = await knex("vw_users_with_roles")
    .select(
      "id",
      "firstname",
      "lastname",
      "username",
      "name",
      "email",
      "dob",
      "role",
      "permissions",
      "phonenumber",
      "profile",
      "active",
      "is_enabled",
      "created_at",
      "updated_at"

    )
    .where("id", id)
    .first();

  const { permissions, ...rest } = verifier;

  const authVerifier = {
    ...rest,
    permissions: safeJSON(permissions),
  };

  return authVerifier;
}

module.exports = {
  getVerifier,
};
