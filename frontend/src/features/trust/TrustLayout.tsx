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
    <main className="mx-auto flex w-full min-w-0 max-w-[960px] flex-col gap-6 px-4 py-6 text-brand-text sm:px-6 sm:py-8 lg:px-8">
      <header className="flex min-w-0 items-start gap-3 border-b border-brand-border/70 pb-5">
        <Link
          to="/me"
          aria-label={t("Back")}
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:bg-brand-surface-2 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-brand-text sm:text-[28px]">{t(title)}</h1>
          {lead ? <p className="mt-2 max-w-[72ch] text-[14px] leading-7 text-brand-text-secondary sm:text-[15px]">{t(lead)}</p> : null}
        </div>
      </header>
      <div className="min-w-0 space-y-6 text-[14px] leading-7 text-brand-text-secondary sm:text-[15px]">
        {children}
      </div>
    </main>
  );
}

/** A titled block separated from its neighbours by a hairline rule. */
export function TrustSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
      <div className="border-b border-brand-border px-4 py-4 sm:px-5 sm:py-5">
        <h2 className="text-[15px] font-semibold leading-6 text-brand-text sm:text-base">{t(title)}</h2>
        {description ? <p className="mt-1.5 max-w-[76ch] text-[13px] leading-6 text-brand-text-muted sm:text-sm">{t(description)}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Definition row used by the rules and fee tables. */
export function TrustRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 border-b border-brand-border/60 px-4 py-4 last:border-b-0 sm:px-5 sm:py-4">
      <span className="min-w-0 text-[14px] leading-6 text-brand-text-muted">{t(label)}</span>
      <span className="min-w-0 shrink-0 text-right text-[14px] font-semibold leading-6 text-brand-text">{t(value)}</span>
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
