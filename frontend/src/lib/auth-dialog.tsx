import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MainAuthDialog } from "../features/auth/MainAuthDialog";

type AuthDialogContextValue = { openAuthDialog: (mode?: "login" | "register") => void };
const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const openAuthDialog = useCallback((next: "login" | "register" = "login") => { setMode(next); setOpen(true); }, []);
  const value = useMemo(() => ({ openAuthDialog }), [openAuthDialog]);
  return <AuthDialogContext.Provider value={value}>
    {children}
    <MainAuthDialog open={open} mode={mode} onOpenChange={setOpen} onModeChange={setMode} />
  </AuthDialogContext.Provider>;
}

export function useAuthDialog() {
  const value = useContext(AuthDialogContext);
  if (!value) throw new Error("useAuthDialog must be used inside AuthDialogProvider");
  return value;
}