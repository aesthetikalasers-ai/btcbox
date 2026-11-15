import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { TradingProvider, TradingInitializer } from "./lib/trading";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TradingProvider>
          <TradingInitializer />
          <App />
        </TradingProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
