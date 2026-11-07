import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { configureWhatsApp } from "./lib/config";
import { createTokenFetcher } from "./lib/token";
import { disconnectSocket } from "./lib/socket";

/**
 * Configures the WhatsApp module and gives it its own TanStack Query client, so it works
 * even if your app has no QueryClientProvider (or has one from a different major version).
 *
 * @param {Object} props
 * @param {string} [props.serviceUrl]  WhatsApp service base URL. Default: VITE_WHATSAPP_SERVICE_URL.
 * @param {() => Promise<string | { token: string, expiresIn?: number }>} [props.getToken]
 *        Returns a short-lived service token for the signed-in user. Default: POST to `tokenUrl`.
 * @param {string} [props.tokenUrl]    Your backend's token route. Default: "/api/whatsapp/token".
 * @param {RequestCredentials} [props.tokenCredentials]  Default: "include" (sends your session cookie).
 * @param {() => Record<string,string> | Promise<Record<string,string>>} [props.getTokenHeaders]
 *        Extra headers for the token request, e.g. your app's own `Authorization: Bearer ...`.
 * @param {QueryClient} [props.queryClient]  Reuse an existing TanStack Query v5 client instead.
 */
export function WhatsAppProvider({
  children,
  serviceUrl = import.meta.env?.VITE_WHATSAPP_SERVICE_URL,
  getToken,
  tokenUrl,
  tokenCredentials,
  getTokenHeaders,
  queryClient,
}) {
  const [ownClient] = useState(() => queryClient ?? new QueryClient());

  // Configure during the first render so children's first fetch already has its settings.
  useState(() => {
    configureWhatsApp({
      serviceUrl,
      getToken: getToken ?? createTokenFetcher({ url: tokenUrl, credentials: tokenCredentials, getHeaders: getTokenHeaders }),
    });
  });

  // Keep the settings current if the props change later (e.g. a refreshed auth header).
  useEffect(() => {
    configureWhatsApp({
      serviceUrl,
      getToken: getToken ?? createTokenFetcher({ url: tokenUrl, credentials: tokenCredentials, getHeaders: getTokenHeaders }),
    });
  }, [serviceUrl, getToken, tokenUrl, tokenCredentials, getTokenHeaders]);

  // Leaving the module (e.g. the user signs out) must not leave their socket open.
  useEffect(() => () => disconnectSocket(), []);

  return <QueryClientProvider client={ownClient}>{children}</QueryClientProvider>;
}
