import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { ApiError, beginTwoFactorEnrollment, confirmTwoFactor, disableTwoFactor, type AccountSnapshot } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { TrustSection } from "../trust/TrustLayout";

/**
 * Formats a base32 secret into fixed 4-character groups, split into lines of
 * four groups (16 characters) so long secrets wrap predictably instead of
 * leaving a stray 2-character tail on the last line.
 */
function formatSecretLines(secret: string): string[] {
  const cleaned = secret.replace(/\s/g, "").toUpperCase();
  const groups = cleaned.match(/.{1,4}/g) ?? [];
  const lines: string[] = [];
  for (let i = 0; i < groups.length; i += 4) {
    lines.push(groups.slice(i, i + 4).join(" "));
  }
  return lines;
}

type Mode = "idle" | "enrolling" | "disabling";

/**
 * Two-factor authentication management.
 *
 * The backend owns every safety rule here, and this UI mirrors them rather than
 * re-implementing them:
 *   - password accounts must re-enter the current password to start enrollment
 *   - OAuth accounts must have signed in within 5 minutes (the server answers
 *     REAUTH_REQUIRED otherwise, which we surface verbatim)
 *   - enabling OR disabling revokes all other sessions, so we warn before the
 *     action rather than after
 *
 * No QR code is rendered: the project has no QR library and adding one is not
 * justified when every authenticator app accepts a manually entered secret.
 * Showing a fake QR would be worse than showing none.
 */
export function TwoFactorCard({ account, onChanged }: { account: AccountSnapshot | null; onChanged: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("idle");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const enabled = account?.twofa_enabled === true;

  const reset = useCallback(() => {
    setMode("idle");
    setPassword("");
    setSecret("");
    setCode("");
    setError("");
    setCopied(false);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const startEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await beginTwoFactorEnrollment(password || undefined);
      setSecret(result.secret);
      setPassword("");
      setMode("enrolling");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t("Two-factor setup could not be started."));
    } finally {
      setBusy(false);
    }
  };

  const finishEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || code.length < 6) return;
    setBusy(true);
    setError("");
    try {
      await confirmTwoFactor(code);
      reset();
      setNotice(t("Two-factor authentication is now enabled. Other devices have been signed out."));
      onChanged();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t("The verification code was not accepted."));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || code.length < 6) return;
    setBusy(true);
    setError("");
    try {
      await disableTwoFactor(code);
      reset();
      setNotice(t("Two-factor authentication is now disabled. Enroll again before withdrawing."));
      onChanged();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t("The verification code was not accepted."));
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("Copy failed. Select the key and copy it manually."));
    }
  };

  return (
    <TrustSection
      title="Two-factor authentication"
      description="A time-based code from your authenticator app is required for withdrawals and sensitive changes."
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            {enabled ? (
              <ShieldCheck className="h-4 w-4 shrink-0 text-brand-accent" />
            ) : (
              <ShieldOff className="h-4 w-4 shrink-0 text-brand-text-muted" />
            )}
            <span className="min-w-0 text-[12.5px] font-medium text-brand-text">
              {enabled ? t("Enabled") : t("Not enabled")}
            </span>
          </span>
          {mode === "idle" && (
            <button
              type="button"
              onClick={() => { setMode(enabled ? "disabling" : "enrolling"); setError(""); }}
              className={`shrink-0 rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                enabled
                  ? "border-brand-border text-brand-text-muted hover:border-brand-danger/50 hover:text-brand-danger"
                  : "border-brand-accent/40 text-brand-accent hover:bg-brand-accent/10"
              }`}
            >
              {enabled ? t("Turn off") : t("Set up")}
            </button>
          )}
        </div>

        {error ? <p className="mt-3 text-[11.5px] leading-relaxed text-brand-danger" role="alert">{error}</p> : null}

        {mode === "enrolling" && !secret && (
          <form className="mt-4 space-y-3" onSubmit={startEnrollment}>
            <label className="block space-y-1.5">
              <span className="text-[11.5px] text-brand-text-muted">{t("Enter your login password to continue")}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                aria-label={t("Login password")}
                className="h-10 w-full rounded-md border border-brand-border bg-brand-surface-2 px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-brand-text-muted">
              {t("If you sign in with Google or a wallet, sign in again within 5 minutes before enrolling.")}
            </p>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="h-9 flex-1 rounded border border-brand-accent/40 text-[12px] font-semibold text-brand-accent transition-colors hover:bg-brand-accent/10 disabled:opacity-50">
                {busy ? t("Starting…") : t("Continue")}
              </button>
              <button type="button" onClick={reset} className="h-9 rounded border border-brand-border px-3 text-[12px] font-medium text-brand-text-muted transition-colors hover:text-brand-text">
                {t("Cancel")}
              </button>
            </div>
          </form>
        )}


        {mode === "enrolling" && secret && (
          <div className="mt-4 space-y-3">
            <p className="text-[11.5px] leading-relaxed text-brand-text-muted">
              {t("Add this key to your authenticator app, then enter the 6-digit code it shows.")}
            </p>
            <div className="rounded-md border border-brand-border bg-brand-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-wide text-brand-text-muted">{t("Setup key")}</p>
              <div className="mt-1.5 flex items-start gap-2">
                <code className="min-w-0 flex-1 font-mono text-[12px] leading-relaxed text-brand-text">
                  {formatSecretLines(secret).map((line, index) => (
                    <span key={index} className="block break-all">{line}</span>
                  ))}
                </code>
                <button
                  type="button"
                  onClick={() => { void copySecret(); }}
                  aria-label={t("Copy setup key")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-brand-border text-brand-text-muted transition-colors hover:text-brand-text"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-brand-accent" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <form className="space-y-3" onSubmit={finishEnrollment}>
              <label className="block space-y-1.5">
                <span className="text-[11.5px] text-brand-text-muted">{t("Enter the 6-digit code")}</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  aria-label={t("Authenticator code")}
                  className="h-10 w-full rounded-md border border-brand-border bg-brand-surface-2 px-3 font-mono text-[15px] tracking-[0.3em] text-brand-text outline-none focus:border-brand-accent"
                />
              </label>
              <p className="text-[11px] leading-relaxed text-brand-text-muted">
                {t("Enabling 2FA signs out all other devices on this account.")}
              </p>
              <div className="flex gap-2">
                <button type="submit" disabled={busy || code.length < 6} className="h-9 flex-1 rounded border border-brand-accent/40 text-[12px] font-semibold text-brand-accent transition-colors hover:bg-brand-accent/10 disabled:opacity-50">
                  {busy ? t("Verifying…") : t("Enable 2FA")}
                </button>
                <button type="button" onClick={reset} className="h-9 rounded border border-brand-border px-3 text-[12px] font-medium text-brand-text-muted transition-colors hover:text-brand-text">
                  {t("Cancel")}
                </button>
              </div>
            </form>
          </div>
        )}

        {mode === "disabling" && (
          <form className="mt-4 space-y-3" onSubmit={turnOff}>
            <p className="text-[11.5px] leading-relaxed text-brand-text-muted">
              {t("Enter the current 6-digit code to turn off two-factor authentication. Other devices will be signed out.")}
            </p>
            <label className="block space-y-1.5">
              <span className="text-[11.5px] text-brand-text-muted">{t("Enter the 6-digit code")}</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-label={t("Authenticator code")}
                className="h-10 w-full rounded-md border border-brand-border bg-brand-surface-2 px-3 font-mono text-[15px] tracking-[0.3em] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || code.length < 6} className="h-9 flex-1 rounded border border-brand-danger/40 text-[12px] font-semibold text-brand-danger transition-colors hover:bg-brand-danger/10 disabled:opacity-50">
                {busy ? t("Turning off…") : t("Turn off 2FA")}
              </button>
              <button type="button" onClick={reset} className="h-9 rounded border border-brand-border px-3 text-[12px] font-medium text-brand-text-muted transition-colors hover:text-brand-text">
                {t("Cancel")}
              </button>
            </div>
          </form>
        )}

        {notice ? (
          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-brand-accent" role="status" aria-live="polite">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {notice}
          </p>
        ) : null}
      </div>
    </TrustSection>
  );
}

