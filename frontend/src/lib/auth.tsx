import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeLogin2fa, exchangeSupabaseSession, getAccount, getAuthClientConfig, linkSupabaseIdentity as linkIdentityRequest, reauthenticateIdentityForLink as reauthenticateIdentityForLinkRequest, loginWithUsername, logout, reauthenticateBtcboxCredentials as reauthenticateCredentialsRequest, recoverBtcboxCredentials as recoverCredentialsRequest, setBtcboxCredentials as saveCredentialsRequest, type AccountRestriction } from "./api";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "two-factor" | "password-recovery";

// Map server auth error codes to actionable, user-safe messages. Never expose
// Supabase UUIDs, database details, or "contact support" with no next step.
function friendlyAuthErrorMessage(cause: unknown): string {
  const code = (cause as { code?: string })?.code;
  if (code === "SUPABASE_IDENTITY_MISMATCH") return "This email is already registered on BTCBOX. Please sign in instead, or contact support to link this Google account.";
  if (code === "IDENTITY_IN_USE") return "This wallet is already linked to another BTCBOX account. Please sign in with that account.";
  if (code === "ACCOUNT_FROZEN") return "This BTCBOX account is frozen. Please contact support.";
  if (code === "AUTH_PROVIDER_NOT_ALLOWED") return "This sign-in method is not available. Please use another method.";
  if (code === "GOOGLE_ONLY_AUTH") return "Email registration must be completed through the secure Supabase confirmation flow.";
  if (code === "GOOGLE_PROVIDER_UNAVAILABLE") return "Google sign-in is temporarily unavailable. Please try again later.";
  if (code === "INVALID_SUPABASE_IDENTITY") return "The sign-in identity could not be verified. Please try again.";
  const rawMessage = cause instanceof Error ? cause.message : "";
  if (code === "over_email_send_rate_limit" || /email rate limit exceeded|only request this after/i.test(rawMessage)) return "Please wait before requesting another email. Check your inbox for an earlier link.";
  if (/already associated|already linked|already exists|identity.*already|account.*already|user already/i.test(rawMessage)) {
    return "This sign-in identity is already linked to another BTCBOX account. Please sign in with that account, or contact support to merge your sign-in methods.";
  }
  return cause instanceof Error ? cause.message : "Authentication callback failed.";
}

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
  status: AuthStatus; initializationIssue: boolean; email: string; busy: boolean; error: string; notice: string; googleEnabled: boolean; walletEnabled: boolean; needsCredentials: boolean; credentialRecoveryReady: boolean; credentialRecoveryNeedsTwoFactor: boolean; ethereumWallets: EthereumWalletChoice[]; accountRestriction: AccountRestriction | null;
  signInWithGoogle: (intent?: "login" | "register") => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  setBtcboxCredentials: (username: string, password: string) => Promise<void>;
  reauthenticateCredentialsWithGoogle: () => Promise<void>;
  reauthenticateCredentialsWithWeb3: (chain: "ethereum" | "solana", twoFactorCode?: string, wallet?: unknown) => Promise<void>;
  completeCredentialRecoveryTwoFactor: (code: string) => Promise<void>;
  recoverBtcboxPassword: (password: string) => Promise<void>;
  setSupabaseLoginPassword: (password: string) => Promise<void>;
  identityLinkSourceVerified: boolean; identityLinkNeedsTwoFactor: boolean;
  reauthenticateIdentityLinkWithGoogle: () => Promise<void>;
  completeIdentityLinkReauthTwoFactor: (code: string) => Promise<void>;
  reauthenticateIdentityLinkWithWeb3: (chain: "ethereum" | "solana", twoFactorCode?: string, wallet?: unknown) => Promise<void>;
  linkGoogleIdentity: () => Promise<void>;
  linkWeb3Identity: (chain: "ethereum" | "solana", wallet?: unknown) => Promise<void>;
  signInWithWeb3: (chain: "ethereum" | "solana", wallet?: unknown) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordRecovery: (password: string) => Promise<void>;
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
  const [initializationIssue, setInitializationIssue] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [identityLinkSourceVerified, setIdentityLinkSourceVerified] = useState(false);
  const [pendingIdentityLinkToken, setPendingIdentityLinkToken] = useState("");
  const [identityLinkNeedsTwoFactor, setIdentityLinkNeedsTwoFactor] = useState(false);
  const [needsCredentials, setNeedsCredentials] = useState(false);
  const [credentialRecoveryReady, setCredentialRecoveryReady] = useState(false);
  const [credentialRecoveryNeedsTwoFactor, setCredentialRecoveryNeedsTwoFactor] = useState(false);
  const [pendingCredentialRecoveryToken, setPendingCredentialRecoveryToken] = useState("");
  const [ethereumWallets, setEthereumWallets] = useState<EthereumWalletChoice[]>([]);
  const [accountRestriction, setAccountRestriction] = useState<AccountRestriction | null>(null);
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
    setAccountRestriction(account.restriction ?? null);
    setTempToken("");
    setStatus("authenticated");
    // Mark that a sign-in method has been verified, enabling linking of additional methods
    setIdentityLinkSourceVerified(true);
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
    } catch (cause) {
      // A BTCBOX API/network failure is not proof that the Supabase session is invalid.
      // Preserve the persisted Supabase credentials so the user can recover without
      // being silently signed out. Supabase clears genuinely invalid sessions itself.
      setError(cause instanceof Error ? cause.message : "Your session could not be restored. Please try again.");
      setInitializationIssue(true);
      setTempToken("");
      setStatus("anonymous");
    } finally { exchangeLock.current = false; }
  }, [setSignedIn]);

  useEffect(() => {
    // If an OAuth callback lands on the wrong path (Supabase allowlist fell back
    // to the site URL), ferry the code/hash to the real callback route before init.
    const initSearch = new URLSearchParams(window.location.search);
    const initHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if ((initSearch.has("code") || initSearch.has("error") || initHash.has("access_token")) && window.location.pathname !== "/auth/react-callback") {
      window.location.replace("/auth/react-callback" + window.location.search + window.location.hash);
      return;
    }
    let active = true;
    const controller = new AbortController();
    // A slow/configuration-failed restoration is not proof of a signed-out account.
    // Keep credentials/session storage intact and expose an explicit recovery action.
    setInitializationIssue(false);
    const callbackParams = new URLSearchParams(window.location.search);
    const callbackHashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const isCallback = window.location.pathname === "/auth/react-callback" &&
      (callbackParams.has("code") || callbackParams.get("flow") === "recovery" ||
        callbackParams.has("error") || callbackParams.has("error_description") ||
        callbackParams.has("error_code") || callbackParams.has("error_reason") ||
        callbackHashParams.has("error") || callbackHashParams.has("error_description") ||
        callbackHashParams.has("error_code") || callbackHashParams.has("error_reason"));
    let serverSessionRestored = false;
    const slowTimer = window.setTimeout(() => {
      if (active && !serverSessionRestored) setInitializationIssue(true);
    }, 12000);
    // A valid BTCBOX HttpOnly cookie remains authoritative when the public
    // Supabase Auth configuration endpoint is temporarily unavailable.
    const watchdogTimer = window.setTimeout(() => {
      if (!active || serverSessionRestored) return;
      setError("Authentication restoration timed out. Please sign in again.");
      setInitializationIssue(true);
      setTempToken("");
      setStatus("anonymous");
    }, 25000);
    (async () => {
      // Fetch provider configuration in parallel, but restore an existing
      // server-issued BTCBOX session before depending on Supabase Auth config.
      const configPromise = getAuthClientConfig(controller.signal).then(
        config => ({ ok: true as const, config }),
        error => ({ ok: false as const, error }),
      );
      try {
        if (!isCallback) {
          try {
            await setSignedIn();
            serverSessionRestored = true;
            setError("");
            setInitializationIssue(false);
          } catch { /* No valid BTCBOX cookie; continue with the persisted Supabase session. */ }
        }
        if (!active) return;
        const configResult = await configPromise;
        if ("error" in configResult) throw configResult.error;
        const config = configResult.config;
        if (!active) return;
        setGoogleEnabled(config.google_enabled === true);
        setWalletEnabled(config.wallet_enabled !== false);
        // Load the authentication SDK only after server configuration is available.
        const { createClient } = await import("@supabase/supabase-js");
        if (!active) return;
        const client = createClient(config.supabase_url, config.publishable_key, {
          auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
        clientRef.current = client;
        if (isCallback) { setStatus("anonymous"); return; }
        if (serverSessionRestored) return;
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (data.session?.access_token) {
          await acceptSupabaseSession(data.session.access_token);
          return;
        }
        if (active) setStatus("anonymous");
      } catch (cause) {
        if (active) {
          if (serverSessionRestored) {
            // A provider-config outage must not sign out a valid BTCBOX cookie.
            // Keep new identity actions disabled until the public config recovers.
            setGoogleEnabled(false);
            setWalletEnabled(false);
            setError("");
            setInitializationIssue(false);
            setStatus("authenticated");
          } else {
            setError(cause instanceof Error ? cause.message : "Authentication is unavailable.");
            setInitializationIssue(true);
            // Preserve a potentially valid persisted Supabase session for retry.
            setTempToken("");
            setStatus("anonymous");
          }
        }
      } finally { window.clearTimeout(slowTimer); window.clearTimeout(watchdogTimer); }
    })();
    return () => { active = false; window.clearTimeout(slowTimer); window.clearTimeout(watchdogTimer); controller.abort(); };
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

  // Set a password on the currently authenticated Supabase user. This keeps the
  // Google identity and email/password credential on the same auth.users UUID.
  const setSupabaseLoginPassword = useCallback(async (password: string) => {
    if (password.length < 8 || password.length > 128) throw new Error("Use a password between 8 and 128 characters.");
    setBusy(true); setError(""); setNotice("");
    try {
      const client = clientRef.current;
      if (!client) throw new Error("Authentication is still initializing. Please try again.");
      const { data, error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      if (!data.user?.id) throw new Error("The login password could not be confirmed. Please try again.");

      // Supabase may terminate a session after a password change. Re-authenticate
      // immediately with the new password, and verify that it is still the exact
      // same auth.users record (never create or switch to another BTCBOX account).
      const loginEmail = data.user.email || email;
      if (!loginEmail) throw new Error("The account email could not be verified. Continue with Google sign-in.");
      const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email: loginEmail, password });
      if (signInError) throw signInError;
      if (!signedIn.user || signedIn.user.id !== data.user.id || !signedIn.session?.access_token) {
        throw new Error("The password was updated, but the same account session could not be restored. Please continue with Google sign-in.");
      }
      setNotice("Your email login password is ready. You can now sign in with this email and password or continue with Google.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login password could not be saved.");
      throw cause;
    } finally { setBusy(false); }
  }, [email]);

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

  const signInWithGoogle = useCallback(async (intent: "login" | "register" = "login") => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!googleEnabled) throw new Error("Google sign-in is currently unavailable.");
      if (!clientRef.current) throw new Error("Authentication is still initializing. Please try again.");
      const { error: authError } = await clientRef.current.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/react-callback?intent=" + intent, queryParams: { prompt: "select_account" } },
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
      if (!walletEnabled) throw new Error("Wallet sign-in is temporarily unavailable.");
      const client = clientRef.current;
      if (!client) throw new Error("Authentication is still initializing. Please try again.");
      const statement = "Sign in to BTCBOX. This signature verifies wallet ownership only and does not authorize any blockchain transaction.";
      const wallet = selectedWallet || (chain === "solana" ? getInjectedSolanaWallet() : undefined);
      const { data, error: authError } = await client.auth.signInWithWeb3({ chain, statement, ...(wallet ? { wallet } : {}) } as Parameters<SupabaseClient["auth"]["signInWithWeb3"]>[0]);
      if (authError) throw authError;
      if (!data.session?.access_token) throw new Error("The wallet did not return a valid sign-in session. Please try again.");
      await acceptSupabaseSession(data.session.access_token);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const normalized = message.toLowerCase();
      // Never expose raw wallet/Supabase SDK diagnostics in the login UI.
      // These failures are actionable only as user-facing wallet availability messages.
      if (normalized.includes("provider is disabled") || normalized.includes("provider is not enabled")) {
        setError("This wallet network is temporarily unavailable. Please use another sign-in method.");
      } else if (chain === "ethereum" && (
        normalized.includes("eth_requestaccounts") ||
        normalized.includes("wallet method") ||
        normalized.includes("ethereum provider") ||
        normalized.includes("no ethereum provider") ||
        normalized.includes("@supabase/auth-js")
      )) {
        setError("No compatible Ethereum wallet was detected. Please install or unlock a supported wallet, then try again.");
      } else if (chain === "solana" && (
        normalized.includes("window.solana") ||
        normalized.includes("solana wallet interface") ||
        normalized.includes("wallet method") ||
        normalized.includes("@supabase/auth-js")
      )) {
        setError("No compatible Solana wallet was detected. Please install or unlock a supported wallet, then try again.");
      } else if (/user rejected|user denied|request rejected/i.test(message)) {
        setError("Wallet connection was cancelled. You can try again or sign in with your username and password.");
      } else {
        setError("Wallet sign-in could not be completed. Please check that your wallet is installed and unlocked, or use another sign-in method.");
      }
    } finally { setBusy(false); }
  }, [acceptSupabaseSession, walletEnabled]);

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
    if (password.length < 8 || password.length > 128) throw new Error("Use a password between 8 and 128 characters.");
    setBusy(true); setError(""); setNotice("");
    try {
      const client = clientRef.current;
      if (!client) throw new Error("Authentication is still initializing. Please try again.");
      const { data, error: authError } = await client.auth.signUp({
        email: address.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin + "/auth/react-callback?intent=register",
        },
      });
      if (authError) throw authError;
      if (!data.user) throw new Error("Registration could not be confirmed. Please try again.");
      // Supabase deliberately returns an obfuscated user with no identities for
      // an email that already exists. Do not present that as a fresh registration;
      // guide passwordless legacy users to sign in or use the recovery link instead.
      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setNotice("If this email already has a BTCBOX account, sign in or use Forgot password to set your email password.");
        return;
      }
      if (data.session?.access_token) {
        await acceptSupabaseSession(data.session.access_token);
        setNotice("Your BTCBOX account is ready. You can sign in with your email and password or continue with Google.");
      } else {
        setNotice("Registration received. Please check your email and confirm your address before signing in.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email registration failed.");
      throw cause;
    } finally { setBusy(false); }
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
    if (password.length < 8 || password.length > 128) throw new Error("Use a password between 8 and 128 characters.");
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
      if (!data.session?.access_token) throw new Error("Authentication did not return a valid session.");
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
      setError(friendlyAuthErrorMessage(cause));
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
    status, initializationIssue, email, busy, error, notice, googleEnabled, walletEnabled, identityLinkSourceVerified, identityLinkNeedsTwoFactor, completeIdentityLinkReauthTwoFactor, needsCredentials, credentialRecoveryReady, credentialRecoveryNeedsTwoFactor, ethereumWallets, accountRestriction, signInWithGoogle, reauthenticateIdentityLinkWithGoogle, reauthenticateIdentityLinkWithWeb3, linkGoogleIdentity, linkWeb3Identity, signInWithUsername, setBtcboxCredentials, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, completeCredentialRecoveryTwoFactor, recoverBtcboxPassword, signInWithWeb3, signInWithEmail, signUpWithEmail,
    requestPasswordReset, completePasswordRecovery, finishOAuth, verifyTwoFactor, getSupabaseAccessToken, signOut, setSupabaseLoginPassword,
    clearError: () => setError(""),
  }), [status, initializationIssue, email, busy, error, notice, googleEnabled, walletEnabled, identityLinkSourceVerified, identityLinkNeedsTwoFactor, completeIdentityLinkReauthTwoFactor, needsCredentials, credentialRecoveryReady, credentialRecoveryNeedsTwoFactor, ethereumWallets, accountRestriction, signInWithGoogle, linkGoogleIdentity, linkWeb3Identity, signInWithUsername, setBtcboxCredentials, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, completeCredentialRecoveryTwoFactor, recoverBtcboxPassword, signInWithWeb3, signInWithEmail, signUpWithEmail,
    requestPasswordReset, completePasswordRecovery, finishOAuth, verifyTwoFactor, getSupabaseAccessToken, signOut, setSupabaseLoginPassword, reauthenticateIdentityLinkWithGoogle, reauthenticateIdentityLinkWithWeb3]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
