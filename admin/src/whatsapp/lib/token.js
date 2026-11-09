import { getConfig } from "./config";

/**
 * Cache for the short-lived WhatsApp service token.
 * One in-flight request at a time; refreshed a minute before expiry.
 */

const REFRESH_MARGIN_MS = 60_000;
const FALLBACK_TTL_S = 240;

let cached = null; // { token, expiresAtMs }
let inflight = null;

export class WhatsAppApiError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status]
   */
  constructor(code, message, status = 0) {
    super(message);
    this.name = "WhatsAppApiError";
    this.code = code;
    this.status = status;
  }
}

/** Seconds left on a JWT, read from its `exp` claim (not verified: display and caching only). */
function secondsLeft(jwt) {
  try {
    const payload = JSON.parse(
      atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof payload.exp === "number")
      return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    /* not a readable JWT: use the fallback */
  }
  return FALLBACK_TTL_S;
}

async function fetchToken() {
  let result;
  try {
    result = await getConfig().getToken;
  } catch (err) {
    if (err instanceof WhatsAppApiError) throw err;
    throw new WhatsAppApiError(
      "TOKEN_UNAVAILABLE",
      "Couldn't start a WhatsApp session. Try again.",
    );
  }

  const token = typeof result === "string" ? result : result;

  if (!token)
    throw new WhatsAppApiError(
      "TOKEN_UNAVAILABLE",
      "Couldn't start a WhatsApp session. Try again.",
    );

  // Relative lifetime, not an absolute time, so client clock skew can't break refresh.
  const ttl =
    (typeof result === "object" && result.expiresIn) || secondsLeft(token);
  cached = { token, expiresAtMs: Date.now() + ttl * 1000 };
  return token;
}

/** @param {{ force?: boolean }} [options] */
export function getAccessToken({ force = false } = {}) {
  if (!force && cached && cached.expiresAtMs - Date.now() > REFRESH_MARGIN_MS) {
    return Promise.resolve(cached.token);
  }
  inflight ??= fetchToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function clearAccessToken() {
  cached = null;
}

/**
 * Default `getToken` for apps whose backend mints the token (see server-example/).
 * Sends the user's cookie session, or whatever headers `getHeaders` returns (e.g. a Bearer token).
 *
 * @param {{ url?: string, credentials?: RequestCredentials, getHeaders?: () => Record<string,string> | Promise<Record<string,string>> }} [options]
 */
export function createTokenFetcher({
  url = "/whatsapp/token",
  credentials = "include",
  getHeaders,
} = {}) {
  return async function tokenFromBackend() {
    let res;

    try {
      res = await fetch(url, {
        method: "POST",
        credentials,
        cache: "no-store",
        headers: getHeaders ? await getHeaders() : undefined,
      });
    } catch {
      throw new WhatsAppApiError(
        "NETWORK_ERROR",
        "Can't reach the server. Check your connection and try again.",
      );
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.token) {
      throw new WhatsAppApiError(
        body?.error?.code ?? "TOKEN_UNAVAILABLE",
        body?.error?.message ?? "Couldn't start a WhatsApp session. Try again.",
        res.status,
      );
    }
    return { token: body.token, expiresIn: body.expiresIn };
  };
}
