import { ArrowRight, ArrowUpRight, ArrowLeftRight, ChartNoAxesCombined, Headset, Wallet } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthRestoreState } from "./components/AuthRestoreState";
import { useAuth } from "./lib/auth";
import { I18nProvider, useI18n } from "./lib/i18n";
import { AppLayout } from "./components/layout/AppLayout";
import { AccountSecurityPage } from "./features/account/AccountSecurityPage";
import { AdminPage } from "./features/admin/AdminPage";
import { AssetsPage } from "./features/assets/AssetsPage";
import { AuthCallbackPage, AuthPage } from "./features/auth/AuthPages";
import { AccountSetupPage } from "./features/auth/AccountSetupPage";
import { OrdersPage } from "./features/orders/OrdersPage";
import { Dashboard } from "./features/dashboard/Dashboard";
import { MarketsPage } from "./features/markets/MarketsPage";
import { TradeHubPage, MyPage, SpotTradingPage, SecondsPage, KycPage, SupportPage, DepositPage, WithdrawPage, EarnPage } from "./features/pages/Pages";

function ProtectedAccountRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <AuthRestoreState />;
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
  const { t } = useI18n();
  return <div className="mx-auto flex min-h-[240px] w-full max-w-[1200px] items-center justify-center p-6" role="status" aria-live="polite"><div className="flex items-center gap-3 text-sm text-brand-text-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-brand-accent" />{t("Loading…")}</div></div>;
}
function CustomerRoutes() {
  const location = useLocation();
  const isStandaloneAuthRoute = ["/login", "/register", "/account-setup", "/auth/react-callback"].includes(location.pathname);
  const content = <div key={location.pathname} className="anim-fade-in min-w-0 flex-1"><AccountSetupGate><Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/home" element={<Dashboard />} /><Route path="/markets" element={<MarketsPage />} />
    <Route path="/trade-hub" element={<TradeHubPage />} /><Route path="/trade" element={<Navigate to="/trade-hub" replace />} />
    <Route path="/trade/:symbol" element={<SpotTradingPage />} />
    <Route path="/seconds" element={<ProtectedAccountRoute><SecondsPage /></ProtectedAccountRoute>} />
    <Route path="/assets" element={<ProtectedAccountRoute><AssetsPage /></ProtectedAccountRoute>} /><Route path="/me" element={<MyPage />} />
    <Route path="/orders" element={<ProtectedAccountRoute><OrdersPage /></ProtectedAccountRoute>} />
    <Route path="/deposit" element={<ProtectedAccountRoute><DepositPage /></ProtectedAccountRoute>} />
    <Route path="/withdraw" element={<ProtectedAccountRoute><WithdrawPage /></ProtectedAccountRoute>} />
    <Route path="/earn" element={<ProtectedAccountRoute><EarnPage /></ProtectedAccountRoute>} />
    <Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/account-setup" element={<AccountSetupPage />} /><Route path="/auth/react-callback" element={<AuthCallbackPage />} />
    <Route path="/kyc" element={<ProtectedAccountRoute><KycPage /></ProtectedAccountRoute>} />
    <Route path="/support" element={<SupportPage />} />
    <Route path="/settings" element={<ProtectedAccountRoute><AccountSecurityPage /></ProtectedAccountRoute>} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></Suspense></AccountSetupGate></div>;
  return isStandaloneAuthRoute ? content : <AppLayout>{content}</AppLayout>;
}
export default function App() {
  const { pathname } = useLocation();
  return <I18nProvider fixedLanguage={/^\/admin\/?$/i.test(pathname) ? "zh-CN" : undefined}><Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/*" element={<CustomerRoutes />} />
  </Routes></Suspense></I18nProvider>;
}
