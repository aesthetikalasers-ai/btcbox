import { Link, useLocation } from "react-router-dom";
import { ArrowLeftRight, CandlestickChart, Sprout, TrendingUp } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";

type ProductKey = "spot" | "perpetual" | "seconds" | "earn";

const PRODUCTS: Array<{
  key: ProductKey;
  label: string;
  /** Fixed English sub-label shown beneath the translated primary label. */
  subLabel: string;
  to: string;
  icon: typeof TrendingUp;
}> = [
  { key: "spot", label: "Spot", subLabel: "Spot", to: "/trade/BTCUSDT", icon: CandlestickChart },
  { key: "perpetual", label: "Perpetual", subLabel: "Perp", to: "/contract", icon: TrendingUp },
  { key: "seconds", label: "Seconds", subLabel: "Seconds", to: "/seconds", icon: ArrowLeftRight },
  { key: "earn", label: "Earn", subLabel: "Earn", to: "/earn", icon: Sprout },
];

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
 * - Ambient emerald background glow so the dark bar never feels flat.
 * - Active tab = high-contrast label + emerald glowing underline.
 * - Dual-line label (translated primary + fixed English sub-label).
 * - Routing is preserved via <Link>; each product is a distinct page.
 */
export function TradeProductNav({ leftIndent = "px-3.5 sm:px-4 md:px-6 lg:px-8" }: { leftIndent?: string } = {}) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const active = activeProduct(pathname);

  return (
    <nav
      aria-label={t("Trade products")}
      className="relative overflow-hidden bg-brand-bg"
    >
      {/* Ambient background glow (non-interactive, pointer-events-none). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[180px] w-[280px] -translate-x-1/2 rounded-full bg-brand-accent/10 blur-[90px]"
      />
      {/* Tight upper-right highlight core for layered breathing glow. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-6 right-10 h-36 w-36 rounded-full bg-brand-accent/20 blur-[45px]"
      />

      <div className={cn("relative flex min-w-full items-stretch gap-5 overflow-x-auto no-scrollbar", leftIndent)}>
        {PRODUCTS.map(({ key, label, to, icon: Icon }) => {
          const isActive = active === key;
          return (
            <Link
              key={key}
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex min-h-12 shrink-0 flex-col items-start justify-center py-2.5 transition-all duration-200",
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icon className={cn("h-4 w-4 shrink-0 transition-colors duration-200", isActive ? "text-brand-accent" : "text-brand-text-muted")} />
                <span
                  className={cn(
                    "whitespace-nowrap text-[13px] tracking-wide transition-colors duration-200 sm:text-sm",
                    isActive ? "font-semibold text-brand-text" : "font-medium text-brand-text-muted hover:text-brand-text",
                  )}
                >
                  {t(label)}
                </span>
              </span>
              {/* Emerald glowing active underline. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-transform duration-300 ease-out",
                  isActive
                    ? "bg-brand-accent shadow-[0_0_8px_rgba(14,203,129,0.6)] scale-x-100"
                    : "bg-transparent scale-x-0 group-hover:scale-x-50 group-hover:bg-brand-accent/40",
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
