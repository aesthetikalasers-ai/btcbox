import { Navigate } from "react-router-dom";

/**
 * Legacy prototype route. The previous screen showed a hard-coded balance and
 * local button state without submitting an exchange order. Redirect to the real
 * spot terminal so no visitor can mistake prototype controls for live trading.
 */
export default function ProfessionalMobileTradeTerminal() {
  return <Navigate to="/trade/BTCUSDT" replace />;
}
