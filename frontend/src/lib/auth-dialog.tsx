import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AuthDialog } from "../features/auth/AuthDialog";
import type { AuthMode } from "../features/auth/AuthFormPanel";

type AuthDialogValue = {
  /** Opens the shared authentication dialog in the requested state. */
  openAuthDialog: (mode?: AuthMode) => void;
  closeAuthDialog: () => void;
  authDialogOpen: boolean;
  authDialogMode: AuthMode;
};

const AuthDialogContext = createContext<AuthDialogValue | null>(null);

/**
 * Application-wide provider for the authentication dialog.
 *
 * Any surface (top bar, public preview CTA, protected-route gate) can request the
 * dialog without navigating away, which keeps the current page and its state
 * intact. The legacy `/login` and `/register` routes stay functional through the
 * same shared form.
 */
export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  const openAuthDialog = useCallback((next: AuthMode = "login") => {
    setMode(next);
    setOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => setOpen(false), []);

  const value = useMemo<AuthDialogValue>(() => ({
    openAuthDialog,
    closeAuthDialog,
    authDialogOpen: open,
    authDialogMode: mode,
  }), [openAuthDialog, closeAuthDialog, open, mode]);

  return <AuthDialogContext.Provider value={value}>
    {children}
    <AuthDialog open={open} mode={mode} onOpenChange={setOpen} onModeChange={setMode} />
  </AuthDialogContext.Provider>;
}

export function useAuthDialog() {
  const value = useContext(AuthDialogContext);
  if (!value) throw new Error("useAuthDialog must be used inside AuthDialogProvider");
  return value;
}
