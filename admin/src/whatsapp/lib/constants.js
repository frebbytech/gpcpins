/**
 * Mirrors the WhatsApp service contract.
 *
 * Connection states, in the order a link normally goes through them:
 * idle, creating, connecting, qr_ready | pairing_code_ready, authenticating, connected;
 * and afterwards reconnecting, disconnected, logged_out, failed.
 */

/** States where the service is actively working toward (or holding) a connection. */
export const TRANSIENT_STATES = new Set([
  "creating",
  "connecting",
  "qr_ready",
  "pairing_code_ready",
  "authenticating",
  "reconnecting",
]);

export const EXPIRED_CODES = new Set(["WHATSAPP_QR_EXPIRED", "WHATSAPP_PAIRING_CODE_EXPIRED"]);

export const WA_EVENTS = {
  sessionCreated: "whatsapp:session-created",
  qr: "whatsapp:qr",
  pairingCode: "whatsapp:pairing-code",
  connecting: "whatsapp:connecting",
  connected: "whatsapp:connected",
  disconnected: "whatsapp:disconnected",
  loggedOut: "whatsapp:logged-out",
  authFailed: "whatsapp:auth-failed",
  error: "whatsapp:error",
  accountUpdated: "whatsapp:account-updated",
  accountRemoved: "whatsapp:account-removed",
};

/**
 * The single client-side source of truth for one account, cached in TanStack Query.
 *
 * @typedef {Object} WhatsAppStatus
 * @property {boolean} hasSession
 * @property {string} status                       One of the states above.
 * @property {string} [sessionId]                  The account id used in every call.
 * @property {string | null} [label]
 * @property {"unlinked" | "linked" | "revoked"} [authStatus]
 * @property {string | null} [phoneNumber]
 * @property {{ qr: string, expiresAt: string }} [qr]            Raw QR string. Render it, never log it.
 * @property {{ code: string, expiresAt: string }} [pairingCode]
 * @property {{ code: string, message: string }} [notice]        Latest error or expiry message.
 */

/** @type {WhatsAppStatus} */
export const EMPTY_STATUS = { hasSession: false, status: "idle" };
