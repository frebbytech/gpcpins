import { getConfig } from "./config";
import { clearAccessToken, getAccessToken, WhatsAppApiError } from "./token";

export { WhatsAppApiError };

export function serviceUrl() {
  const url = getConfig().serviceUrl;
  if (!url) {
    throw new WhatsAppApiError("SERVICE_NOT_CONFIGURED", "WhatsApp isn't configured for this app yet.");
  }
  return url.replace(/\/+$/, "");
}

/** One call to the service. Adds the bearer token and unwraps `{ success, data, error }`. */
async function request(path, { method = "GET", body, idempotencyKey } = {}, isRetry = false) {
  const token = await getAccessToken({ force: isRetry });
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let res;
  try {
    res = await fetch(`${serviceUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new WhatsAppApiError("NETWORK_ERROR", "Can't reach WhatsApp right now. Try again in a moment.");
  }

  // A 401 usually means the token expired between refreshes: get a new one and retry once.
  if (res.status === 401 && !isRetry) {
    clearAccessToken();
    return request(path, { method, body, idempotencyKey }, true);
  }

  const envelope = await res.json().catch(() => null);
  if (!res.ok || !envelope?.success) {
    throw new WhatsAppApiError(
      envelope?.error?.code ?? "REQUEST_FAILED",
      envelope?.error?.message ?? "Something went wrong. Try again.",
      res.status,
    );
  }
  return envelope.data;
}

const newKey = () => crypto.randomUUID();

/** Query string from the defined values only. */
function q(params) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const out = s.toString();
  return out ? `?${out}` : "";
}

/** Body for the start calls: `new` and `accountId` are mutually exclusive on the service. */
function startBody({ accountId, newAccount, label } = {}) {
  return { accountId, new: newAccount || undefined, label: label?.trim() || undefined };
}

export const whatsappApi = {
  getStatus: (accountId) => request(`/api/whatsapp/status${q({ accountId })}`),
  listAccounts: () => request("/api/whatsapp/accounts"),
  renameAccount: (accountId, label) =>
    request(`/api/whatsapp/accounts/${encodeURIComponent(accountId)}`, { method: "PUT", body: { label } }),
  /** Logs the account out, deletes its credentials and stored history, and removes it from the list. */
  removeAccount: (accountId) => request(`/api/whatsapp/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" }),

  /** Starts a QR link. @param {{accountId?: string, newAccount?: boolean, label?: string}} [options] */
  createSession: (options = {}) =>
    request("/api/whatsapp/session", { method: "POST", body: startBody(options), idempotencyKey: newKey() }),

  /** @param {string} phoneNumber digits only, with country code, e.g. "233241234567" */
  requestPairingCode: (phoneNumber, options = {}) =>
    request("/api/whatsapp/pairing-code", {
      method: "POST",
      body: { phoneNumber, ...startBody(options) },
      idempotencyKey: newKey(),
    }),

  reconnect: (accountId) => request("/api/whatsapp/reconnect", { method: "POST", body: { accountId } }),
  disconnect: (accountId) => request("/api/whatsapp/disconnect", { method: "POST", body: { accountId } }),
  logout: (accountId) => request("/api/whatsapp/logout", { method: "POST", body: { accountId } }),
};
