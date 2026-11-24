import { PERP_RULES, SECONDS_RULES, SPOT_RULES, type TradingRule } from "../../lib/feeSchedule";
import { TrustPage, TrustRow, TrustSection } from "./TrustLayout";

function RuleList({ rules }: { rules: TradingRule[] }) {
  return (
    <div>
      {rules.map((rule, index) => (
        <div key={`${rule.label}-${index}`}>
          <TrustRow label={rule.label} value={rule.value} />
        </div>
      ))}
    </div>
  );
}

export function RulesPage() {
  return (
    <TrustPage
      title="Trading rules"
      lead="How each BTCBOX product behaves. Pair-specific values such as price precision and maximum leverage are shown on the Markets and Contract pages, because they differ per market."
    >
      <TrustSection title="Spot" description="Buying and selling listed assets against USDT.">
        <RuleList rules={SPOT_RULES} />
      </TrustSection>

      <TrustSection title="Perpetual contract" description="Leveraged positions that do not expire.">
        <RuleList rules={PERP_RULES} />
      </TrustSection>

      <TrustSection title="Seconds" description="Short-duration directional rounds with a fixed payout.">
        <RuleList rules={SECONDS_RULES} />
      </TrustSection>
    </TrustPage>
  );
}
