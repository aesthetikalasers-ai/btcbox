import { TriangleAlert } from "lucide-react";
import { RISK_DISCLOSURES } from "../../lib/feeSchedule";
import { useI18n } from "../../lib/i18n";
import { TrustPage, TrustSection } from "./TrustLayout";

export function RiskPage() {
  const { t } = useI18n();
  return (
    <TrustPage
      title="Risk disclosure"
      lead="Trading digital assets carries a high risk of loss. Read this before you deposit or trade."
    >
      <section className="overflow-hidden rounded-md border border-brand-border bg-brand-surface">
        <div className="flex items-start gap-2.5 border-b border-brand-border bg-brand-danger/[0.06] px-4 py-3.5 sm:px-5 sm:py-4">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand-danger" />
          <p className="text-[13px] font-medium leading-relaxed text-brand-text-secondary">
            {t("You may lose the entire amount you deposit. Do not trade with funds you cannot afford to lose.")}
          </p>
        </div>
        <div>
          {RISK_DISCLOSURES.map((item) => (
            <div key={item.title} className="border-b border-brand-border/60 px-4 py-4 sm:px-5 sm:py-5 last:border-b-0">
              <h3 className="text-[14px] sm:text-[15px] font-bold text-brand-text tracking-tight">{t(item.title)}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-brand-text-secondary">{t(item.body)}</p>
            </div>
          ))}
        </div>
      </section>

      <TrustSection title="Your responsibilities" description="Conditions you accept by using the platform.">
        <div className="space-y-3 p-4 sm:p-5">
          {[
            "You are responsible for securing your login credentials and two-factor device.",
            "You are responsible for confirming the asset, network and address of every withdrawal.",
            "You must complete identity verification before withdrawing.",
            "You must comply with the laws and tax rules that apply where you live.",
          ].map((line) => (
            <div key={line} className="flex items-start gap-2.5 text-[13px] sm:text-sm leading-relaxed text-brand-text-secondary">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-accent shrink-0" />
              <span>{t(line)}</span>
            </div>
          ))}
        </div>
      </TrustSection>
    </TrustPage>
  );
}
