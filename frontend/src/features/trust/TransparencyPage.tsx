import { useI18n } from "../../lib/i18n";
import { TrustPage, TrustSection } from "./TrustLayout";

/**
 * Customer-facing transparency.
 *
 * Two hard rules for this page:
 *   1. Never state a reserve ratio, audit result or wallet balance that has not
 *      been independently verified — an unverifiable claim is worse than none.
 *   2. Describe only what a customer needs in order to move funds safely. Internal
 *      operating detail (manual crediting steps, staff review queues, ledger and
 *      audit-log internals) is deliberately not published here: it is not customer
 *      guidance, and it tells anyone probing the platform how the back office works.
 */
export function TransparencyPage() {
  const { t } = useI18n();

  const deposits: Array<{ title: string; body: string }> = [
    {
      title: "Only send supported assets on the correct network",
      body: "Use the deposit address shown for the asset and network you selected. Funds sent on an unsupported network, or to an address that is not yours, may be permanently lost.",
    },
    {
      title: "Deposits are verified before crediting",
      body: "A deposit appears in your deposit history once the incoming transfer has been verified on-chain. Credit can take longer than the network confirmation time.",
    },
  ];

  const withdrawals: Array<{ title: string; body: string }> = [
    {
      title: "Identity verification is required",
      body: "You must complete identity verification before withdrawing.",
    },
    {
      title: "Two-factor authentication is required",
      body: "A time-based code from your authenticator app is required for withdrawals and sensitive changes.",
    },
    {
      title: "Every withdrawal is reviewed",
      body: "Withdrawal requests are checked before the transfer is sent. A request can be delayed or declined if identity verification is incomplete or a risk check is triggered. You can follow its status in withdrawal history.",
    },
    {
      title: "Fees are shown before you confirm",
      body: "Network fees are set per asset, and are shown again on the Withdraw page before you confirm.",
    },
  ];

  const responsibilities = [
    "You are responsible for confirming the asset, network and address of every withdrawal.",
    "You must complete identity verification before withdrawing.",
    "You are responsible for securing your login credentials and two-factor device.",
  ];

  return (
    <TrustPage
      title="Transparency"
      lead="How deposits and withdrawals work, and the rules that protect your funds."
    >
      <TrustSection
        title="Deposits"
        description="What happens after you send funds to your BTCBOX deposit address."
      >
        <div>
          {deposits.map((item) => (
            <div key={item.title} className="border-b border-brand-border/60 px-4 py-4 sm:px-5 sm:py-5 last:border-b-0">
              <h3 className="text-[14px] sm:text-[15px] font-bold text-brand-text tracking-tight">{t(item.title)}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-brand-text-secondary">{t(item.body)}</p>
            </div>
          ))}
        </div>
      </TrustSection>

      <TrustSection
        title="Withdrawals"
        description="Conditions that apply before a withdrawal is sent."
      >
        <div>
          {withdrawals.map((item) => (
            <div key={item.title} className="border-b border-brand-border/60 px-4 py-4 sm:px-5 sm:py-5 last:border-b-0">
              <h3 className="text-[14px] sm:text-[15px] font-bold text-brand-text tracking-tight">{t(item.title)}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-brand-text-secondary">{t(item.body)}</p>
            </div>
          ))}
        </div>
      </TrustSection>

      <TrustSection title="Irreversible blockchain transfers">
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-[13px] leading-relaxed text-brand-text-secondary">
            {t("Crypto deposits and withdrawals are irreversible. Sending an asset on the wrong network, or to an address you do not control, results in permanent loss that BTCBOX cannot recover.")}
          </p>
        </div>
      </TrustSection>

      <TrustSection title="Your responsibilities">
        <div className="space-y-3 p-4 sm:p-5">
          {responsibilities.map((line) => (
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
