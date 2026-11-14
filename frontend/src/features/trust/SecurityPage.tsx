import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, KeyRound, Lock, MailCheck, ShieldAlert } from "lucide-react";
import { getAccount, type AccountSnapshot } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { TrustPage, TrustSection } from "../trust/TrustLayout";
import { TwoFactorCard } from "../account/TwoFactorCard";

/**
 * Security overview.
 *
 * This page reports the security posture the server actually exposes through
 * `/api/account` — nothing is inferred or assumed. A control that the backend
 * does not implement (device list, per-user audit trail) is deliberately not
 * displayed at all: an empty "Devices" panel would imply a capability that does
 * not exist.
 */
export function SecurityPage() {
  const { t } = useI18n();
  const { status } = useAuth();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const controller = new AbortController();
    try {
      const snapshot = await getAccount(controller.signal);
      if (!controller.signal.aborted) { setAccount(snapshot); setError(""); }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Security settings are temporarily unavailable.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    void load();
  }, [status, load]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <TrustPage title="Security" lead="Manage the controls that protect your account.">
        <div className="rounded-md border border-brand-border bg-brand-surface px-4 py-10 text-center text-[12px] text-brand-text-muted" role="status">
          {t("Loading security settings…")}
        </div>
      </TrustPage>
    );
  }

  if (status !== "authenticated") {
    return (
      <TrustPage title="Security" lead="Manage the controls that protect your account.">
        <div className="rounded-md border border-brand-border bg-brand-surface px-4 py-10 text-center">
          <Lock className="mx-auto h-6 w-6 text-brand-text-muted" />
          <p className="mt-3 text-[13px] font-semibold text-brand-text">{t("Sign in to manage your security settings")}</p>
          <Link to="/login" className="mt-4 inline-flex h-9 items-center rounded border border-brand-accent/40 px-4 text-[12px] font-semibold text-brand-accent transition-colors hover:bg-brand-accent/10">
            {t("Sign in")}
          </Link>
        </div>
      </TrustPage>
    );
  }

  const kycStatus = String(account?.kyc?.status ?? "not_submitted").toLowerCase();
  const twoFactorOn = account?.twofa_enabled === true;
  const providers = account?.auth_providers ?? [];

  return (
    <TrustPage
      title="Security"
      lead="Every control below reflects the current state stored on the server."
    >
      {error ? (
        <div className="rounded-md border border-brand-danger/30 bg-brand-surface px-3 py-3" role="alert">
          <p className="text-[12px] text-brand-danger">{t(error)}</p>
        </div>
      ) : null}

      <TwoFactorCard account={account} onChanged={() => { void load(); }} />

      <TrustSection title="Account status" description="Prerequisites enforced by the platform.">
        <div>
          <div className="flex items-center gap-3 border-b border-brand-border/60 px-3 py-3 last:border-b-0 sm:px-4">
            <MailCheck className="h-4 w-4 shrink-0 text-brand-text-muted" />
            <span className="min-w-0 flex-1 text-[12px] text-brand-text-muted">{t("Identity verification")}</span>
            <span className={`shrink-0 text-[12px] font-medium ${
              kycStatus === "verified" ? "text-brand-accent" : kycStatus === "rejected" ? "text-brand-danger" : "text-brand-text-muted"
            }`}>
              {kycStatus === "verified" ? t("Verified") : kycStatus === "rejected" ? t("Rejected") : t("Not submitted")}
            </span>
          </div>
          <div className="flex items-center gap-3 border-b border-brand-border/60 px-3 py-3 last:border-b-0 sm:px-4">
            <KeyRound className="h-4 w-4 shrink-0 text-brand-text-muted" />
            <span className="min-w-0 flex-1 text-[12px] text-brand-text-muted">{t("Sign-in methods")}</span>
            <span className="shrink-0 text-[12px] font-medium text-brand-text">
              {providers.length > 0 ? providers.join(", ") : t("Password")}
            </span>
          </div>
          <Link
            to="/kyc"
            className="flex items-center gap-3 border-b border-brand-border/60 px-3 py-3 transition-colors last:border-b-0 hover:bg-brand-surface-hover sm:px-4"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-brand-text-muted" />
            <span className="min-w-0 flex-1 text-[12px] text-brand-text">{t("Manage identity verification")}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-brand-text-disabled" />
          </Link>
        </div>
      </TrustSection>

      <TrustSection title="Where 2FA is required">
        <div className="space-y-2 p-3 sm:p-4">
          {[
            "Withdrawals",
            "Changing two-factor settings",
            "Linking or unlinking a sign-in method",
            "Changing your password",
          ].map((item) => (
            <p key={item} className="text-[12px] leading-relaxed text-brand-text-muted">{t(item)}</p>
          ))}
          {!twoFactorOn ? (
            <p className="rounded border border-brand-border bg-brand-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-brand-text-secondary">
              {t("Two-factor authentication is currently off. Enable it to protect withdrawals and account changes.")}
            </p>
          ) : null}
        </div>
      </TrustSection>
    </TrustPage>
  );
}

