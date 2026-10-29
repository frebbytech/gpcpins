import { lazy, Suspense, useEffect, useMemo } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { useCustomContext } from "../../context/providers/CustomProvider";
import { useAuth } from "../../context/providers/AuthProvider";
import { globalAlertType } from "../../components/alert/alertType";

import Layout from "./Layout";
import PayLoading from "../../components/PayLoading";
import GlobalAlert from "../../components/alert/GlobalAlert";
import FullPageSkeleton from "@/components/skeletons/FullPageSkeleton";
import Agents from "../airtime/agent";
import ViewAgents from "../airtime/agent/ViewAgents";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";

/* ------------------------------------------------------------------ *
 * Lazy-loaded route components, grouped by feature area.
 * Everything that only renders when its route is visited is lazy —
 * only Layout / PayLoading / GlobalAlert (needed immediately, or used
 * as the fallback UI itself) are imported eagerly.
 * ------------------------------------------------------------------ */

// Auth
import User from "./User";
import Login from "../Login";
import VerifyOTP from "../VerifyOTP";
import VerifyEmployee from "../workers/VerifyEmployee";
import EmployeePassword from "../workers/EmployeePassword";
import ForgotPassword from "../ForgotPassword";
import ForgotPasswordLink from "../ForgotPasswordLink";
import EmployeeDashboard from "../dashboard/EmployeeDashboard";

// Messages
const MessageHome = lazy(() => import("../messages/MessageHome"));

// Electricity
const Electricity = lazy(() => import("../electricity"));
const PrepaidTransactions = lazy(
  () => import("../electricity/PrepaidTransactions"),
);
const PrepaidTransactionDetails = lazy(
  () => import("../electricity/PrepaidTransactionDetails"),
);
const Meters = lazy(() => import("../electricity/Meters"));

// Airtime
const Airtime = lazy(() => import("../airtime"));
const BulkAirtimeTransaction = lazy(
  () => import("../airtime/BulkAirtimeTransaction"),
);

const AgentDetails = lazy(() => import("../airtime/agent/AgentDetails"));

// Employees / Users
const Worker = lazy(() => import("../workers"));
const ViewEmployees = lazy(() => import("../workers/ViewEmployees"));
const ViewEmployee = lazy(() => import("../workers/ViewEmployee"));
const EmployeeRoles = lazy(() => import("../workers/EmployeeRoles"));
const UserHome = lazy(() => import("../users"));
const UserDetails = lazy(() => import("../users/UserDetails"));
const ViewUser = lazy(() => import("../users/ViewUser"));

// Wallet
const Wallet = lazy(() => import("../wallet"));
const UsersWallet = lazy(() => import("../wallet/UsersWallet"));
const AgentsWallet = lazy(() => import("../wallet/AgentsWallet"));
const UsersWalletTransactions = lazy(
  () => import("../wallet/UsersWalletTransactions"),
);
const AgentsWalletTransactions = lazy(
  () => import("../wallet/AgentsWalletTransactions"),
);

// Summary
const Summary = lazy(() => import("../summary"));
const Overall = lazy(() => import("../summary/Overall"));
const Products = lazy(() => import("../summary/Products"));
const Electric = lazy(() => import("../summary/Electric"));
const SummaryAirtime = lazy(() => import("../summary/Airtime"));
const Bundle = lazy(() => import("../summary/Bundle"));
const Transactions = lazy(() => import("../summary/Transactions"));
const Report = lazy(() => import("../summary/Report"));
const AgentTransaction = lazy(() => import("../summary/agentSummary"));

// Transactions / Refund / Profile
const Transaction = lazy(() => import("../transactions"));
const RefundMoney = lazy(() => import("../refund/RefundMoney"));
const RefundDetails = lazy(() => import("../refund/RefundDetails"));
const Profile = lazy(() => import("../profile"));
const Personal = lazy(() => import("../profile/Personal"));
const Updates = lazy(() => import("../profile/Updates"));

// Vouchers / tickets
const EVoucher = lazy(() => import("../evoucher/EVoucher"));
const CategoryDetails = lazy(
  () => import("../../components/tabs/CategoryDetails"),
);
const Voucher = lazy(() => import("../evoucher/add/Voucher"));
const PinsGenerator = lazy(() => import("../evoucher/PinsGenerator"));

// Misc
const Notification = lazy(() => import("../notifications"));
const Settings = lazy(() => import("../settings"));
const Logs = lazy(() => import("../logs"));
const VerifyTicket = lazy(() => import("../VerifyTicket"));
const Complaints = lazy(() => import("../complaints"));
const AdminComplaints = lazy(() => import("../complaints/AdminComplaints"));
const ComplaintDetail = lazy(() => import("../complaints/ComplaintDetail"));
const RolesList = lazy(() => import("../roles/RolesList"));
const NotFound = lazy(() => import("../NotFound"));

// Category management overlays (WAEC, University, Security, Cinema, Stadium, Bus)
const AddWAECCategory = lazy(() => import("../waec/AddWAECCategory"));
const EditWAECCategory = lazy(() => import("../waec/EditWAECCategory"));
const AddUniversityCategory = lazy(
  () => import("../university/AddUniversityCategory"),
);
const EditUniversityCategory = lazy(
  () => import("../university/EditUniversityCategory"),
);
const AddCinemaCategory = lazy(() => import("../cinema/AddCinemaCategory"));
const EditCinemaCategory = lazy(() => import("../cinema/EditCinemaCategory"));
const AddStadiumCategory = lazy(() => import("../stadium/AddStadiumCategory"));
const EditStadiumCategory = lazy(
  () => import("../stadium/EditStadiumCategory"),
);
const AddBusCategory = lazy(() => import("../bus/AddBusCategory"));
const EditBusCategory = lazy(() => import("../bus/EditBusCategory"));
const AddSecurityCategory = lazy(
  () => import("../security/AddSecurityCategory"),
);
const EditSecurityCategory = lazy(
  () => import("../security/EditSecurityCategory"),
);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Wraps a lazy route component with its Suspense boundary so route
 *  definitions below stay one line instead of five. */
const withSuspense = (Component, Fallback = FullPageSkeleton) => (
  <Suspense fallback={<Fallback />}>
    <Component />
  </Suspense>
);

/** Permission-gated overlays that render alongside the router rather
 *  than at a specific path. Config-driven instead of ~80 lines of
 *  repeated `{cond && <Suspense>...}` blocks — add a category by
 *  adding a row here. */
const CATEGORY_OVERLAYS = [
  { permission: "Create new checkers", Component: AddWAECCategory },
  { permission: "Edit checkers", Component: EditWAECCategory },
  { permission: "Create new forms", Component: AddUniversityCategory },
  { permission: "Edit forms", Component: EditUniversityCategory },
  {
    permission: "Create security service forms",
    Component: AddSecurityCategory,
  },
  {
    permission: "Edit security service forms",
    Component: EditSecurityCategory,
  },
  { permission: "Create cinema tickets", Component: AddCinemaCategory },
  { permission: "Edit cinema tickets", Component: EditCinemaCategory },
  { permission: "Create stadium tickets", Component: AddStadiumCategory },
  { permission: "Edit stadium tickets", Component: EditStadiumCategory },
  { permission: "Create bus tickets", Component: AddBusCategory },
  { permission: "Edit bus tickets", Component: EditBusCategory },
];

function Shell() {
  const { user } = useAuth();
  const { customState, customDispatch } = useCustomContext();

  // Stable permission checker — avoids repeating `user?.permissions?.includes(...)`
  // at every gate and re-derives only when `user` changes.
  const can = useMemo(() => {
    const permissions = user?.permissions ?? [];
    return (permission) => permissions.includes(permission);
  }, [user]);

  useEffect(() => {
    const handleOnline = () =>
      customDispatch(globalAlertType("success", "Connection Restored"));
    const handleOffline = () =>
      customDispatch(
        globalAlertType("error", "Internet Connection Lost! Try reconnecting."),
      );

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
          <Route index element={withSuspense(user?.role==='1011'?Overall:EmployeeDashboard,DashboardSkeleton)} />

          {/* Vouchers & Tickets */}
          {can("Vouchers & Tickets") && (
            <Route
              path="evoucher"
              element={withSuspense(EVoucher, FullPageSkeleton)}
            >
              {can("Generate Pins & Serials") && (
                <Route path="generate" element={withSuspense(PinsGenerator)} />
              )}
              <Route path=":category" element={withSuspense(Voucher,FullPageSkeleton)} />
              <Route
                path=":category/:id"
                element={withSuspense(CategoryDetails,FullPageSkeleton)}
              />
            </Route>
          )}

          {/* Electricity */}
          {can("Prepaid Units") && (
            <Route path="electricity" element={withSuspense(Electricity)}>
              {can("View Meters") && (
                <Route path="meters" element={withSuspense(Meters)} />
              )}
              {can("View Prepaid Transaction") && (
                <>
                  <Route
                    path="transactions"
                    element={withSuspense(PrepaidTransactions)}
                  />
                  <Route
                    path=":id"
                    element={withSuspense(PrepaidTransactionDetails)}
                  />
                </>
              )}
            </Route>
          )}

          {/* Airtime */}
          {can("Airtime") && (
            <Route path="airtime" element={withSuspense(Airtime)}>
              {can("View Bulk Airtime Transaction") && (
                <Route
                  path="transactions"
                  element={withSuspense(BulkAirtimeTransaction)}
                />
              )}
            </Route>
          )}

          {/* Employees */}
          {can("Employees") && (
            <Route path="employees" element={withSuspense(Worker)}>
              <Route index element={withSuspense(ViewEmployees)} />
              <Route path=":id" element={withSuspense(ViewEmployee)} />
              {can("Manage Roles & Permissions") && (
                <Route path="roles/:id" element={withSuspense(EmployeeRoles)} />
              )}
            </Route>
          )}

          {/* Users */}
          {can("Users") && (
            <Route path="users" element={withSuspense(UserHome)}>
              <Route index element={withSuspense(ViewUser)} />
              <Route path="details/:id" element={withSuspense(UserDetails)} />
            </Route>
          )}
          {can("Agents") && (
           <Route path="agents"  element={withSuspense(Agents)}>
              <Route index  element={withSuspense(ViewAgents)} />
              {/* <Route path="agent" element={withSuspense(Agent)} /> */}
              <Route
                path=":id"
                element={withSuspense(AgentDetails)}
              />
            </Route>
          )}

          {/* Wallets */}
          {(can("User Wallets") || can("Agent Wallets")) && (
            <Route path="wallets" element={withSuspense(Wallet)}>
              {can("User Wallets") && (
                <>
                  <Route index element={withSuspense(UsersWallet)} />
                  <Route
                    path="users/transactions"
                    element={withSuspense(UsersWalletTransactions)}
                  />
                </>
              )}
              {can("Agent Wallets") && (
                <>
                  <Route path="agent" element={withSuspense(AgentsWallet)} />
                  <Route
                    path="agents/transactions"
                    element={withSuspense(AgentsWalletTransactions)}
                  />
                </>
              )}
            </Route>
          )}

          {/* Messages */}
          {can("Messages") && (
            <Route path="messages" element={withSuspense(MessageHome)} />
          )}

          {/* Summary */}
          {can("Summary") && (
            <Route path="summary" element={withSuspense(Summary)}>
              <Route path="vouchers-tickets" element={withSuspense(Products)} />
              <Route path="prepaid-units" element={withSuspense(Electric)} />
              <Route path="airtime" element={withSuspense(SummaryAirtime)} />
              <Route path="data-bundle" element={withSuspense(Bundle)} />
              <Route
                path="agent-transactions"
                element={withSuspense(AgentTransaction)}
              />
              <Route path="transactions" element={withSuspense(Transactions)} />
              <Route path="report" element={withSuspense(Report)} />
            </Route>
          )}

          <Route path="transactions" element={withSuspense(Transaction)} />

          {/* Refund — plain Outlet, no lazy component at this level so no Suspense needed */}
          <Route path="refund" element={<Outlet />}>
            <Route index element={withSuspense(RefundDetails)} />
            <Route path="money" element={withSuspense(RefundMoney)} />
          </Route>

          <Route path="profile" element={withSuspense(Profile)}>
            <Route index element={withSuspense(Personal)} />
            <Route path="updates/:field" element={withSuspense(Updates)} />
          </Route>

          <Route path="notifications" element={withSuspense(Notification)} />

          {can("Settings") && (
            <Route path="settings" element={withSuspense(Settings)} />
          )}

          <Route path="verify" element={withSuspense(VerifyTicket)} />

          <Route path="help-and-support" element={withSuspense(Complaints)}>
            <Route index element={withSuspense(AdminComplaints)} />
            <Route path=":id" element={withSuspense(ComplaintDetail)} />
          </Route>

          <Route path="logs" element={withSuspense(Logs)} />
          <Route path="roles" element={withSuspense(RolesList)} />
   
        </Route>

        <Route path="auth" element={<User/>}>
          <Route path="login" element={<Login/>} />
          <Route path="code" element={<VerifyOTP/>} />
          <Route path="verify" element={<VerifyEmployee/>} />
          <Route path="confirm" element={<EmployeePassword/>} />
          <Route path="forgot" element={<ForgotPassword/>} />
          <Route path="link" element={<ForgotPasswordLink/>} />
        </Route>

        <Route path="*" element={<NotFound/>} />
      </Routes>

      {customState?.alertData.message && <GlobalAlert />}

      {CATEGORY_OVERLAYS.map(({ permission, Component }) =>
        can(permission) ? (
          <Suspense fallback={<PayLoading />} key={permission}>
            <Component />
          </Suspense>
        ) : null,
      )}
    </>
  );
}

export default Shell;
