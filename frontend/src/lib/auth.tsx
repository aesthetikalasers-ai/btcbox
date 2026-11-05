import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completeLogin2fa, exchangeSupabaseSession, getAccount, getAuthClientConfig, logout } from "./api";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "two-factor" | "password-recovery";
type AuthContextValue = {
  status: AuthStatus; email: string; busy: boolean; error: string; notice: string; googleEnabled: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordRecovery: (password: string) => Promise<void>;
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
  const [notice, setNotice] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [tempToken, setTempToken] = useState("");
  const exchangeLock = useRef(false);
  const callbackLock = useRef(false);

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
    } finally { exchangeLock.current = false; }
  }, [setSignedIn]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      try {
        const config = await getAuthClientConfig(controller.signal);
        if (!active) return;
        setGoogleEnabled(config.google_enabled !== false);
        const client = createClient(config.supabase_url, config.publishable_key, {
          auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
        clientRef.current = client;
        const callbackParams = new URLSearchParams(window.location.search);
        const isCallback = window.location.pathname === "/auth/react-callback" &&
          (callbackParams.has("code") || callbackParams.get("flow") === "recovery" ||
            callbackParams.has("error") || callbackParams.has("error_description") ||
            callbackParams.has("error_code") || callbackParams.has("error_reason"));
        if (isCallback) { setStatus("anonymous"); return; }
        try { await setSignedIn(); return; } catch { /* Recover Supabase session below. */ }
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (data.session?.access_token) {
          await acceptSupabaseSession(data.session.access_token);
          return;
        }
        if (active) setStatus("anonymous");
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : "Authentication is unavailable."); setStatus("anonymous"); }
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [acceptSupabaseSession, setSignedIn]);

  const signInWithGoogle = useCallback(async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!googleEnabled) throw new Error("Google sign-in is currently unavailable.");
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { error: authError } = await clientRef.current.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/react-callback", queryParams: { prompt: "select_account" } },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
      setBusy(false);
    }
  }, [googleEnabled]);

  const signInWithEmail = useCallback(async (address: string, password: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { data, error: authError } = await clientRef.current.auth.signInWithPassword({ email: address.trim(), password });
      if (authError) throw authError;
      if (!data.session?.access_token) throw new Error("Email is not verified yet. Please check your inbox and confirm your email.");
      await acceptSupabaseSession(data.session.access_token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Email sign-in failed."); throw cause; }
    finally { setBusy(false); }
  }, [acceptSupabaseSession]);

  const signUpWithEmail = useCallback(async (address: string, password: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { data, error: authError } = await clientRef.current.auth.signUp({
        email: address.trim(), password,
        options: { emailRedirectTo: window.location.origin + "/auth/react-callback" },
      });
      if (authError) throw authError;
      if (data.session?.access_token) await acceptSupabaseSession(data.session.access_token);
      else setNotice("Registration received. Please check your email and confirm your address before signing in.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Email registration failed."); throw cause; }
    finally { setBusy(false); }
  }, [acceptSupabaseSession]);

  const requestPasswordReset = useCallback(async (address: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { error: authError } = await clientRef.current.auth.resetPasswordForEmail(address.trim(), {
        redirectTo: window.location.origin + "/auth/react-callback?flow=recovery",
      });
      if (authError) throw authError;
      setNotice("If an account exists for this email, a password reset message will be sent.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Password reset could not be requested."); throw cause; }
    finally { setBusy(false); }
  }, []);

  const completePasswordRecovery = useCallback(async (password: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!clientRef.current) throw new Error("Authentication is unavailable. Please reload and try again.");
      const { error: updateError } = await clientRef.current.auth.updateUser({ password });
      if (updateError) throw updateError;
      const { data, error: sessionError } = await clientRef.current.auth.getSession();
      if (sessionError || !data.session?.access_token) throw sessionError || new Error("Password updated. Please sign in again.");
      await acceptSupabaseSession(data.session.access_token);
      setNotice("Your password has been updated.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Password could not be updated."); throw cause; }
    finally { setBusy(false); }
  }, [acceptSupabaseSession]);

  const finishOAuth = useCallback(async () => {
    if (callbackLock.current) return;
    callbackLock.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = clientRef.current;
      if (!client) throw new Error("Authentication is still initializing. Reload and try again.");
      const url = new URL(window.location.href);
      const authError = url.searchParams.get("error_description") || url.searchParams.get("error") || url.searchParams.get("error_code") || url.searchParams.get("error_reason");
      if (authError) throw new Error(authError);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      }
      if (url.searchParams.get("flow") === "recovery") {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError || !data.session) throw sessionError || new Error("The password reset link is invalid or expired.");
        setStatus("password-recovery");
        window.history.replaceState({}, document.title, "/auth/react-callback?flow=recovery");
        return;
      }
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session?.access_token) throw new Error("Email confirmation or Google authorization did not return a session.");
      await acceptSupabaseSession(data.session.access_token);
      window.history.replaceState({}, document.title, "/auth/react-callback");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication callback failed.");
      setStatus("anonymous");
    } finally { callbackLock.current = false; setBusy(false); }
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign out failed."); throw cause; }
    finally { setBusy(false); }
  }, []);

  const value = useMemo(() => ({
    status, email, busy, error, notice, googleEnabled, signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, completePasswordRecovery, finishOAuth, verifyTwoFactor, signOut,
    clearError: () => setError(""),
  }), [status, email, busy, error, notice, googleEnabled, signInWithGoogle, signInWithEmail, signUpWithEmail,
    requestPasswordReset, completePasswordRecovery, finishOAuth, verifyTwoFactor, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
