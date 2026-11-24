import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";

export interface BottomOrderTab {
  /** Stable key the page uses to pick its body. */
  key: string;
  /** Already-localised label, usually `t("Positions")` + a count. */
  label: string;
}

interface BottomOrderPanelProps {
  tabs: BottomOrderTab[];
  active: string;
  onActiveChange: (key: string) => void;
  expanded: boolean;
  onToggle: () => void;
  /** Accessible name for the tab strip. */
  ariaLabel: string;
  id?: string;
  bodyId?: string;
  className?: string;
  /** Right-aligned controls before the collapse toggle (e.g. a refresh button). */
  trailing?: ReactNode;
  children: ReactNode;
}

/**
 * Bottom order / position panel shared by the spot, perpetual and seconds
 * terminals.
 *
 * Why one component: the three products each grew their own tab strip (different
 * min-height, different underline, different collapse arrow), so the same
 * interaction looked different depending on the product the customer opened.
 * This renders one strip with one set of tokens:
 *
 *   - horizontal scroll with `shrink-0` tabs (long localised labels never wrap
 *     or hard-clip on 320px),
 *   - 2px accent underline on the active tab,
 *   - one 36/44px toggle whose arrow is the same everywhere,
 *   - `BottomPanelEmpty` for the shared empty state.
 *
 * Pages own the tab list and the body; this only owns the chrome.
 */
export function BottomOrderPanel({
  tabs,
  active,
  onActiveChange,
  expanded,
  onToggle,
  ariaLabel,
  id,
  bodyId = "trade-orders-body",
  className,
  trailing,
  children,
}: BottomOrderPanelProps) {
  const { t } = useI18n();
  return (
    <section id={id} className={cn("bf-bottom-panel min-w-0", className)}>
      <div className="bf-tab-strip" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={expanded && active === tab.key}
            aria-controls={bodyId}
            className={cn("bf-tab-strip__tab", expanded && active === tab.key && "is-active")}
            onClick={() => onActiveChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        <div className="bf-tab-strip__actions">
          {trailing}
          <button
            type="button"
            className="bf-tab-toggle"
            aria-expanded={expanded}
            aria-controls={bodyId}
            aria-label={expanded ? t("Collapse") : t("Expand")}
            title={expanded ? t("Collapse") : t("Expand")}
            onClick={onToggle}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {expanded ? <div id={bodyId} className="bf-tab-body">{children}</div> : null}
    </section>
  );
}

/** One empty state for every bottom panel, so "no rows yet" reads identically. */
export function BottomPanelEmpty({ children }: { children: ReactNode }) {
  return <p className="bf-tab-empty">{children}</p>;
}