/**
 * Builds the digits-only international number the service expects ("233241234567").
 * Strips "+", spaces, hyphens, parentheses, dots, and the trunk "0" people type before
 * the national number ("024 123 4567" becomes "241234567" under country code 233).
 * The service validates again; this keeps obviously wrong input from ever being sent.
 */
export function toE164Digits(countryCode, nationalNumber) {
  const cc = String(countryCode).replace(/\D/g, "");
  const national = String(nationalNumber).replace(/\D/g, "").replace(/^0+/, "");
  return `${cc}${national}`;
}

/** E.164 allows 8-15 digits here, with no leading zero. */
export function isPlausiblePhone(digits) {
  return /^[1-9]\d{7,14}$/.test(digits);
}

/**
 * Validates the two phone fields. Returns an object of messages, empty when valid.
 * @returns {{ countryCode?: string, number?: string }}
 */
export function validatePhone({ countryCode, number }) {
  const errors = {};
  if (!/^\+?\d{1,4}$/.test(String(countryCode).trim())) {
    errors.countryCode = "Enter a country code, like 233.";
  }
  if (!String(number).trim()) {
    errors.number = "Enter your WhatsApp number.";
  } else if (!errors.countryCode && !isPlausiblePhone(toE164Digits(countryCode, number))) {
    errors.number = "Enter a valid number, without the country code.";
  }
  return errors;
}
