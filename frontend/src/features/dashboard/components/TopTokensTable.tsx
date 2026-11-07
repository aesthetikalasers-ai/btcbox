import { Card } from "./Card";
import { TokenIcon } from "../../../components/ui/TokenIcon";
import type { MarketTicker } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";

function price(value: number) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: value >= 1 ? 4 : 8 }) : "—";
}

export function TopTokensTable({ markets = [] }: { markets?: MarketTicker[] }) {
  const { t } = useI18n();
  return (
    <Card className="flex flex-col overflow-hidden px-0 py-0">
      <div className="border-b border-brand-border px-4 py-4 md:px-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-brand-text">{t("Top tokens")}</h2>
        <p className="mt-1 text-xs text-brand-text-muted">{t("Live market data supplied by BTCBOX")}</p>
      </div>
      {markets.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-brand-text-muted">{t("No live market data is available.")}</div>
      ) : (
        <div role="region" aria-label={t("Top token market data")} tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/60">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead><tr className="border-b border-brand-border bg-brand-surface-2/70">
              {["Asset", "Last price", "24h change", "24h volume"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-brand-text-muted md:px-6">{t(label)}</th>)}
            </tr></thead>
            <tbody>{markets.map((item) => (
              <tr key={item.sym} className="border-b border-brand-border/50 last:border-0 hover:bg-brand-surface-hover">
                <td className="h-16 whitespace-nowrap px-4 py-2 md:px-6"><div className="flex items-center gap-3"><TokenIcon symbol={item.sym} className="h-8 w-8"/><div><p className="text-sm font-semibold text-brand-text">{item.sym}/USDT</p><p className="text-xs text-brand-text-muted">{item.source}</p></div></div></td>
                <td className="whitespace-nowrap px-4 text-sm font-semibold tabular-nums text-brand-text md:px-6">{price(item.price)}</td>
                <td className={`whitespace-nowrap px-4 text-sm font-semibold tabular-nums md:px-6 ${item.chg >= 0 ? "text-profit" : "text-loss"}`}>{item.chg > 0 ? "+" : ""}{item.chg.toFixed(2)}%</td>
                <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{item.vol} USDT</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
