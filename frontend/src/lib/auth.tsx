import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completeLogin2fa, exchangeSupabaseSession, getAccount, getAuthClientConfig, linkSupabaseIdentity as linkIdentityRequest, reauthenticateIdentityForLink as reauthenticateIdentityForLinkRequest, loginWithUsername, logout, reauthenticateBtcboxCredentials as reauthenticateCredentialsRequest, recoverBtcboxCredentials as recoverCredentialsRequest, setBtcboxCredentials as saveCredentialsRequest } from "./api";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "two-factor";

type EthereumWalletChoice = {
  info: { uuid: string; name: string; rdns?: string };
  provider: unknown;
};

function getInjectedSolanaWallet(): unknown {
  if (typeof window === "undefined") return undefined;
  const walletWindow = window as Window & {
    phantom?: { solana?: unknown };
    solana?: unknown;
    braveSolana?: unknown;
  };
  return [walletWindow.phantom?.solana, walletWindow.braveSolana, walletWindow.solana].find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    return "signIn" in candidate || "signMessage" in candidate;
  });
}
type AuthContextValue = {
  status: AuthStatus; email: string; busy: boolean; error: string; notice: string; googleEnabled: boolean; needsCredentials: boolean; credentialRecoveryReady: boolean; credentialRecoveryNeedsTwoFactor: boolean; ethereumWallets: EthereumWalletChoice[];
  signInWithGoogle: () => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  setBtcboxCredentials: (username: string, password: string) => Promise<void>;
  reauthenticateCredentialsWithGoogle: () => Promise<void>;
  reauthenticateCredentialsWithWeb3: (chain: "ethereum" | "solana", twoFactorCode?: string, wallet?: unknown) => Promise<void>;
  completeCredentialRecoveryTwoFactor: (code: string) => Promise<void>;
  recoverBtcboxPassword: (password: string) => Promise<void>;
  identityLinkSourceVerified: boolean; identityLinkNeedsTwoFactor: boolean;
  reauthenticateIdentityLinkWithGoogle: () => Promise<void>;
  completeIdentityLinkReauthTwoFactor: (code: string) => Promise<void>;
  reauthenticateIdentityLinkWithWeb3: (chain: "ethereum" | "solana", twoFactorCode?: string, wallet?: unknown) => Promise<void>;
  linkGoogleIdentity: () => Promise<void>;
  linkWeb3Identity: (chain: "ethereum" | "solana", wallet?: unknown) => Promise<void>;
  signInWithWeb3: (chain: "ethereum" | "solana", wallet?: unknown) => Promise<void>;
  finishOAuth: () => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<void>;
  getSupabaseAccessToken: () => Promise<string>;
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
  const [identityLinkSourceVerified, setIdentityLinkSourceVerified] = useState(false);
  const [pendingIdentityLinkToken, setPendingIdentityLinkToken] = useState("");
  const [identityLinkNeedsTwoFactor, setIdentityLinkNeedsTwoFactor] = useState(false);
  const [needsCredentials, setNeedsCredentials] = useState(false);
  const [credentialRecoveryReady, setCredentialRecoveryReady] = useState(false);
  const [credentialRecoveryNeedsTwoFactor, setCredentialRecoveryNeedsTwoFactor] = useState(false);
  const [pendingCredentialRecoveryToken, setPendingCredentialRecoveryToken] = useState("");
  const [ethereumWallets, setEthereumWallets] = useState<EthereumWalletChoice[]>([]);
  const [tempToken, setTempToken] = useState("");
  const exchangeLock = useRef(false);
  const callbackLock = useRef(false);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const onAnnounceProvider = (event: Event) => {
      const detail = (event as CustomEvent<{ info?: { uuid?: string; name?: string; rdns?: string }; provider?: unknown }>).detail;
      if (!detail?.info?.uuid || !detail.info.name || !detail.provider || typeof detail.provider !== "object" ||
          !("request" in detail.provider) || typeof (detail.provider as { request?: unknown }).request !== "function") return;
      const choice: EthereumWalletChoice = {
        info: { uuid: detail.info.uuid, name: detail.info.name, rdns: detail.info.rdns },
        provider: detail.provider,
      };
      setEthereumWallets((current) => current.some((item) => item.info.uuid === choice.info.uuid) ? current : [...current, choice]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounceProvider);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounceProvider);
  }, []);

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
        setGoogleEnabled(config.google_enabled === true);
        const client = createClient(config.supabase_url, config.publishable_key, {
          auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
        clientRef.current = client;
        const callbackParams = new URLSearchParams(window.location.search);
        const callbackHashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const isCallback = window.location.pathname === "/auth/react-callback" &&
          (callbackParams.has("code") ||
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

  const reauthenticateCredentialsWithWeb3 = useCallback(async (chain: "ethereum" | "solana", twoFactorCode = "", selectedWallet?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    const client = clientRef.current;
    try {
      if (!client) throw new Error("Authentication is still initializing. Please try again.");
      const statement = "Verify my identity to reset my BTCBOX password. This signature proves wallet ownership only and does not authorize any blockchain transaction.";
      const wallet = selectedWallet || (chain === "solana" ? getInjectedSolanaWallet() : undefined);
      const { data, error: authError } = await client.auth.signInWithWeb3({ chain, statement, ...(wallet ? { wallet } : {}) } as Parameters<SupabaseClient["auth"]["signInWithWeb3"]>[0]);
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
      await clientRef.current?.auth.signOut();
      setPendingCredentialRecoveryToken("");
      setCredentialRecoveryNeedsTwoFactor(false);
      setCredentialRecoveryReady(true);
      setNotice("Identity verified. Set your new BTCBOX password within five minutes.");
    } catch (cause) {
      const failureCode = cause && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: unknown }).code || "") : "";
      if (["RECENT_REAUTH_REQUIRED", "IDENTITY_NOT_LINKED", "INVALID_SUPABASE_IDENTITY", "ACCOUNT_FROZEN"].includes(failureCode)) {
        setPendingCredentialRecoveryToken("");
        setCredentialRecoveryNeedsTwoFactor(false);
      }
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
      if ((cause as { code?: string })?.code === "RECENT_REAUTH_REQUIRED") setCredentialRecoveryReady(false);
      setError(cause instanceof Error ? cause.message : "BTCBOX password could not be reset.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn]);

  const reauthenticateIdentityLinkWithGoogle = useCallback(async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!googleEnabled) throw new Error("Google sign-in is currently unavailable.");
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { error: authError } = await clientRef.current.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/react-callback?flow=link-reauth", queryParams: { prompt: "select_account" } },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Existing Google verification could not be started.");
      setBusy(false);
    }
  }, [googleEnabled]);

  const completeIdentityLinkReauthTwoFactor = useCallback(async (code: string) => {
    if (!pendingIdentityLinkToken) throw new Error("The verification has expired. Please verify your existing sign-in method again.");
    setBusy(true); setError(""); setNotice("");
    try {
      await reauthenticateIdentityForLinkRequest(pendingIdentityLinkToken, code);
      await clientRef.current?.auth.signOut();
      setPendingIdentityLinkToken("");
      setIdentityLinkNeedsTwoFactor(false);
      await setSignedIn();
      setIdentityLinkSourceVerified(true);
      setNotice("Existing Google sign-in method verified. Now choose the new method to connect.");
    } catch (cause) {
      const failureCode = cause && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: unknown }).code || "") : "";
      if (["RECENT_REAUTH_REQUIRED", "IDENTITY_NOT_LINKED", "INVALID_SUPABASE_IDENTITY", "ACCOUNT_FROZEN"].includes(failureCode)) {
        setPendingIdentityLinkToken("");
        setIdentityLinkNeedsTwoFactor(false);
      }
      setError(cause instanceof Error ? cause.message : "Authenticator verification failed.");
      throw cause;
    } finally { setBusy(false); }
  }, [pendingIdentityLinkToken, setSignedIn]);

  const reauthenticateIdentityLinkWithWeb3 = useCallback(async (chain: "ethereum" | "solana", twoFactorCode = "", selectedWallet?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    const client = clientRef.current;
    try {
      if (!client) throw new Error("Authentication is still initializing. Please try again.");
      const statement = "Reverify my existing BTCBOX sign-in identity before linking another method. This signature proves wallet ownership only and does not authorize any blockchain transaction.";
      const wallet = selectedWallet || (chain === "solana" ? getInjectedSolanaWallet() : undefined);
      const { data, error: authError } = await client.auth.signInWithWeb3({ chain, statement, ...(wallet ? { wallet } : {}) } as Parameters<SupabaseClient["auth"]["signInWithWeb3"]>[0]);
      if (authError) throw authError;
      if (!data.session?.access_token) throw new Error("The wallet did not return a verifiable identity.");
      await reauthenticateIdentityForLinkRequest(data.session.access_token, twoFactorCode);
      await client.auth.signOut();
      await setSignedIn();
      setIdentityLinkSourceVerified(true);
      setNotice("Existing sign-in method verified. Now choose the new method to connect.");
    } catch (cause) {
      await client?.auth.signOut().catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Existing wallet verification failed.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn]);

  const linkGoogleIdentity = useCallback(async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!identityLinkSourceVerified) throw new Error("First verify a sign-in method already connected to this BTCBOX account.");
      if (!googleEnabled) throw new Error("Google sign-in is currently unavailable.");
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { error: authError } = await clientRef.current.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/react-callback?flow=link-target", queryParams: { prompt: "select_account" } },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google identity linking could not be started.");
      setBusy(false);
    }
  }, [googleEnabled, identityLinkSourceVerified]);

  const linkWeb3Identity = useCallback(async (chain: "ethereum" | "solana", selectedWallet?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!identityLinkSourceVerified) throw new Error("First verify a sign-in method already connected to this BTCBOX account.");
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const statement = "Link this new wallet to my existing BTCBOX account. This signature verifies wallet ownership only and does not authorize any blockchain transaction.";
      const wallet = selectedWallet || (chain === "solana" ? getInjectedSolanaWallet() : undefined);
      const { data, error: authError } = await clientRef.current.auth.signInWithWeb3({ chain, statement, ...(wallet ? { wallet } : {}) } as Parameters<SupabaseClient["auth"]["signInWithWeb3"]>[0]);
      if (authError) throw authError;
      if (!data.session?.access_token) throw new Error("The wallet did not return a verifiable identity.");
      await linkIdentityRequest(data.session.access_token);
      // The server consumed the one-time source proof; clear local proof state before cleanup.
      setIdentityLinkSourceVerified(false);
      setPendingIdentityLinkToken("");
      setIdentityLinkNeedsTwoFactor(false);
      await clientRef.current.auth.signOut();
      await setSignedIn();
      setNotice("The wallet has been linked to this BTCBOX account.");
    } catch (cause) {
      await clientRef.current?.auth.signOut().catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Wallet identity could not be linked.");
      throw cause;
    } finally { setBusy(false); }
  }, [identityLinkSourceVerified, setSignedIn]);

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

  const signInWithWeb3 = useCallback(async (chain: "ethereum" | "solana", selectedWallet?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const client = clientRef.current;
      if (!client) throw new Error("Authentication is still initializing. Please try again.");
      const statement = "Sign in to BTCBOX. This signature verifies wallet ownership only and does not authorize any blockchain transaction.";
      const wallet = selectedWallet || (chain === "solana" ? getInjectedSolanaWallet() : undefined);
      const { data, error: authError } = await client.auth.signInWithWeb3({ chain, statement, ...(wallet ? { wallet } : {}) } as Parameters<SupabaseClient["auth"]["signInWithWeb3"]>[0]);
      if (authError) throw authError;
      if (!data.session?.access_token) throw new Error("The wallet did not return a valid sign-in session. Please try again.");
      await acceptSupabaseSession(data.session.access_token);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet sign-in failed.";
      setError(message.toLowerCase().includes("provider is disabled") ? "This wallet network is not enabled in BTCBOX authentication settings." : message);
    } finally { setBusy(false); }
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
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session?.access_token) throw new Error("Google authorization did not return a session.");
      if (url.searchParams.get("flow") === "credential-recovery") {
        try {
          await reauthenticateCredentialsRequest(data.session.access_token);
          await client.auth.signOut();
          await setSignedIn();
          setPendingCredentialRecoveryToken("");
          setCredentialRecoveryNeedsTwoFactor(false);
          setCredentialRecoveryReady(true);
          setNotice("Identity verified. Set your new BTCBOX password within five minutes.");
        } catch (cause) {
          if ((cause as { code?: string })?.code !== "TWO_FACTOR_REQUIRED") throw cause;
          setPendingCredentialRecoveryToken(data.session.access_token);
          setCredentialRecoveryReady(false);
          setCredentialRecoveryNeedsTwoFactor(true);
          await setSignedIn();
          setNotice("Enter your authenticator code to complete password recovery.");
        }
        window.history.replaceState({}, document.title, "/settings");
        return;
      }
      if (url.searchParams.get("flow") === "link-reauth") {
        try {
          await reauthenticateIdentityForLinkRequest(data.session.access_token);
          await client.auth.signOut();
          await setSignedIn();
          setPendingIdentityLinkToken("");
          setIdentityLinkNeedsTwoFactor(false);
          setIdentityLinkSourceVerified(true);
          setNotice("Existing Google sign-in method verified. Now choose the new method to connect.");
        } catch (cause) {
          if ((cause as { code?: string })?.code !== "TWO_FACTOR_REQUIRED") throw cause;
          setPendingIdentityLinkToken(data.session.access_token);
          setIdentityLinkSourceVerified(false);
          setIdentityLinkNeedsTwoFactor(true);
          await setSignedIn();
          setNotice("Enter your authenticator code to finish verifying your existing Google sign-in method.");
        }
        window.history.replaceState({}, document.title, "/settings");
        return;
      }
      if (url.searchParams.get("flow") === "link-target") {
        await linkIdentityRequest(data.session.access_token);
        // The server consumed the one-time source proof; clear local proof state before cleanup.
        setIdentityLinkSourceVerified(false);
        setPendingIdentityLinkToken("");
        setIdentityLinkNeedsTwoFactor(false);
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
      const failedFlow = new URL(window.location.href).searchParams.get("flow") || "";
      if (failedFlow === "link-reauth") {
        setPendingIdentityLinkToken("");
        setIdentityLinkNeedsTwoFactor(false);
        setIdentityLinkSourceVerified(false);
      }
      if (failedFlow === "credential-recovery") {
        setPendingCredentialRecoveryToken("");
        setCredentialRecoveryNeedsTwoFactor(false);
        setCredentialRecoveryReady(false);
      }
      if (["link-reauth", "link-target", "credential-recovery"].includes(failedFlow)) {
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
    catch (cause) {
      const failureCode = cause && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: unknown }).code || "") : "";
      if (["TWOFA_CHALLENGE_EXPIRED", "TWOFA_NOT_ENABLED", "USER_NOT_FOUND", "ACCOUNT_FROZEN"].includes(failureCode)) {
        setTempToken("");
        setEmail("");
        setNeedsCredentials(false);
        setStatus("anonymous");
      }
      setError(cause instanceof Error ? cause.message : "Verification failed.");
      throw cause;
    } finally { setBusy(false); }
  }, [setSignedIn, tempToken]);

  const getSupabaseAccessToken = useCallback(async () => {
    const client = clientRef.current;
    if (!client) throw new Error("Authentication is not initialized. Please sign in again.");
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Your sign-in session has expired. Please sign in again.");
    return accessToken;
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true); setError("");
    try {
      await logout();
      await clientRef.current?.auth.signOut();
      setEmail("");
      setTempToken("");
      setNeedsCredentials(false);
      setIdentityLinkSourceVerified(false);
      setPendingIdentityLinkToken("");
      setIdentityLinkNeedsTwoFactor(false);
      setCredentialRecoveryReady(false);
      setCredentialRecoveryNeedsTwoFactor(false);
      setPendingCredentialRecoveryToken("");
      setNotice("");
      setStatus("anonymous");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign out failed."); throw cause; }
    finally { setBusy(false); }
  }, []);

  const value = useMemo(() => ({
    status, email, busy, error, notice, googleEnabled, identityLinkSourceVerified, identityLinkNeedsTwoFactor, completeIdentityLinkReauthTwoFactor, needsCredentials, credentialRecoveryReady, credentialRecoveryNeedsTwoFactor, ethereumWallets, signInWithGoogle, reauthenticateIdentityLinkWithGoogle, reauthenticateIdentityLinkWithWeb3, linkGoogleIdentity, linkWeb3Identity, signInWithUsername, setBtcboxCredentials, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, completeCredentialRecoveryTwoFactor, recoverBtcboxPassword, signInWithWeb3, finishOAuth, verifyTwoFactor, getSupabaseAccessToken, signOut,
    clearError: () => setError(""),
  }), [status, email, busy, error, notice, googleEnabled, identityLinkSourceVerified, identityLinkNeedsTwoFactor, completeIdentityLinkReauthTwoFactor, needsCredentials, credentialRecoveryReady, credentialRecoveryNeedsTwoFactor, ethereumWallets, signInWithGoogle, linkGoogleIdentity, linkWeb3Identity, signInWithUsername, setBtcboxCredentials, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, completeCredentialRecoveryTwoFactor, recoverBtcboxPassword, signInWithWeb3, finishOAuth, verifyTwoFactor, getSupabaseAccessToken, signOut, reauthenticateIdentityLinkWithGoogle, reauthenticateIdentityLinkWithWeb3]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
