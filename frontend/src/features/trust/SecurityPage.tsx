import { KeyRound, Lock, MailCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { TrustPage, TrustSection } from "./TrustLayout";

/**
 * Security overview.
 *
 * This page is a public reference explaining how BTCBOX protects accounts and
 * funds — it does NOT manage a signed-in user's own security settings. Personal
 * controls (identity verification, two-factor authentication, linked sign-in
 * methods) live under "My account" → Settings (`/settings`), and are
 * deliberately not duplicated here.
 */
export function SecurityPage() {
  const { t } = useI18n();


  return (
    <TrustPage
      title="Security"
      lead="How BTCBOX protects accounts and funds, and the safeguards every user should enable."
    >
      <TrustSection title="Where 2FA is required" description="Two-factor authentication is enforced for the most sensitive actions.">
        <div className="space-y-3 p-4 sm:p-5">
          {[
            "Withdrawals",
            "Changing two-factor settings",
            "Linking or unlinking a sign-in method",
            "Changing your password",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5 text-[13px] sm:text-sm font-semibold text-brand-text">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent shrink-0" />
              {t(item)}
            </div>
          ))}
        </div>
      </TrustSection>

      <TrustSection title="Account safeguards" description="Controls you can enable to harden your own account.">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-start gap-3.5 rounded-lg border border-brand-border/40 bg-brand-surface-2/30 p-3 sm:p-3.5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" />
            <p className="text-[13px] sm:text-sm leading-relaxed text-brand-text-secondary">{t("Enable two-factor authentication to protect withdrawals and account changes.")}</p>
          </div>
          <div className="flex items-start gap-3.5 rounded-lg border border-brand-border/40 bg-brand-surface-2/30 p-3 sm:p-3.5">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-brand-text-muted" />
            <p className="text-[13px] sm:text-sm leading-relaxed text-brand-text-secondary">{t("Use a strong, unique password and avoid reusing it across other services.")}</p>
          </div>
          <div className="flex items-start gap-3.5 rounded-lg border border-brand-border/40 bg-brand-surface-2/30 p-3 sm:p-3.5">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-text-muted" />
            <p className="text-[13px] sm:text-sm leading-relaxed text-brand-text-secondary">{t("Verify your email address so account notices and confirmations reach you.")}</p>
          </div>
        </div>
      </TrustSection>

      <TrustSection title="Fund protection" description="How customer funds are held and what BTCBOX can and cannot do.">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-start gap-3.5 rounded-lg border border-brand-border/40 bg-brand-surface-2/30 p-3 sm:p-3.5">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand-text-muted" />
            <p className="text-[13px] sm:text-sm leading-relaxed text-brand-text-secondary">{t("Withdrawal addresses are immutable for end users; only support can change or unbind a saved address.")}</p>
          </div>
          <div className="flex items-start gap-3.5 rounded-lg border border-brand-border/40 bg-brand-surface-2/30 p-3 sm:p-3.5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-text-muted" />
            <p className="text-[13px] sm:text-sm leading-relaxed text-brand-text-secondary">{t("Withdrawals are reviewed by staff and paid manually after approval.")}</p>
          </div>
        </div>
      </TrustSection>
    </TrustPage>
  );
}

