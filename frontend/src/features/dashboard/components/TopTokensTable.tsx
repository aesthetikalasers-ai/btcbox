import { Card } from "./Card";
import { TokenIcon } from "../../../components/ui/TokenIcon";
import type { MarketTicker } from "../../../lib/api";
import { useI18n, localeTags } from "../../../lib/i18n";

function price(value: number, locale: string) {
  return Number.isFinite(value) ? value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: value >= 1 ? 4 : 8 }) : "—";
}

export function TopTokensTable({ markets = [] }: { markets?: MarketTicker[] }) {
  const { t, language } = useI18n();
  const numberLocale = localeTags[language];
  return (
    <Card className="flex scroll-mt-24 flex-col overflow-hidden px-0 py-0">
      <div className="border-b border-brand-border px-4 py-4 md:px-6">
        <h2 className="type-section-title text-brand-text">{t("Top tokens")}</h2>
      </div>
      {markets.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-brand-text-muted">{t("No live market data is available.")}</div>
      ) : (
        <div role="region" aria-label={t("Top token market data")} tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/60">
          <table className="w-full min-w-[420px] border-collapse">
            <thead><tr className="border-b border-brand-border bg-brand-surface-2/70">
              {["Asset", "Last price", "24h change"].map((label, index) => <th key={label} className={"whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-brand-text-faint md:px-6 " + (index === 0 ? "text-left" : "text-right")}>{t(label)}</th>)}
            </tr></thead>
            <tbody>{markets.map((item) => (
              <tr key={item.sym} className="border-b border-brand-border-subtle transition-colors last:border-0 hover:bg-brand-surface-hover">
                <td className="h-16 whitespace-nowrap px-4 py-2 text-left md:px-6"><div className="flex items-center gap-3"><TokenIcon symbol={item.sym} className="h-8 w-8 shrink-0"/><p className="text-sm font-semibold text-brand-text">{item.sym}/USDT</p></div></td>
                <td className="whitespace-nowrap px-4 text-right font-mono text-base font-semibold tabular-nums text-brand-text md:px-6">{price(item.price, numberLocale)}</td>
                <td className="whitespace-nowrap px-4 text-right md:px-6"><span className={`inline-flex min-w-[76px] justify-center rounded-md px-2.5 py-1 text-xs font-bold tabular-nums text-white ${item.chg >= 0 ? "bg-profit" : "bg-loss"}`}>{item.chg > 0 ? "+" : ""}{item.chg.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
