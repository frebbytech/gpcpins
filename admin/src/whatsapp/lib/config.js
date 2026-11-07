/**
 * Runtime configuration, set once by <WhatsAppProvider>.
 *
 * The api, token and socket modules are plain singletons (one socket per browser tab), so they
 * read their settings from here instead of from props.
 *
 * @typedef {Object} TokenResult
 * @property {string} token       Short-lived JWT for the WhatsApp service.
 * @property {number} [expiresIn] Lifetime in seconds. If omitted it is read from the JWT's `exp`.
 *
 * @typedef {Object} WhatsAppConfig
 * @property {string} serviceUrl  Base URL of the WhatsApp service, e.g. "https://wa.example.com".
 * @property {() => Promise<string | TokenResult>} getToken  Returns a service token for the signed-in user.
 */

/** @type {WhatsAppConfig | null} */
let current = null;

/** @param {WhatsAppConfig} config */
export function configureWhatsApp(config) {
  current = config;
}

export function getConfig() {
  if (!current) {
    throw new Error("WhatsApp is not configured. Wrap your page in <WhatsAppProvider>.");
  }
  return current;
}
