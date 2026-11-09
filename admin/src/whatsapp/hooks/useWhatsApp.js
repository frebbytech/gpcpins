import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { setSelectedAccountId } from "../lib/account-store";
import { whatsappApi, WhatsAppApiError } from "../lib/api";
import {
  EMPTY_STATUS,
  EXPIRED_CODES,
  TRANSIENT_STATES,
  WA_EVENTS,
} from "../lib/constants";
import { ensureSocketConnected } from "../lib/socket";
import {
  ACCOUNTS_KEY,
  useActiveAccountId,
  useWhatsAppAccounts,
} from "./useWhatsAppAccounts";

/**
 * One cache entry PER ACCOUNT is the only client-side truth about that account's connection.
 * REST fills it, Socket.IO events (which carry the account's sessionId) patch it, and mutations
 * never write status optimistically. Before the user has any account the key is "default".
 */
export const STATUS_KEY = ["whatsapp", "status"];
export const statusKey = (accountId) => [...STATUS_KEY, accountId ?? "default"];

const CLEARED = { qr: undefined, pairingCode: undefined };

/**
 * Timestamp of the latest cache patch that came from a server event. A status fetch that
 * started before it is older than that event, so its result must not overwrite the event.
 */
let lastEventAt = 0;

function patchFromEvent(qc, sessionId, update) {
  lastEventAt = Date.now();
  qc.setQueryData(statusKey(sessionId), (prev) => update(prev ?? EMPTY_STATUS));
}

function setNotice(qc, accountId, notice) {
  qc.setQueryData(statusKey(accountId), (prev) => ({
    ...(prev ?? EMPTY_STATUS),
    notice,
  }));
}

const toNotice = (err) =>
  err instanceof WhatsAppApiError
    ? { code: err.code, message: err.message }
    : { code: "UNKNOWN", message: "Something went wrong. Try again." };

// ---- status query ------------------------------------------------------------

/**
 * @param {string | undefined} accountId the account being shown (undefined = the service's default)
 * @param {boolean} socketConnected when live updates are down, poll while a connection is in
 *                                  progress so the UI still progresses.
 * @param {boolean} enabled
 */
export function useWhatsAppStatus(
  accountId,
  socketConnected = true,
  enabled = true,
) {
  const qc = useQueryClient();

  return useQuery({
    queryKey: statusKey(accountId),
    enabled,
    queryFn: async () => {
      const startedAt = Date.now();
      const fresh = await whatsappApi.getStatus(accountId);
      if (lastEventAt >= startedAt) {
        const current = qc.getQueryData(statusKey(accountId));
        return current ? { ...fresh, ...current } : fresh;
      }
      return fresh;
    },
    staleTime: 30_000,
    retry: (count, err) =>
      err.status !== 401 && err.status !== 429 && count < 2,
    refetchInterval: (query) => {
      console.log(
        "refetchInterval",
        query?.state?.data,
        socketConnected,
        TRANSIENT_STATES.has(query?.state?.data?.status),
      );
      return !socketConnected &&
        query?.state?.data &&
        TRANSIENT_STATES.has(query?.state?.data?.status)
        ? 2500
        : false;
    },
  });
}

// ---- realtime ----------------------------------------------------------------

/** Subscribes to the user's WhatsApp events and patches each account's status cache. Returns link health. */
export function useWhatsAppRealtime() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = ensureSocketConnected();
    setConnected(socket.connected);
    const refreshAccounts = () =>
      void qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });

    const onSessionCreated = (p) => {
      patchFromEvent(qc, p.sessionId, (s) => ({
        ...s,
        hasSession: true,
        sessionId: p.sessionId,
        label: p.label ?? s.label,
      }));
      refreshAccounts();
    };

    const onConnecting = (p) =>
      patchFromEvent(qc, p.sessionId, (s) => ({
        ...s,
        hasSession: true,
        sessionId: p.sessionId,
        status: "connecting",
        ...CLEARED,
        notice: undefined,
      }));

    const onQr = (p) =>
      patchFromEvent(qc, p.sessionId, (s) => ({
        ...s,
        hasSession: true,
        sessionId: p.sessionId,
        status: "qr_ready",
        qr: { qr: p.qr, expiresAt: p.expiresAt },
        pairingCode: undefined,
        notice: undefined,
      }));

    const onPairingCode = (p) =>
      patchFromEvent(qc, p.sessionId, (s) => ({
        ...s,
        hasSession: true,
        sessionId: p.sessionId,
        status: "pairing_code_ready",
        pairingCode: { code: p.code, expiresAt: p.expiresAt },
        qr: undefined,
        notice: undefined,
      }));

    const onConnected = (p) => {
      patchFromEvent(qc, p.sessionId, (s) => ({
        ...s,
        hasSession: true,
        sessionId: p.sessionId,
        status: "connected",
        authStatus: "linked",
        phoneNumber: p.phoneNumber,
        lastError: null,
        ...CLEARED,
        notice: undefined,
      }));
      refreshAccounts();
    };

    // The server follows an expiry or failure notice with this event, so notices are kept.
    const onDisconnected = (p) => {
      patchFromEvent(qc, p.sessionId, (s) => ({
        ...s,
        status: p.status,
        ...CLEARED,
      }));
      refreshAccounts();
    };

    const onLoggedOut = (p) => {
      patchFromEvent(qc, p.sessionId, (s) => ({
        ...s,
        status: p.status,
        authStatus: "revoked",
        phoneNumber: null,
        ...CLEARED,
      }));
      refreshAccounts();
    };

    const onNotice = (p) =>
      patchFromEvent(qc, p.sessionId, (s) => ({
        ...s,
        notice: { code: p.code, message: p.message },
      }));

    const onAccountUpdated = (p) => {
      patchFromEvent(qc, p.sessionId, (s) => ({ ...s, label: p.label }));
      refreshAccounts();
    };

    const onAccountRemoved = (p) => {
      qc.removeQueries({ queryKey: statusKey(p.sessionId) });
      refreshAccounts();
    };

    const onConnect = () => {
      setConnected(true);
      // Events may have been missed while the link was down: re-sync from the server.
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
      refreshAccounts();
    };
    const onDisconnect = () => setConnected(false);

    const subscriptions = [
      [WA_EVENTS.sessionCreated, onSessionCreated],
      [WA_EVENTS.connecting, onConnecting],
      [WA_EVENTS.qr, onQr],
      [WA_EVENTS.pairingCode, onPairingCode],
      [WA_EVENTS.connected, onConnected],
      [WA_EVENTS.disconnected, onDisconnected],
      [WA_EVENTS.loggedOut, onLoggedOut],
      [WA_EVENTS.authFailed, onNotice],
      [WA_EVENTS.error, onNotice],
      [WA_EVENTS.accountUpdated, onAccountUpdated],
      [WA_EVENTS.accountRemoved, onAccountRemoved],
      ["connect", onConnect],
      ["disconnect", onDisconnect],
    ];
    for (const [event, handler] of subscriptions) socket.on(event, handler);

    // Remove exactly what was added, so strict-mode remounts never stack listeners.
    return () => {
      for (const [event, handler] of subscriptions) socket.off(event, handler);
    };
  }, [qc]);

  return connected;
}

// ---- mutations ---------------------------------------------------------------

/**
 * Mutations never write status themselves. They clear the old notice, call the API, then
 * refetch; the `await` keeps `isPending` true until the server's answer is in the cache,
 * so the UI cannot flash back to an idle screen between the click and the first event.
 * `accountId` is where notices land (the account on screen).
 */
function useSessionMutation(accountId, call) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: call,
    onMutate: () => setNotice(qc, accountId, undefined),
    onSuccess: async (result) => {
      // A start call may have created an account: refresh the list first, then show it.
      await qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      if (result?.sessionId) setSelectedAccountId(result.sessionId);
      await qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (err) => {
      setNotice(qc, accountId, toNotice(err));
      return qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });
}

// ---- composite ---------------------------------------------------------------

export function useWhatsApp() {
  const qc = useQueryClient();
  const socketConnected = useWhatsAppRealtime();
  const accountsQuery = useWhatsAppAccounts();
  const activeId = useActiveAccountId();
  const [adding, setAdding] = useState(false);

  // While adding, the screen shows a blank "not connected" state for the new account, not the current one.
  const shownId = adding ? undefined : activeId;
  // Wait for the accounts list so the first fetch asks for the right account.
  const query = useWhatsAppStatus(
    shownId,
    socketConnected,
    !adding && !accountsQuery.isLoading,
  );

  const start = (options = {}) => ({
    accountId: adding ? undefined : activeId,
    newAccount: adding || undefined,
    ...options,
  });
  const createSession = useSessionMutation(shownId, (v) =>
    whatsappApi.createSession(start({ label: v?.label })),
  );
  const pairing = useSessionMutation(shownId, (v) =>
    whatsappApi.requestPairingCode(v.phoneNumber, start({ label: v.label })),
  );
  const reconnect = useSessionMutation(shownId, () =>
    whatsappApi.reconnect(activeId),
  );
  const disconnect = useSessionMutation(shownId, () =>
    whatsappApi.disconnect(activeId),
  );
  const logout = useSessionMutation(shownId, () =>
    whatsappApi.logout(activeId),
  );

  const rename = useMutation({
    mutationFn: (v) => whatsappApi.renameAccount(v.accountId, v.label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  const remove = useMutation({
    mutationFn: (accountId) => whatsappApi.removeAccount(accountId),
    onSuccess: async (_r, accountId) => {
      qc.removeQueries({ queryKey: statusKey(accountId) });
      await qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });

  const status = adding
    ? (qc.getQueryData(statusKey(undefined)) ?? EMPTY_STATUS)
    : (query.data ?? EMPTY_STATUS);
  const notice = status.notice;
  const accounts = accountsQuery.data?.accounts ?? [];
  const maxAccounts = accountsQuery.data?.max ?? 1;

  const finishAdding = { onSuccess: () => setAdding(false) };

  return {
    status,
    isLoading: adding ? false : query.isLoading || accountsQuery.isLoading,
    loadError: query.isError ? query.error : null,
    refetch: query.refetch,
    socketConnected,

    notice,
    /** The last QR or pairing code ran out before the user linked the device. */
    expired: notice ? EXPIRED_CODES.has(notice.code) : false,
    dismissNotice: () => setNotice(qc, shownId, undefined),

    /** A request the user just made is still being answered. */
    starting:
      createSession.isPending || pairing.isPending || reconnect.isPending,
    stopping: disconnect.isPending || logout.isPending,

    startQr: (label) => createSession.mutate({ label }, finishAdding),
    startPairing: (phoneNumber, label) =>
      pairing.mutate({ phoneNumber, label }, finishAdding),
    reconnect: () => reconnect.mutate(),
    disconnect: () => disconnect.mutate(),
    logout: () => logout.mutate(),

    // ---- accounts
    accounts,
    maxAccounts,
    canAddAccount: accounts.length > 0 && accounts.length < maxAccounts,
    activeAccountId: activeId,
    /** True while the user is linking an additional account. */
    adding,
    startAdding: () => {
      setNotice(qc, undefined, undefined);
      setAdding(true);
    },
    cancelAdding: () => setAdding(false),
    selectAccount: (id) => {
      setAdding(false);
      setSelectedAccountId(id);
    },
    renameAccount: rename.mutateAsync,
    renaming: rename.isPending,
    removeAccount: remove.mutateAsync,
    removing: remove.isPending,
  };
}
