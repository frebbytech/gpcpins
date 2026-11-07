import { useQuery } from "@tanstack/react-query";
import { useSelectedAccountId } from "../lib/account-store";
import { whatsappApi } from "../lib/api";

export const ACCOUNTS_KEY = ["whatsapp", "accounts"];

/** The user's accounts, oldest first. Socket events invalidate this; REST is the truth. */
export function useWhatsAppAccounts() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: () => whatsappApi.listAccounts(),
    staleTime: 30_000,
    retry: (count, err) => err.status !== 401 && err.status !== 429 && count < 2,
  });
}

/**
 * The account every call should use: the one the user picked if it still exists, otherwise the
 * oldest. `undefined` while loading or when there is no account yet (the service then defaults).
 */
export function useActiveAccountId() {
  const picked = useSelectedAccountId();
  const { data } = useWhatsAppAccounts();
  const accounts = data?.accounts ?? [];
  if (picked && accounts.some((a) => a.sessionId === picked)) return picked;
  return accounts[0]?.sessionId;
}
