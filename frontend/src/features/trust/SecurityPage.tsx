import { KeyRound, Lock, MailCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { TrustPage, TrustSection } from "../trust/TrustLayout";

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
        <div className="space-y-2 p-3 sm:p-4">
          {[
            "Withdrawals",
            "Changing two-factor settings",
            "Linking or unlinking a sign-in method",
            "Changing your password",
          ].map((item) => (
            <p key={item} className="text-[12px] leading-relaxed text-brand-text-muted">{t(item)}</p>
          ))}
        </div>
      </TrustSection>

      <TrustSection title="Account safeguards" description="Controls you can enable to harden your own account.">
        <div className="space-y-2 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-accent" />
            <p className="text-[12px] leading-relaxed text-brand-text-muted">{t("Enable two-factor authentication to protect withdrawals and account changes.")}</p>
          </div>
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 shrink-0 text-brand-text-muted" />
            <p className="text-[12px] leading-relaxed text-brand-text-muted">{t("Use a strong, unique password and avoid reusing it across other services.")}</p>
          </div>
          <div className="flex items-center gap-3">
            <MailCheck className="h-4 w-4 shrink-0 text-brand-text-muted" />
            <p className="text-[12px] leading-relaxed text-brand-text-muted">{t("Verify your email address so account notices and confirmations reach you.")}</p>
          </div>
        </div>
      </TrustSection>

      <TrustSection title="Fund protection" description="How customer funds are held and what BTCBOX can and cannot do.">
        <div className="space-y-2 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 shrink-0 text-brand-text-muted" />
            <p className="text-[12px] leading-relaxed text-brand-text-muted">{t("Withdrawal addresses are immutable for end users; only support can change or unbind a saved address.")}</p>
          </div>
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-brand-text-muted" />
            <p className="text-[12px] leading-relaxed text-brand-text-muted">{t("Withdrawals are reviewed by staff and paid manually after approval.")}</p>
          </div>
        </div>
      </TrustSection>
    </TrustPage>
  );
}

