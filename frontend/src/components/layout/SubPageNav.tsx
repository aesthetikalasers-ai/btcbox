import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";
import { getNavigationTier, getTierFallback, useHistoryDepth } from "../../lib/navigation";

/**
 * Uses real browser history when the session has an in-app entry to return to,
 * and otherwise performs a deterministic navigation to the tier's parent page.
 * This keeps deep-linked sub-pages from throwing the user out of BTCBOX.
 */
function goBack(navigate: ReturnType<typeof useNavigate>, pathname: string, historyDepth: number) {
  // React Router's idx counts only in-app history entries; window.history.length also
  // includes the external page that may have opened a deep link into BTCBOX.
  if (historyDepth > 0) navigate(-1);
  else navigate(getTierFallback(getNavigationTier(pathname)), { replace: true });
}

/**
 * Unified secondary header for sub-pages.
 *
 * Left-aligned back button, optically centered title. The title is centred against
 * the full bar width while the back button sits in a reserved left gutter, so long
 * translations never push the title off-centre. On desktop the gutter mirrors the
 * right side, keeping the title visually centred inside the content column.
 */
export function SubPageNav({ title, backLabel, actions, sticky = true, className }: {
  title: string;
  /** Optional override for the accessible name of the back control. */
  backLabel?: string;
  /** Optional trailing controls; kept out of the centring calculation. */
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const historyDepth = useHistoryDepth();
  const label = backLabel ?? t("Back");

  return (
    <nav
      aria-label={t("Secondary navigation")}
      className={cn(
        "bf-subnav relative z-30 flex min-h-14 shrink-0 items-center border-b border-brand-border bg-brand-bg/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-xl",
        sticky && "bf-subnav--sticky",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => goBack(navigate, pathname, historyDepth)}
        aria-label={label}
        className="bf-subnav-back relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* Absolute centring keeps the title mathematically centred in the bar. */}
      <h1 className="bf-subnav-title pointer-events-none absolute inset-x-14 top-1/2 -translate-y-1/2 truncate text-center text-[15px] font-semibold leading-tight text-brand-text">
        {title}
      </h1>

      <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1">
        {actions}
        {/* Invisible spacer mirrors the back button so the title stays centred. */}
        <span aria-hidden="true" className="h-11 w-11 shrink-0" />
      </div>
    </nav>
  );
}
