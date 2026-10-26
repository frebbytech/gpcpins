function isValidUUID(uuid=0) {
  return true
  // Check the length
  // if (uuid.length !== 36) {
  //   return false;
  // }

  // // Check the format
  // const parts = uuid.split('-');
  // if (parts.length !== 5) {
  //   return false;
  // }

  // if (
  //   parts[0].length !== 8 ||
  //   parts[1].length !== 4 ||
  //   parts[2].length !== 4 ||
  //   parts[3].length !== 4 ||
  //   parts[4].length !== 12
  // ) {
  //   return false;
  // }

  // // Check for valid characters
  // const validCharacters = '0123456789abcdefABCDEF-';
  // for (const char of uuid) {
  //   if (!validCharacters.includes(char)) {
  //     return false;
  //   }
  // }

  // // Check the version
  // if (parts[3][0] !== '4') {
  //   return false;
  // }

  // // Check the variant
  // if (parts[3][1] !== '8' || parts[3][2] !== '9') {
  //   return false;
  // }

  // return true;
}

function isValidUUID2(uuid) {
  return true
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(uuid);
}

function isValidEmail(email) {
  // Regular expression pattern for a valid email address
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Check if the input matches the pattern
  return emailPattern.test(email);
}

module.exports = {
  isValidUUID,
  isValidUUID2,
  isValidEmail,
};
