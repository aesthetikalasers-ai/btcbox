import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";

const LINKS: Array<{ to: string; label: string }> = [
  { to: "/trust", label: "Trust center" },
  { to: "/fees", label: "Fees and limits" },
  { to: "/rules", label: "Trading rules" },
  { to: "/risk", label: "Risk disclosure" },
  { to: "/support", label: "Support" },
];

/**
 * Compact site footer.
 *
 * On desktop the trust links render as a single inline row. On mobile they are
 * collapsed behind a disclosure toggle so the footer never becomes a wall of
 * links under the terminal. Every label is translated; nothing is hard-coded
 * English.
 */
export function SiteFooter() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <footer className="mt-2 border-t border-brand-border px-4 py-3 sm:px-6 sm:py-4">
      <nav aria-label={t("Trust and legal")} className="hidden flex-wrap gap-x-4 gap-y-2 sm:flex">
        {LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="text-[11px] text-brand-text-muted transition-colors hover:text-brand-text">
            {t(link.label)}
          </Link>
        ))}
      </nav>

      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between rounded-lg text-[11px] font-medium text-brand-text-muted transition-colors hover:text-brand-text"
        >
          <span>{t("Trust and legal")}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open ? (
          <nav aria-label={t("Trust and legal")} className="grid grid-cols-2 gap-x-3 gap-y-1.5 pb-1 pt-1">
            {LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="min-h-8 truncate text-[11px] leading-8 text-brand-text-muted transition-colors hover:text-brand-text">
                {t(link.label)}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-brand-text-disabled">
        {t("Trading digital assets involves substantial risk of loss. Past performance is not indicative of future results.")}
      </p>
    </footer>
  );
}
