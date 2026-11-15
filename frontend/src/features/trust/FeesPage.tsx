import { useEffect, useState } from "react";
import { getWithdrawalConfig, type WithdrawalConfig } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { PERP_FEES_ENABLED, PERP_FUNDING, SPOT_FEES_ENABLED } from "../../lib/feeSchedule";
import { TrustPage, TrustPending, TrustSection } from "./TrustLayout";

/**
 * Fee cards for the two trading products.
 *
 * The rates shown are the ones the schema enforces. Both products are currently
 * zero-fee, so the page states that plainly instead of inventing volume tiers —
 * a tier table for a fee that is not charged would mislead users into
 * expecting a discount they already have.
 */
function TradingFeeCard({ title, description, enabled }: { title: string; description: string; enabled: boolean }) {
  const { t } = useI18n();
  return (
    <TrustSection title={title} description={description}>
      <div className="px-3 py-4 sm:px-4">
        {enabled ? (
          <TrustPending message="The current fee schedule is being finalised." />
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tabular-nums text-brand-text">{t("Maker")} · 0%</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-brand-text">{t("Taker")} · 0%</p>
            </div>
            <span className="shrink-0 rounded border border-brand-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-text-muted">
              {t("No fee")}
            </span>
          </div>
        )}
      </div>
    </TrustSection>
  );
}

/** Extra perpetual parameters that are part of the cost of holding a position. */
function PerpCostNotes() {
  const { t } = useI18n();
  return (
    <TrustSection
      title="Perpetual funding and margin"
      description="Funding is exchanged between longs and shorts — it is not collected by BTCBOX."
    >
      <div>
        {[
          { label: "Funding interval", value: `${PERP_FUNDING.intervalHours} h` },
          { label: "Funding rate cap", value: `${PERP_FUNDING.rateCapPct}%` },
          { label: "Maintenance margin", value: `${PERP_FUNDING.maintenanceMarginPct}%` },
        ].map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-brand-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
            <span className="text-[12px] text-brand-text-muted">{t(row.label)}</span>
            <span className="shrink-0 text-right text-[12px] font-medium tabular-nums text-brand-text">{row.value}</span>
          </div>
        ))}
      </div>
    </TrustSection>
  );
}

/**
 * Network withdrawal fees, loaded from the server.
 *
 * A published fee that differs from the one charged is a trust failure, so this
 * section never guesses: while the request is in flight, or when it fails
 * because the visitor is signed out, it says so explicitly.
 */
function WithdrawalFees() {
  const { t } = useI18n();
  const [config, setConfig] = useState<WithdrawalConfig | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getWithdrawalConfig(controller.signal)
      .then((value) => { if (!controller.signal.aborted) setConfig(value); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  if (failed) {
    return (
      <div className="p-3 sm:p-4">
        <TrustPending message="Sign in to view live withdrawal fees. The exact fee is always shown on the Withdraw page before you confirm." />
      </div>
    );
  }
  if (!config) {
    return <div className="p-3 sm:p-4"><TrustPending message="Loading the current withdrawal fee schedule…" /></div>;
  }

  const rows = Object.entries(config.fees ?? {});
  if (rows.length === 0) return <div className="p-3 sm:p-4"><TrustPending /></div>;

  return (
    <div>
      {rows.map(([coin, fee]) => (
        <div key={coin} className="flex items-baseline justify-between gap-3 border-b border-brand-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
          <span className="text-[12px] font-medium text-brand-text">{coin}</span>
          <span className="text-right text-[12px] tabular-nums text-brand-text-muted">
            {t("Fee")} <span className="font-medium text-brand-text">{String(fee)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function FeesPage() {
  return (
    <TrustPage
      title="Fees and limits"
      lead="Every fee charged by BTCBOX is published here. Withdrawal fees are loaded from the server so they match what you are quoted at checkout."
    >
      <TradingFeeCard
        title="Spot trading fees"
        description="Charged on each filled order. Both sides of the book pay the same rate."
        enabled={SPOT_FEES_ENABLED}
      />

      <TradingFeeCard
        title="Perpetual contract fees"
        description="Charged on open and close. Funding payments are separate and are listed below."
        enabled={PERP_FEES_ENABLED}
      />

      <PerpCostNotes />

      <TrustSection
        title="Withdrawal fees"
        description="Network fees are set per asset, and are shown again on the Withdraw page before you confirm."
      >
        <WithdrawalFees />
      </TrustSection>

      <TrustSection
        title="Deposit fees"
        description="BTCBOX does not charge a fee for deposits. The sending platform or network may charge its own fee."
      >
        <div className="px-3 py-4 sm:px-4">
          <p className="text-[13px] font-semibold tabular-nums text-brand-text">0</p>
        </div>
      </TrustSection>
    </TrustPage>
  );
}
