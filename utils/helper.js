const { parseTimeToMs } = require("./time");

/**
 * Determines token expiration time based on user role.
 * @param {string} userRole - The role of the current user.
 * @returns {number} The expiration time in milliseconds.
 */

function getExpiryTimeByRole(userRole) {
  // 1. Define privileged roles that get the shorter admin lifespan
  const privilegedRoles = [process.env.ADMIN_ID, process.env.EMPLOYEE_ID];

  // 2. Safely check if the user's role is in the list
  if (userRole && privilegedRoles.includes(userRole)) {
    const accessTime = process.env.ADMIN_ACCESS_TOKEN_EXPIRY || "5m";
    const refreshTime = process.env.ADMIN_REFRESH_TOKEN_EXPIRY || "8h";
    return {
      accessTime,
      refreshTime,
    };
  }

  // 3. Fallback to standard user lifespan
  const accessTime = process.env.ACCESS_TOKEN_EXPIRY || "15m";
  const refreshTime = process.env.REFRESH_TOKEN_EXPIRY || "90d";
  return {
    accessTime,
    refreshTime,
  };
}

function getExpiryTimeByRoleMs(userRole) {
  // 1. Define privileged roles that get the shorter admin lifespan
  const privilegedRoles = [process.env.ADMIN_ID, process.env.EMPLOYEE_ID];

  // 2. Safely check if the user's role is in the list
  if (userRole && privilegedRoles.includes(userRole)) {
    const accessTime = process.env.ADMIN_ACCESS_TOKEN_EXPIRY || "5m";
    const refreshTime = process.env.ADMIN_REFRESH_TOKEN_EXPIRY || "8h";
    return {
      accessTimeMs: parseTimeToMs(accessTime),
      refreshTimeMs: parseTimeToMs(refreshTime),
    };
  }

  // 3. Fallback to standard user lifespan
  const accessTime = process.env.ACCESS_TOKEN_EXPIRY || "15m";
  const refreshTime = process.env.REFRESH_TOKEN_EXPIRY || "60d";
  return {
    accessTimeMs: parseTimeToMs(accessTime),
    refreshTimeMs: parseTimeToMs(refreshTime),
  };
}

module.exports = {
  getExpiryTimeByRoleMs,
  getExpiryTimeByRole,
};
