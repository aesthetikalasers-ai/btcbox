import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { MainAuthDialog } from "../features/auth/MainAuthDialog";

type AuthDialogContextValue = { openAuthDialog: (mode?: "login" | "register") => void };
const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      setOpen(false);
    }
  }, [location.pathname]);
  const openAuthDialog = useCallback((next: "login" | "register" = "login") => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMode(next);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openAuthDialog }), [openAuthDialog]);
  return <AuthDialogContext.Provider value={value}>
    {children}
    <MainAuthDialog open={open} mode={mode} onOpenChange={setOpen} onModeChange={setMode} openerRef={openerRef} />
  </AuthDialogContext.Provider>;
}

export function useAuthDialog() {
  const value = useContext(AuthDialogContext);
  if (!value) throw new Error("useAuthDialog must be used inside AuthDialogProvider");
  return value;
}