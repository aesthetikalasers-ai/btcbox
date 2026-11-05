import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completeLogin2fa, exchangeSupabaseSession, getAccount, getAuthClientConfig, logout } from "./api";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "two-factor";
type AuthContextValue = {
  status: AuthStatus; email: string; busy: boolean; error: string;
  signInWithGoogle: () => Promise<void>;
  finishOAuth: () => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<SupabaseClient | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tempToken, setTempToken] = useState("");
  const exchangeLock = useRef(false);

  const setSignedIn = useCallback(async () => {
    const account = await getAccount();
    setEmail(account.email || "");
    setTempToken("");
    setStatus("authenticated");
  }, []);

  const acceptSupabaseSession = useCallback(async (accessToken: string) => {
    if (exchangeLock.current) return;
    exchangeLock.current = true;
    try {
      const result = await exchangeSupabaseSession(accessToken);
      if (result.require_2fa && result.temp_token) {
        setTempToken(result.temp_token);
        setStatus("two-factor");
        return;
      }
      await setSignedIn();
    } finally {
      exchangeLock.current = false;
    }
  }, [setSignedIn]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      try {
        const config = await getAuthClientConfig(controller.signal);
        if (!active) return;
        if (config.google_enabled === false) throw new Error("Google sign-in is currently unavailable.");
        const client = createClient(config.supabase_url, config.publishable_key, {
          auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
        clientRef.current = client;
        try {
          await setSignedIn();
          return;
        } catch {
          const { data, error: sessionError } = await client.auth.getSession();
          if (sessionError) throw sessionError;
          if (data.session?.access_token) {
            const result = await exchangeSupabaseSession(data.session.access_token);
            if (result.require_2fa && result.temp_token) {
              if (active) { setTempToken(result.temp_token); setStatus("two-factor"); }
              return;
            }
            await setSignedIn();
            return;
          }
        }
        if (active) setStatus("anonymous");
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : "Authentication is unavailable."); setStatus("anonymous"); }
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [setSignedIn]);

  const signInWithGoogle = useCallback(async () => {
    setBusy(true); setError("");
    try {
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { error: oauthError } = await clientRef.current.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/react-callback", queryParams: { prompt: "select_account" } },
      });
      if (oauthError) throw oauthError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
      setBusy(false);
    }
  }, []);

  const finishOAuth = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const client = clientRef.current;
      if (!client) throw new Error("Authentication is still initializing. Reload and try again.");
      const url = new URL(window.location.href);
      const authError = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (authError) throw new Error(authError);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      }
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session?.access_token) throw new Error("Google authorization did not return a session.");
      await acceptSupabaseSession(data.session.access_token);
      window.history.replaceState({}, document.title, "/auth/react-callback");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google authorization failed.");
      setStatus("anonymous");
    } finally { setBusy(false); }
  }, [acceptSupabaseSession]);

  const verifyTwoFactor = useCallback(async (code: string) => {
    if (!tempToken) throw new Error("Your sign-in verification has expired. Please sign in again.");
    setBusy(true); setError("");
    try { await completeLogin2fa(tempToken, code); await setSignedIn(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed."); throw cause; }
    finally { setBusy(false); }
  }, [setSignedIn, tempToken]);

  const signOut = useCallback(async () => {
    setBusy(true); setError("");
    try {
      await logout();
      await clientRef.current?.auth.signOut();
      setEmail(""); setTempToken(""); setStatus("anonymous");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign out failed.");
      throw cause;
    } finally { setBusy(false); }
  }, []);

  const value = useMemo(() => ({ status, email, busy, error, signInWithGoogle, finishOAuth, verifyTwoFactor, signOut, clearError: () => setError("") }),
    [status, email, busy, error, signInWithGoogle, finishOAuth, verifyTwoFactor, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
