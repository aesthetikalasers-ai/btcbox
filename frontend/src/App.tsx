import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { I18nProvider } from "./lib/i18n";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })));
const TradeHubPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.TradeHubPage })));
const AssetsPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.AssetsPage })));
const MyPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.MyPage })));
const SectionPage = lazy(() => import("./features/pages/Pages").then((m) => ({ default: m.SectionPage })));
const OrdersPage = lazy(() => import("./features/orders/OrdersPage").then((m) => ({ default: m.OrdersPage })));

function RouteLoading() {
  return <div className="mx-auto flex min-h-[240px] w-full max-w-[1200px] items-center justify-center p-6" role="status" aria-live="polite"><div className="flex items-center gap-3 text-sm text-brand-text-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-brand-accent" />Loading BTCBOX…</div></div>;
}

export default function App() {
  return <I18nProvider><AppLayout><Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/home" element={<Dashboard />} /><Route path="/markets" element={<Dashboard />} />
    <Route path="/trade-hub" element={<TradeHubPage />} /><Route path="/trade" element={<Navigate to="/trade-hub" replace />} />
    <Route path="/trade/:symbol" element={<SectionPage title="Spot trading" description="The BTCBOX order-entry interface will connect to the existing spot order API after its request and response contract is verified." />} />
    <Route path="/seconds" element={<SectionPage title="Seconds trading" description="The existing seconds-order and position APIs will be connected here after the interaction and settlement states are mapped." />} />
    <Route path="/assets" element={<AssetsPage />} /><Route path="/me" element={<MyPage />} />
    <Route path="/orders" element={<OrdersPage />} />
    <Route path="/deposit" element={<SectionPage title="Deposit" description="Deposit address selection and pending-deposit workflow are not connected in this frontend preview." />} />
    <Route path="/withdraw" element={<SectionPage title="Withdraw" description="Withdrawal review and confirmation will use the existing backend contract; no transaction can be submitted from this preview." />} />
    <Route path="/earn" element={<SectionPage title="Earn" description="Earn products and redemption actions will be connected to the existing backend after API contract verification." />} />
    <Route path="/login" element={<SectionPage title="Sign in" description="Authentication UI is the next integration phase. No credentials are collected by this preview." />} />
    <Route path="/register" element={<SectionPage title="Create account" description="Registration will connect to the configured Supabase authentication flow in the next integration phase." />} />
    <Route path="/kyc" element={<SectionPage title="Verification" description="Identity verification status and submission will be connected to the existing account API." />} />
    <Route path="/support" element={<SectionPage title="Support" description="Support conversations will be connected to the authenticated support API." />} />
    <Route path="/settings" element={<SectionPage title="Settings" description="Security and account settings will be connected after the existing settings API contract is verified." />} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></Suspense></AppLayout></I18nProvider>;
}
