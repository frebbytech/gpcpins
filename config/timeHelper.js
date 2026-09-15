// Make sure you have Moment.js library included in your project
const moment = require("moment");
const bcrypt = require("bcryptjs");

function calculateTimeDifference(start, end) {
  const startDate = moment(start);
  const endDate = moment(end).add(1, "hours");

  const differenceInHours = endDate.diff(startDate, "hours");

  if (differenceInHours < 1) {
    const differenceInMinutes = endDate.diff(startDate, "minutes");
    return { type: "minutes", value: differenceInMinutes };
  } else {
    return {
      type: "hours",
      value: differenceInHours,
    };
  }
}

async function generatePassword(password) {
  const hashedPassword = await bcrypt.hash(password, 10);

  return hashedPassword;
}

// generatePassword('Akwasi21@gpcpins');
// $2a$10$JNldzUki/ff7so8h3tKNV.aW5QV7Whhb8mVPu/5XmxgAlyqL/qf2m

module.exports = {
  calculateTimeDifference,
  generatePassword,
};
