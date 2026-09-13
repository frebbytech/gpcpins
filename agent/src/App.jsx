import {
  QueryClientProvider,
  QueryClient,
  useQueryErrorResetBoundary,
} from "@tanstack/react-query";
import { Chart, registerables } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import CustomProvider from "./context/providers/CustomProvider";
import ThemeProvider from "./theme";
import Shell from "./pages/layout/Shell";
import { ErrorBoundary } from "react-error-boundary";
import Error from "./pages/Error";
import { HelmetProvider } from "react-helmet-async";
import AuthProvider from "./context/providers/AuthProvider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { SocketProvider } from "./context/providers/SocketProvider";

Chart.register(...registerables);
Chart.register(ChartDataLabels);
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;

function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        networkMode: "always",
      },
      queries: {
        networkMode: "always",
      },
    },
  });

  const { reset } = useQueryErrorResetBoundary();

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <ThemeProvider>
              <ErrorBoundary FallbackComponent={Error} onReset={reset}>
                <GoogleOAuthProvider clientId={CLIENT_ID}>
                  <CustomProvider>
                    <Shell />
                  </CustomProvider>
                </GoogleOAuthProvider>
              </ErrorBoundary>
            </ThemeProvider>
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
