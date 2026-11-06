import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { I18nProvider } from "./lib/i18n";
import { AuthCallbackPage, AuthPage } from "./features/auth/AuthPages";
import { AccountSetupPage } from "./features/auth/AccountSetupPage";
import { AccountSecurityPage } from "./features/account/AccountSecurityPage";
import { useAuth } from "./lib/auth";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })));
const AdminPage = lazy(() => import("./features/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const TradeHubPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.TradeHubPage })));
const AssetsPage = lazy(() => import("./features/assets/AssetsPage").then((m) => ({ default: m.AssetsPage })));
const MyPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.MyPage })));
const SectionPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.SectionPage })));
const OrdersPage = lazy(() => import("./features/orders/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const SecondsPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.SecondsPage })));
const KycPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.KycPage })));
const SupportPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.SupportPage })));
const DepositPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.DepositPage })));
const WithdrawPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.WithdrawPage })));
const EarnPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.EarnPage })));

function ProtectedAccountRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <RouteLoading />;
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  return <>{children}</>;
}
function AccountSetupGate({ children }: { children: ReactNode }) {
  const { status, needsCredentials } = useAuth();
  const location = useLocation();
  if (status === "authenticated" && needsCredentials && location.pathname !== "/account-setup") {
    return <Navigate to="/account-setup" replace />;
  }
  return <>{children}</>;
}
function RouteLoading() {
  return <div className="mx-auto flex min-h-[240px] w-full max-w-[1200px] items-center justify-center p-6" role="status" aria-live="polite"><div className="flex items-center gap-3 text-sm text-brand-text-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-brand-accent" />Loading BTCBOX…</div></div>;
}
function CustomerRoutes() {
  return <AppLayout><AccountSetupGate><Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/home" element={<Dashboard />} /><Route path="/markets" element={<Dashboard />} />
    <Route path="/trade-hub" element={<TradeHubPage />} /><Route path="/trade" element={<Navigate to="/trade-hub" replace />} />
    <Route path="/trade/:symbol" element={<SectionPage title="Spot trading" description="The BTCBOX order-entry interface will connect to the existing spot order API after its request and response contract is verified." />} />
    <Route path="/seconds" element={<ProtectedAccountRoute><SecondsPage /></ProtectedAccountRoute>} />
    <Route path="/assets" element={<ProtectedAccountRoute><AssetsPage /></ProtectedAccountRoute>} /><Route path="/me" element={<MyPage />} />
    <Route path="/orders" element={<ProtectedAccountRoute><OrdersPage /></ProtectedAccountRoute>} />
    <Route path="/deposit" element={<ProtectedAccountRoute><DepositPage /></ProtectedAccountRoute>} />
    <Route path="/withdraw" element={<ProtectedAccountRoute><WithdrawPage /></ProtectedAccountRoute>} />
    <Route path="/earn" element={<ProtectedAccountRoute><EarnPage /></ProtectedAccountRoute>} />
    <Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/account-setup" element={<AccountSetupPage />} /><Route path="/auth/react-callback" element={<AuthCallbackPage />} />
    <Route path="/kyc" element={<ProtectedAccountRoute><KycPage /></ProtectedAccountRoute>} />
    <Route path="/support" element={<ProtectedAccountRoute><SupportPage /></ProtectedAccountRoute>} />
    <Route path="/settings" element={<ProtectedAccountRoute><AccountSecurityPage /></ProtectedAccountRoute>} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></Suspense></AccountSetupGate></AppLayout>;
}
export default function App() {
  return <I18nProvider><Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/*" element={<CustomerRoutes />} />
  </Routes></Suspense></I18nProvider>;
}
