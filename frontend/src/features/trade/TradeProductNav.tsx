import { Link, useLocation } from "react-router-dom";
import { ArrowLeftRight, CandlestickChart, Sprout, TrendingUp } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";

type ProductKey = "spot" | "perpetual" | "seconds" | "earn";

const PRODUCTS: Array<{
  key: ProductKey;
  label: string;
  to: string;
  icon: typeof TrendingUp;
  /** Tailwind text/border/underline color classes — all existing @theme tokens, no new hex values. */
  activeClass: string;
}> = [
  { key: "spot", label: "Spot", to: "/trade/BTCUSDT", icon: CandlestickChart, activeClass: "text-brand-accent" },
  { key: "perpetual", label: "Perpetual", to: "/contract", icon: TrendingUp, activeClass: "text-brand-violet" },
  { key: "seconds", label: "Seconds", to: "/seconds", icon: ArrowLeftRight, activeClass: "text-brand-warning" },
  { key: "earn", label: "Earn", to: "/earn", icon: Sprout, activeClass: "text-brand-info" },
];

/** Underline accent color per product (used for the animated indicator span). */
const UNDERLINE: Record<ProductKey, string> = {
  spot: "bg-brand-accent",
  perpetual: "bg-brand-violet",
  seconds: "bg-brand-warning",
  earn: "bg-brand-info",
};

function activeProduct(pathname: string): ProductKey | null {
  if (pathname.startsWith("/contract")) return "perpetual";
  if (pathname.startsWith("/seconds")) return "seconds";
  if (pathname.startsWith("/earn")) return "earn";
  // Spot lives at /trade/:symbol (the hub at /trade-hub is not a product).
  if (/^\/trade\//.test(pathname)) return "spot";
  return null;
}

/**
 * Top product navigation bar: Spot / Perpetual / Seconds / Earn.
 * - Active tab = animated underline in that product's accent color.
 * - Mobile: compact horizontally scrollable row (scrollbar hidden), touch targets >= 40px.
 * - Desktop: inline row. Colors use existing @theme tokens only.
 */
export function TradeProductNav() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const active = activeProduct(pathname);

  return (
    <nav
      aria-label={t("Trade products")}
      className="trade-nav-scroll -mx-3 overflow-x-auto border-b border-brand-border bg-brand-surface/60 backdrop-blur-sm sm:-mx-4 md:-mx-6 lg:-mx-8"
    >
      <div className="flex min-w-full items-stretch px-3 sm:px-4 md:px-6 lg:px-8">
        {PRODUCTS.map(({ key, label, to, icon: Icon, activeClass }) => {
          const isActive = active === key;
          return (
            <Link
              key={key}
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex min-h-10 shrink-0 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 sm:px-4 sm:text-sm",
                isActive ? activeClass : "text-brand-text-muted hover:text-brand-text-secondary",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{t(label)}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-transform duration-300 ease-out sm:inset-x-4",
                  UNDERLINE[key],
                  isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50",
                )}
                style={{ transformOrigin: "center" }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
