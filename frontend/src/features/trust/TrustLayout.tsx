import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "../../lib/i18n";

/**
 * Shared shell for the informational trust pages (fees, rules, risk, status).
 *
 * These pages are read-only reference material, so the layout is deliberately
 * quiet: a page title, an optional lead paragraph, then hairline-separated
 * sections. No cards stacked on cards, no marketing gradients — the content is
 * the product here.
 */
export function TrustPage({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-4 p-4 sm:p-6">
      {/* Ambient multi-layer glow + glass highlight, matching the rest of the app. */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-10 h-36 w-36 rounded-full bg-brand-accent/20 blur-[45px]" />
      <header className="relative flex min-w-0 items-start gap-3">
        <Link
          to="/me"
          aria-label={t("Back")}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand-border text-brand-text-muted transition-colors hover:border-brand-border-strong hover:text-brand-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold leading-tight text-brand-text">{t(title)}</h1>
          {lead ? <p className="mt-1 text-[12px] leading-relaxed text-brand-text-muted">{t(lead)}</p> : null}
        </div>
      </header>
      {children}
    </div>
  );
}

/** A titled block separated from its neighbours by a hairline rule. */
export function TrustSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="overflow-hidden rounded-md border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
      <div className="border-b border-brand-border px-3 py-2.5 sm:px-4">
        <h2 className="text-[13px] font-semibold text-brand-text">{t(title)}</h2>
        {description ? <p className="mt-0.5 text-[11px] leading-relaxed text-brand-text-muted">{t(description)}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Definition row used by the rules and fee tables. */
export function TrustRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-brand-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
      <span className="min-w-0 text-[12px] text-brand-text-muted">{t(label)}</span>
      <span className="min-w-0 shrink-0 text-right text-[12px] font-medium text-brand-text">{t(value)}</span>
    </div>
  );
}

/** Notice strip for the "value not yet confirmed" case. */
export function TrustPending({ message = "Pending confirmation by BTCBOX." }: { message?: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-brand-border bg-brand-surface-2 px-3 py-2.5">
      <p className="text-[11px] leading-relaxed text-brand-text-muted">{t(message)}</p>
    </div>
  );
}
