import { Link } from "react-router-dom";
import { ArrowRight, CircleDollarSign, FileText, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { TrustPage } from "./TrustLayout";

const ENTRIES = [
  { to: "/security", icon: ShieldCheck, title: "Security", body: "Two-factor authentication, sign-in methods and verification status." },
  { to: "/transparency", icon: Wallet, title: "Transparency", body: "How customer funds are held, and what BTCBOX can and cannot do with them." },
  { to: "/fees", icon: CircleDollarSign, title: "Fees and limits", body: "Spot, perpetual and withdrawal fees, with volume tiers." },
  { to: "/rules", icon: FileText, title: "Trading rules", body: "Order types, precision, funding and settlement behaviour." },
  { to: "/risk", icon: ShieldAlert, title: "Risk disclosure", body: "What you can lose, and the risks specific to each product." },
];

/**
 * Trust centre — the single entry point for everything a cautious user wants to
 * verify before depositing. Keeping these links in one place (rather than
 * scattering them in a footer only) is the point of this page.
 */
export function TrustCenterPage() {
  const { t } = useI18n();
  return (
    <TrustPage
      title="Trust centre"
      lead="Everything BTCBOX publishes about how it operates: fees, rules, risk and live system status."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {ENTRIES.map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            className="group flex min-w-0 items-start gap-3 rounded-md border border-brand-border bg-brand-surface p-3 transition-colors hover:border-brand-border-strong hover:bg-brand-surface-hover sm:p-3.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand-surface-2 text-brand-text-muted transition-colors group-hover:text-brand-accent">
              <entry.icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[13px] font-semibold text-brand-text">
                {t(entry.title)}
                <ArrowRight className="h-3 w-3 shrink-0 text-brand-text-disabled transition-colors group-hover:text-brand-accent" />
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-brand-text-muted">{t(entry.body)}</span>
            </span>
          </Link>
        ))}
      </div>
    </TrustPage>
  );
}
