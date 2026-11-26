import { AuthRestoreState } from "./components/AuthRestoreState";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { I18nProvider } from "./lib/i18n";
import { AuthCallbackPage, AuthPage } from "./features/auth/AuthPages";
import { AccountSecurityPage } from "./features/account/AccountSecurityPage";
import { useAuth } from "./lib/auth";
import { useI18n } from "./lib/i18n";
import { Button } from "./components/ui/button";
import { LockKeyhole } from "lucide-react";
import { AccountNoticeModal } from "./components/AccountNoticeModal";
import { AuthDialogProvider, useAuthDialog } from "./lib/auth-dialog";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })));
const MarketsPage = lazy(() => import("./features/markets/MarketsPage").then((m) => ({ default: m.MarketsPage })));
const AdminPage = lazy(() => import("./features/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const TradeHubPage = lazy(() => import("./features/pages/TradeHubPage").then((m) => ({ default: m.TradeHubPage })));
const AssetsPage = lazy(() => import("./features/assets/AssetsPage").then((m) => ({ default: m.AssetsPage })));
const FundsPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.FundsPage })));
const MyPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.MyPage })));
const SpotTradingPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.SpotTradingPage })));
const OrdersPage = lazy(() => import("./features/orders/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const SecondsPage = lazy(() => import("./features/pages/SecondsPage").then((m) => ({ default: m.SecondsPage })));
const KycPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.KycPage })));
const SupportPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.SupportPage })));
const DepositPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.DepositPage })));
const WithdrawPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.WithdrawPage })));
const InternalConversionPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.InternalConversionPage })));
const AddressBookPage = lazy(() => import("./features/pages/AddressBookPage").then((m) => ({ default: m.AddressBookPage })));
const FundPasswordPage = lazy(() => import("./features/account/FundPasswordPage").then((m) => ({ default: m.FundPasswordPage })));
const EarnPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.EarnPage })));
const ContractPage = lazy(() => import("./features/pages/ContractPage").then((m) => ({ default: m.ContractPage })));
const MobileTradeTerminal = lazy(() => import("./features/trade/ProfessionalMobileTradeTerminal"));
const KlineChartPage = lazy(() => import("./features/pages/KlineChartPage").then((m) => ({ default: m.KlineChartPage })));
const NotFoundPage = lazy(() => import("./features/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const TrustCenterPage = lazy(() => import("./features/trust/TrustCenterPage").then((m) => ({ default: m.TrustCenterPage })));
const TransparencyPage = lazy(() => import("./features/trust/TransparencyPage").then((m) => ({ default: m.TransparencyPage })));
const FeesPage = lazy(() => import("./features/trust/FeesPage").then((m) => ({ default: m.FeesPage })));
const RulesPage = lazy(() => import("./features/trust/RulesPage").then((m) => ({ default: m.RulesPage })));
const RiskPage = lazy(() => import("./features/trust/RiskPage").then((m) => ({ default: m.RiskPage })));
const SecurityPage = lazy(() => import("./features/trust/SecurityPage").then((m) => ({ default: m.SecurityPage })));
const RewardsPage = lazy(() => import("./features/pages/RewardsPage").then((m) => ({ default: m.RewardsPage })));
const NewListingsPage = lazy(() => import("./features/pages/NewListingsPage").then((m) => ({ default: m.NewListingsPage })));

// Trade entry opens the spot terminal directly on BTC/USDT without any backend
// round-trip, so users always land on a live trading page.
function TradeRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/trade/BTCUSDT", { replace: true });
  }, [navigate]);
  return <RouteLoading />;
}

// Account-only surfaces (balances, orders, scripts with real funds, security
// settings) require a restored session. Instead of a hard redirect, we render a
// friendly sign-in prompt so a first-time visitor understands why they are
// seeing a locked screen and can sign in / register in place.
function SignInPrompt() {
  const { t } = useI18n();
  const { openAuthDialog } = useAuthDialog();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
        <LockKeyhole className="h-8 w-8" />
      </span>
      <h2 className="text-xl font-semibold text-brand-text">{t("Sign in to your account")}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-brand-text-muted">{t("Sign in to view balances, orders, and security settings.")}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={() => openAuthDialog("login")} className="min-h-12 px-6 text-sm font-bold">{t("Sign in")}</Button>
        <Button type="button" variant="secondary" onClick={() => openAuthDialog("register")} className="min-h-12 px-6 text-sm font-bold">{t("Create account")}</Button>
      </div>
    </div>
  );
}

function ProtectedAccountRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <AuthRestoreState />;
  // Local development preview: render the page even when not authenticated so the
  // UI/layout can be inspected without a real session. Server-side authorization
  // remains the source of truth (every account API still answers AUTH_REQUIRED,
  // and the page renders its own explicit sign-in prompt where data is gated).
  // This bypass is compiled out of production builds (import.meta.env.DEV is false).
  if (import.meta.env.DEV) return <>{children}</>;
  if (status !== "authenticated") return <SignInPrompt />;
  return <>{children}</>;
}

// Provider-authenticated users enter BTCBOX immediately. A BTCBOX username
// and a second local password are optional legacy credentials, not an onboarding gate.
function AccountSetupGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
function RouteLoading() {
  const { t } = useI18n();
  return <div className="mx-auto flex min-h-60 w-full max-w-[1200px] items-center justify-center p-6" role="status" aria-live="polite"><div className="flex items-center gap-3 text-sm text-brand-text-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-brand-accent" />{t("Loading…")}</div></div>;
}
function CustomerRoutes() {
  const location = useLocation();
  // React Router accepts trailing slashes for route matching; keep the shell
  // decision consistent so /login/ and /register/ remain standalone auth pages.
  const normalizedPathname = location.pathname.replace(/\/+$/, "") || "/";
  const isStandaloneAuthRoute = ["/login", "/register", "/auth/react-callback"].includes(normalizedPathname);
  const content = <div key={location.pathname} className="anim-fade-in min-w-0 flex-1"><AccountSetupGate><Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/home" element={<Dashboard />} /><Route path="/markets" element={<MarketsPage />} />
    <Route path="/trade-hub" element={<TradeHubPage />} /><Route path="/trade" element={<TradeRedirect />} />
    <Route path="/trade/:symbol" element={<SpotTradingPage />} />
    <Route path="/chart/:symbol" element={<KlineChartPage />} />
    <Route path="/seconds" element={<SecondsPage />} />
    <Route path="/assets" element={<ProtectedAccountRoute><AssetsPage /></ProtectedAccountRoute>} /><Route path="/funds" element={<ProtectedAccountRoute><FundsPage /></ProtectedAccountRoute>} /><Route path="/me" element={<MyPage />} />
    <Route path="/orders" element={<ProtectedAccountRoute><OrdersPage /></ProtectedAccountRoute>} />
    <Route path="/deposit" element={<ProtectedAccountRoute><DepositPage /></ProtectedAccountRoute>} />
    <Route path="/withdraw" element={<ProtectedAccountRoute><WithdrawPage /></ProtectedAccountRoute>} />
    <Route path="/convert" element={<ProtectedAccountRoute><InternalConversionPage /></ProtectedAccountRoute>} />
    <Route path="/address-book" element={<ProtectedAccountRoute><AddressBookPage /></ProtectedAccountRoute>} />
    <Route path="/fund-password" element={<ProtectedAccountRoute><FundPasswordPage /></ProtectedAccountRoute>} />
    <Route path="/earn" element={<EarnPage />} />
    <Route path="/contract" element={<ContractPage />} />
    <Route path="/mobile-terminal" element={<MobileTradeTerminal />} />
    <Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/account-setup" element={<Navigate to="/me" replace />} /><Route path="/auth/react-callback" element={<AuthCallbackPage />} />
    <Route path="/kyc" element={<ProtectedAccountRoute><KycPage /></ProtectedAccountRoute>} />
    <Route path="/support" element={<SupportPage />} />
    {/* Rewards shows only backend-reported values and an honest notice when the programme is not open. */}
    <Route path="/rewards" element={<RewardsPage />} />
    {/* New listings publishes the listed spot pairs and keeps Launchpad explicitly closed. */}
    <Route path="/new-listings" element={<NewListingsPage />} />
    {/* Trust pages are public reference material: no sign-in required. */}
    <Route path="/trust" element={<TrustCenterPage />} />
    <Route path="/transparency" element={<TransparencyPage />} />
    <Route path="/fees" element={<FeesPage />} />
    <Route path="/rules" element={<RulesPage />} />
    <Route path="/risk" element={<RiskPage />} />
    <Route path="/security" element={<SecurityPage />} />
    <Route path="/settings" element={<ProtectedAccountRoute><AccountSecurityPage /></ProtectedAccountRoute>} />
    <Route path="/" element={<Navigate to="/home" replace />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense></AccountSetupGate><AccountNoticeModal /></div>;
  return <AuthDialogProvider>{isStandaloneAuthRoute ? content : <AppLayout>{content}</AppLayout>}</AuthDialogProvider>;
}
export default function App() {
  const { pathname } = useLocation();
  // All admin sub-routes belong to the same Chinese-language admin application.
  const isAdminRoute = /^\/admin(?:\/|$)/i.test(pathname);
  return <I18nProvider fixedLanguage={isAdminRoute ? "zh-CN" : undefined}><Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/admin/*" element={<AdminPage />} />
    <Route path="/*" element={<CustomerRoutes />} />
  </Routes></Suspense></I18nProvider>;
}

