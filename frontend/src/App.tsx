import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./features/dashboard/Dashboard";
import { AssetsPage, MyPage, SectionPage, TradeHubPage } from "./features/pages/Pages";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/home" element={<Dashboard />} />
        <Route path="/markets" element={<Dashboard />} />
        <Route path="/trade-hub" element={<TradeHubPage />} />
        <Route path="/trade" element={<Navigate to="/trade-hub" replace />} />
        <Route path="/trade/:symbol" element={<SectionPage title="Spot trading" description="The BTCBOX order-entry interface will connect to the existing spot order API after its request and response contract is verified." />} />
        <Route path="/seconds" element={<SectionPage title="Seconds trading" description="The existing seconds-order and position APIs will be connected here after the interaction and settlement states are mapped." />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/me" element={<MyPage />} />
        <Route path="/orders" element={<SectionPage title="Orders" description="Order history will load from the authenticated BTCBOX account API. No sample order records are displayed." />} />
        <Route path="/deposit" element={<SectionPage title="Deposit" description="Deposit address selection and pending-deposit workflow are not connected in this frontend preview." />} />
        <Route path="/withdraw" element={<SectionPage title="Withdraw" description="Withdrawal review and confirmation will use the existing backend contract; no transaction can be submitted from this preview." />} />
        <Route path="/earn" element={<SectionPage title="Earn" description="Earn products and redemption actions will be connected to the existing backend after API contract verification." />} />
        <Route path="/login" element={<SectionPage title="Sign in" description="Authentication UI is the next integration phase. No credentials are collected by this preview." />} />
        <Route path="/register" element={<SectionPage title="Create account" description="Registration will connect to the configured Supabase authentication flow in the next integration phase." />} />
        <Route path="/kyc" element={<SectionPage title="Verification" description="Identity verification status and submission will be connected to the existing account API." />} />
        <Route path="/support" element={<SectionPage title="Support" description="Support conversations will be connected to the authenticated support API." />} />
        <Route path="/settings" element={<SectionPage title="Settings" description="Security and account settings will be connected after the existing settings API contract is verified." />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AppLayout>
  );
}
