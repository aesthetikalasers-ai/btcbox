import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completeLogin2fa, exchangeSupabaseSession, getAccount, getAuthClientConfig, linkSupabaseIdentity as linkIdentityRequest, loginWithUsername, logout, reauthenticateBtcboxCredentials as reauthenticateCredentialsRequest, recoverBtcboxCredentials as recoverCredentialsRequest, setBtcboxCredentials as saveCredentialsRequest } from "./api";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "two-factor" | "password-recovery";
type AuthContextValue = {
  status: AuthStatus; email: string; busy: boolean; error: string; notice: string; googleEnabled: boolean; needsCredentials: boolean; credentialRecoveryReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  setBtcboxCredentials: (username: string, password: string) => Promise<void>;
  reauthenticateCredentialsWithGoogle: () => Promise<void>;
  reauthenticateCredentialsWithWeb3: (chain: "ethereum" | "solana", twoFactorCode?: string) => Promise<void>;
  completeCredentialRecoveryTwoFactor: (code: string) => Promise<void>;
  recoverBtcboxPassword: (password: string) => Promise<void>;
  linkSupabaseIdentity: (accessToken: string) => Promise<void>;
  linkGoogleIdentity: () => Promise<void>;
  linkWeb3Identity: (chain: "ethereum" | "solana") => Promise<void>;
  signInWithWeb3: (chain: "ethereum" | "solana") => Promise<void>;
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
  const [needsCredentials, setNeedsCredentials] = useState(false);
  const [credentialRecoveryReady, setCredentialRecoveryReady] = useState(false);
  const [credentialRecoveryNeedsTwoFactor, setCredentialRecoveryNeedsTwoFactor] = useState(false);
  const [pendingCredentialRecoveryToken, setPendingCredentialRecoveryToken] = useState("");
  const [tempToken, setTempToken] = useState("");
  const exchangeLock = useRef(false);
  const callbackLock = useRef(false);

  const setSignedIn = useCallback(async () => {
    const account = await getAccount();
    setEmail(account.email || "");
    setNeedsCredentials(!account.username || account.has_login_password !== true);
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
        const callbackHashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const isCallback = window.location.pathname === "/auth/react-callback" &&
          (callbackParams.has("code") || callbackParams.get("flow") === "recovery" ||
            callbackParams.has("error") || callbackParams.has("error_description") ||
            callbackParams.has("error_code") || callbackParams.has("error_reason") ||
            callbackHashParams.has("error") || callbackHashParams.has("error_description") ||
            callbackHashParams.has("error_code") || callbackHashParams.has("error_reason"));
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

  const signInWithUsername = useCallback(async (username: string, password: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await loginWithUsername(username, password);
      if (result.require_2fa && result.temp_token) {
        setTempToken(result.temp_token);
        setStatus("two-factor");
        return;
      }
      await setSignedIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Username or password is incorrect.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn]);

  const setBtcboxCredentials = useCallback(async (username: string, password: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await saveCredentialsRequest(username, password);
      await setSignedIn();
      setNotice("Your BTCBOX username and password are ready.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "BTCBOX credentials could not be saved.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn]);

  const reauthenticateCredentialsWithGoogle = useCallback(async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!googleEnabled) throw new Error("Google sign-in is currently unavailable.");
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { error: authError } = await clientRef.current.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/react-callback?flow=credential-recovery", queryParams: { prompt: "select_account" } },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google verification could not be started.");
      setBusy(false);
      throw cause;
    }
  }, [googleEnabled]);

  const reauthenticateCredentialsWithWeb3 = useCallback(async (chain: "ethereum" | "solana", twoFactorCode = "") => {
    setBusy(true); setError(""); setNotice("");
    const client = clientRef.current;
    try {
      if (!client) throw new Error("Authentication is still initializing. Please try again.");
      const statement = "Verify my identity to reset my BTCBOX password. This signature proves wallet ownership only and does not authorize any blockchain transaction.";
      const { data, error: authError } = await client.auth.signInWithWeb3({ chain, statement });
      if (authError) throw authError;
      if (!data.session?.access_token) throw new Error("The wallet did not return a verifiable identity.");
      await reauthenticateCredentialsRequest(data.session.access_token, twoFactorCode);
      await client.auth.signOut();
      await setSignedIn();
      setCredentialRecoveryReady(true);
      setNotice("Identity verified. Set your new BTCBOX password within five minutes.");
    } catch (cause) {
      await client?.auth.signOut().catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Wallet verification failed.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn]);

  const completeCredentialRecoveryTwoFactor = useCallback(async (code: string) => {
    if (!pendingCredentialRecoveryToken) throw new Error("The verification has expired. Please verify your identity again.");
    setBusy(true); setError(""); setNotice("");
    try {
      await reauthenticateCredentialsRequest(pendingCredentialRecoveryToken, code);
      setPendingCredentialRecoveryToken("");
      setCredentialRecoveryNeedsTwoFactor(false);
      setCredentialRecoveryReady(true);
      setNotice("Identity verified. Set your new BTCBOX password within five minutes.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The authenticator code could not be verified.");
      throw cause;
    } finally { setBusy(false); }
  }, [pendingCredentialRecoveryToken]);

  const recoverBtcboxPassword = useCallback(async (password: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await recoverCredentialsRequest(password);
      setCredentialRecoveryReady(false);
      await setSignedIn();
      setNotice("Your BTCBOX password has been reset. You can now sign in with your username and new password.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "BTCBOX password could not be reset.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn]);

  const linkSupabaseIdentity = useCallback(async (accessToken: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await linkIdentityRequest(accessToken);
      await setSignedIn();
      setNotice("The sign-in identity has been linked to this BTCBOX account.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Identity could not be linked.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn]);

  const linkGoogleIdentity = useCallback(async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!googleEnabled) throw new Error("Google sign-in is currently unavailable.");
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { error: authError } = await clientRef.current.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/react-callback?flow=link", queryParams: { prompt: "select_account" } },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google identity linking could not be started.");
      setBusy(false);
    }
  }, [googleEnabled]);

  const linkWeb3Identity = useCallback(async (chain: "ethereum" | "solana") => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const statement = "Link this wallet to my existing BTCBOX account. This signature verifies wallet ownership only and does not authorize any blockchain transaction.";
      const { data, error: authError } = await clientRef.current.auth.signInWithWeb3({ chain, statement });
      if (authError) throw authError;
      if (!data.session?.access_token) throw new Error("The wallet did not return a verifiable identity.");
      await linkIdentityRequest(data.session.access_token);
      await clientRef.current.auth.signOut();
      await setSignedIn();
      setNotice("The wallet has been linked to this BTCBOX account.");
    } catch (cause) {
      await clientRef.current?.auth.signOut().catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Wallet identity could not be linked.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn]);

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

  const signInWithWeb3 = useCallback(async (chain: "ethereum" | "solana") => {
    setBusy(true); setError(""); setNotice("");
    try {
      const client = clientRef.current;
      if (!client) throw new Error("Authentication is still initializing. Please try again.");
      const statement = "Sign in to BTCBOX. This signature verifies wallet ownership only and does not authorize any blockchain transaction.";
      const { data, error: authError } = await client.auth.signInWithWeb3({ chain, statement });
      if (authError) throw authError;
      if (!data.session?.access_token) throw new Error("The wallet did not return a valid sign-in session. Please try again.");
      await acceptSupabaseSession(data.session.access_token);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet sign-in failed.";
      setError(message.toLowerCase().includes("provider is disabled") ? "This wallet network is not enabled in BTCBOX authentication settings." : message);
    } finally { setBusy(false); }
  }, [acceptSupabaseSession]);

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
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const authError = url.searchParams.get("error_description") || url.searchParams.get("error") ||
        url.searchParams.get("error_code") || url.searchParams.get("error_reason") ||
        hashParams.get("error_description") || hashParams.get("error") ||
        hashParams.get("error_code") || hashParams.get("error_reason");
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
      if (!data.session?.access_token) throw new Error("Google authorization did not return a session.");
      if (url.searchParams.get("flow") === "credential-recovery") {
        try {
          await reauthenticateCredentialsRequest(data.session.access_token);
          await client.auth.signOut();
          await setSignedIn();
          setCredentialRecoveryReady(true);
          setNotice("Identity verified. Set your new BTCBOX password within five minutes.");
        } catch (cause) {
          if ((cause as { code?: string })?.code !== "TWO_FACTOR_REQUIRED") throw cause;
          setPendingCredentialRecoveryToken(data.session.access_token);
          setCredentialRecoveryNeedsTwoFactor(true);
          await client.auth.signOut();
          await setSignedIn();
          setNotice("Enter your authenticator code to complete password recovery.");
        }
        window.history.replaceState({}, document.title, "/settings");
        return;
      }
      if (url.searchParams.get("flow") === "link") {
        await linkIdentityRequest(data.session.access_token);
        await client.auth.signOut();
        await setSignedIn();
        setNotice("The Google identity has been linked to this BTCBOX account.");
        window.history.replaceState({}, document.title, "/settings");
        return;
      }
      await acceptSupabaseSession(data.session.access_token);
      window.history.replaceState({}, document.title, "/auth/react-callback");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication callback failed.");
      if (["link", "credential-recovery"].includes(new URL(window.location.href).searchParams.get("flow") || "")) {
        await clientRef.current?.auth.signOut().catch(() => undefined);
        try { await setSignedIn(); } catch { setStatus("anonymous"); }
      } else {
        setStatus("anonymous");
      }
    } finally { callbackLock.current = false; setBusy(false); }
  }, [acceptSupabaseSession, setSignedIn]);

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
      setEmail(""); setTempToken(""); setNeedsCredentials(false); setCredentialRecoveryReady(false); setCredentialRecoveryNeedsTwoFactor(false); setPendingCredentialRecoveryToken(""); setStatus("anonymous");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign out failed."); throw cause; }
    finally { setBusy(false); }
  }, []);

  const value = useMemo(() => ({
    status, email, busy, error, notice, googleEnabled, needsCredentials, credentialRecoveryReady, credentialRecoveryNeedsTwoFactor, signInWithGoogle, linkGoogleIdentity, linkWeb3Identity, signInWithUsername, setBtcboxCredentials, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, completeCredentialRecoveryTwoFactor, recoverBtcboxPassword, linkSupabaseIdentity, signInWithWeb3, signInWithEmail, signUpWithEmail,
    requestPasswordReset, completePasswordRecovery, finishOAuth, verifyTwoFactor, signOut,
    clearError: () => setError(""),
  }), [status, email, busy, error, notice, googleEnabled, needsCredentials, credentialRecoveryReady, credentialRecoveryNeedsTwoFactor, signInWithGoogle, linkGoogleIdentity, linkWeb3Identity, signInWithUsername, setBtcboxCredentials, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, completeCredentialRecoveryTwoFactor, recoverBtcboxPassword, linkSupabaseIdentity, signInWithWeb3, signInWithEmail, signUpWithEmail,
    requestPasswordReset, completePasswordRecovery, finishOAuth, verifyTwoFactor, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
