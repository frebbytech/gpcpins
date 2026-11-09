import { io } from "socket.io-client";
import { serviceUrl } from "./api";
import { clearAccessToken, getAccessToken } from "./token";

/**
 * Singleton Socket.IO client. One connection per browser tab, however many components use it.
 *
 * Socket.IO does NOT auto-reconnect when the server ends the connection deliberately
 * ("io server disconnect", which our service does when the user's token expires) or when
 * handshake middleware rejects it. Both are handled here with a manual, backed-off reconnect.
 * The `auth` callback runs on every attempt, so each reconnect carries a fresh token.
 */

let socket = null;
let retryTimer;
let retryAttempt = 0;

function scheduleReconnect(delayMs) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    socket?.connect();
  }, delayMs);
}

export function getSocket() {
  if (socket) return socket;

  const s = io(serviceUrl(), {
    path: "/socket.io",
    autoConnect: false,
    // WebSocket only: no long-polling fallback, so multiple service instances need no sticky sessions.
    transports: ["websocket"],
    reconnectionDelayMax: 10_000,
    auth: (cb) => {
      getAccessToken()
        .then((token) =>cb({ token }))
        .catch(() => cb({ token: "" })); // server rejects; connect_error handles the retry
    },
  });

  s.on("connect", () => {
    retryAttempt = 0;
  });

  s.on("disconnect", (reason) => {
    // The server closed the connection on purpose (e.g. token expiry): reconnect with a new token.
    if (reason === "io server disconnect") scheduleReconnect(250);
  });

  s.on("connect_error", (err) => {
    if (err.message === "unauthorized") clearAccessToken();
    // `active` is false when Socket.IO has given up on its own (handshake rejected).
    if (!s.active) {
      retryAttempt += 1;
      scheduleReconnect(Math.min(2000 * 2 ** (retryAttempt - 1), 30_000));
    }
  });

  socket = s;
  return s;
}

/** Idempotent: safe to call from every component that needs live updates. */
export function ensureSocketConnected() {
  const s = getSocket();
  if (!s.connected && retryTimer === undefined) s.connect();
  return s;
}

/** Call when the app user signs out, so the tab stops receiving this user's events. */
export function disconnectSocket() {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  retryAttempt = 0;
  socket?.disconnect();
  socket = null;
  clearAccessToken();
}
