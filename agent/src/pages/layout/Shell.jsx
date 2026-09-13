import { lazy, Suspense, useContext, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { CustomContext } from "../../context/providers/CustomProvider";

import Layout from "./Layout";
import PayLoading from "../../components/PayLoading";
import GlobalAlert from "../../components/alert/GlobalAlert";
import EmailSent from "../EmailSent";
import User from "./User";

import Login from "../Login";
import MessageHome from "../messages/MessageHome";
import VerifyAgent from "../VerifyAgent";

const Summary = lazy(() => import("../summary"));
const Profile = lazy(() => import("../profile"));
const Updates = lazy(() => import("../profile/Updates"));
const Personal = lazy(() => import("../profile/Personal"));
const Notification = lazy(() => import("../notifications"));
const Logs = lazy(() => import("../logs"));
const Transaction = lazy(() => import("../transactions"));
import VerifyAgentPassword from "../VerifyAgentPassword";

import Business from "../profile/Business";
import Wallet from "../wallet";
import { globalAlertType } from "../../components/alert/alertType";
import PaymentStatus from "../PaymentStatus";
import PaymentSuccess from "../payment/PaymentSuccess";

//Airtime
const Airtime = lazy(() => import("../airtime"));
const AirtimeTransaction = lazy(() => import("../airtime/AirtimeTransaction"));

// bundle
const Bundle = lazy(() => import("../bundle"));
const BundleTransaction = lazy(() => import("../bundle/BundleTransaction"));

const Overall = lazy(() => import("../summary/Overall"));
const NotFound = lazy(() => import("../NotFound"));

function Shell() {
  const {
    customState: { alertData },
    customDispatch,
  } = useContext(CustomContext);

  useEffect(() => {
    const handleOnline = () => {
      customDispatch(globalAlertType("info", "Connection Restored"));
    };

    const handleOffline = () => {
      customDispatch(
        globalAlertType("error", "Internet Connection Lost! Try reconnecting."),
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [customDispatch]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={
              <Suspense fallback={<PayLoading />}>
                <Overall />
              </Suspense>
            }
          />

          {/* airtime */}

          <Route
            path="/airtime"
            element={
              <Suspense fallback={<PayLoading />}>
                <Airtime />
              </Suspense>
            }
          >
            <Route
              path="transactions"
              element={
                <Suspense fallback={<PayLoading />}>
                  <AirtimeTransaction />
                </Suspense>
              }
            />
          </Route>

          {/* bundle */}
          <Route
            path="/bundle"
            element={
              <Suspense fallback={<PayLoading />}>
                <Bundle />
              </Suspense>
            }
          >
            <Route
              path="transactions"
              element={
                <Suspense fallback={<PayLoading />}>
                  <BundleTransaction />
                </Suspense>
              }
            />
          </Route>

          <Route
            path="messages"
            element={
              <Suspense fallback={<PayLoading />}>
                <MessageHome />
              </Suspense>
            }
          />

          <Route
            path="summary"
            element={
              <Suspense fallback={<PayLoading />}>
                <Summary />
              </Suspense>
            }
          />

          <Route
            path="transactions"
            element={
              <Suspense fallback={<PayLoading />}>
                <Transaction />
              </Suspense>
            }
          />

          <Route
            path="profile"
            element={
              <Suspense fallback={<PayLoading />}>
                <Profile />
              </Suspense>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<PayLoading />}>
                  <Personal />
                </Suspense>
              }
            />
            <Route
              path="business"
              element={
                <Suspense fallback={<PayLoading />}>
                  <Business />
                </Suspense>
              }
            />

            {/* <Route
              path="notifications"
              element={
                <Suspense fallback={<PayLoading />}>
                  <Notifications />
                </Suspense>
              }
            /> */}

            <Route
              path="updates/:field"
              element={
                <Suspense fallback={<PayLoading />}>
                  <Updates />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="notifications"
            element={
              <Suspense fallback={<PayLoading />}>
                <Notification />
              </Suspense>
            }
          />
          <Route
            path="wallet"
            element={
              <Suspense fallback={<PayLoading />}>
                <Wallet />
              </Suspense>
            }
          />
          <Route
            path="logs"
            element={
              <Suspense fallback={<PayLoading />}>
                <Logs />
              </Suspense>
            }
          />

          <Route
            path="confirm"
            element={
              <Suspense fallback={<PayLoading />}>
                <PaymentStatus />
              </Suspense>
            }
          />

          <Route
            path="payment/success"
            element={
              <Suspense fallback={<PayLoading />}>
                <PaymentSuccess />
              </Suspense>
            }
          />
        </Route>

        <Route path="auth" element={<User />}>
          <Route path="login" element={<Login />} />
          <Route path="code" element={<EmailSent />} />
          <Route path="verify" element={<VerifyAgent />} />
          <Route path="confirm" element={<VerifyAgentPassword />} />
        </Route>

        <Route
          path="*"
          element={
            <Suspense fallback={<PayLoading />}>
              <NotFound />
            </Suspense>
          }
        />
      </Routes>

      {alertData.message && <GlobalAlert />}
    </>
  );
}

export default Shell;
