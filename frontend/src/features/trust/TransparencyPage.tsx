import { useI18n } from "../../lib/i18n";
import { TrustPage, TrustSection } from "./TrustLayout";

/**
 * Custody transparency.
 *
 * Two hard rules for this page:
 *   1. Never state a reserve ratio, audit result or wallet balance that has not
 *      been independently verified — an unverifiable claim is worse than none.
 *   2. Describe only mechanics that are actually implemented. The deposit flow
 *      in this codebase credits accounts manually after staff verification, so
 *      that is what this page says.
 */
export function TransparencyPage() {
  const { t } = useI18n();

  const mechanics: Array<{ title: string; body: string }> = [
    {
      title: "Deposits are verified before crediting",
      body: "An incoming transfer does not credit your balance automatically. BTCBOX staff verify receipt on-chain and then credit your account manually, which is why deposits can take longer than the network confirmation time.",
    },
    {
      title: "Withdrawals are reviewed before broadcast",
      body: "Every withdrawal request enters a review queue. Staff approve the request, then the transfer is broadcast manually. You can follow the status of each request under Withdrawals in Assets.",
    },
    {
      title: "The ledger is double-entry and append-only",
      body: "Balance changes are recorded as ledger entries with a request identifier, so a retry cannot post twice. Audit records are append-only and cannot be edited after the fact.",
    },
    {
      title: "Staff cannot silently move funds",
      body: "Administrative adjustments require an authorised role and are written to an audit log that the operator can review. Customer balances and operator actions are recorded separately.",
    },
  ];

  return (
    <TrustPage
      title="Transparency"
      lead="How BTCBOX handles customer funds and what you should expect when you deposit or withdraw."
    >
      <TrustSection title="How custody works">
        <div>
          {mechanics.map((item) => (
            <div key={item.title} className="border-b border-brand-border/60 px-3 py-3.5 last:border-b-0 sm:px-4">
              <h3 className="text-[12.5px] font-semibold text-brand-text">{t(item.title)}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-brand-text-muted">{t(item.body)}</p>
            </div>
          ))}
        </div>
      </TrustSection>

      {/* Reserve attestation is intentionally shown as not-yet-published rather
          than as an empty table, so nobody reads the absence of data as a claim. */}
      <TrustSection
        title="Proof of reserves"
        description="An independent attestation of customer liabilities against held assets."
      >
        <div className="px-3 py-6 text-center sm:px-4">
          <p className="text-[12px] font-medium text-brand-text-secondary">{t("No independent attestation has been published yet.")}</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-brand-text-muted">
            {t("BTCBOX will publish the auditor name, reporting period and methodology here once an attestation is complete. Until then, no reserve ratio is claimed on this page.")}
          </p>
        </div>
      </TrustSection>

      <TrustSection
        title="Security incidents"
        description="Any incident affecting customer funds or data is disclosed here."
      >
        <div className="px-3 py-6 text-center sm:px-4">
          <p className="text-[12px] text-brand-text-muted">{t("No incidents have been reported.")}</p>
        </div>
      </TrustSection>
    </TrustPage>
  );
}
