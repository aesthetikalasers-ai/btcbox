import { TokenIcon } from "../../../components/ui/TokenIcon";
import { Card } from "./Card";
import type { MarketTicker } from "../../../lib/api";
import { useI18n, type Language } from "../../../lib/i18n";

const names: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB",
  XRP: "XRP", DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche",
  LINK: "Chainlink", DOT: "Polkadot", TRX: "TRON", LTC: "Litecoin",
  BCH: "Bitcoin Cash", NEAR: "NEAR Protocol", UNI: "Uniswap",
  ATOM: "Cosmos", ETC: "Ethereum Classic",
};

const numberLocales: Record<Language, string> = {
  en: "en-US", ja: "ja-JP", "zh-CN": "zh-CN", es: "es-ES", vi: "vi-VN", it: "it-IT", pt: "pt-PT",
};

const price = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: value >= 1 ? 4 : 8,
}).format(value);

function Change({ value, locale }: { value: number; locale: string }) {
  return <span className={`inline-flex min-w-[76px] justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums ${value >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
    {value > 0 ? "+" : ""}{value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
  </span>;
}

export function LiveMarketsTable({ markets, loading, error }: {
  markets: MarketTicker[];
  loading: boolean;
  error: string;
}) {
  const { t, language } = useI18n();
  const numberLocale = numberLocales[language];
  return (
    <Card className="flex flex-col overflow-hidden px-0 py-0">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-4 md:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-brand-text">{t("Spot markets")}</h2>
          <p className="mt-1 text-xs text-brand-text-muted">{t("Live prices from the BTCBOX market service")}</p>
        </div>
        <span className="shrink-0 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-xs font-semibold text-brand-text-secondary">
          {loading ? t("Loading…") : `${markets.length} ${t("pairs")}`}
        </span>
      </div>
      {error ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-brand-text">{t("Market feed unavailable")}</p>
          <p className="mt-2 break-words text-sm text-brand-text-muted">{error}</p>
        </div>
      ) : loading && markets.length === 0 ? (
        <div className="space-y-3 px-5 py-8" aria-label="Loading markets">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white/[0.05]" />)}
        </div>
      ) : markets.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-brand-text-muted">{t("No market pairs are currently available.")}</div>
      ) : (
        <>
          <div className="divide-y divide-brand-border/70 sm:hidden">
            {markets.map((item) => (
              <div key={item.sym} className="flex min-h-[76px] items-center justify-between gap-3 px-4 py-3 transition-colors active:bg-brand-surface-hover">
                <div className="flex min-w-0 items-center gap-3">
                  <TokenIcon symbol={item.sym} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-text">{item.sym}/USDT</p>
                    <p className="type-meta mt-0.5 truncate text-brand-text-muted">{names[item.sym] || item.sym}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="type-body font-bold tabular-nums text-brand-text">{price(item.price, numberLocale)}</span>
                  <Change value={item.chg} locale={numberLocale} />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden w-full overflow-x-auto sm:block">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead><tr className="border-b border-brand-border bg-brand-surface-2/70">
                {["Asset", "Last price", "24h change", "24h volume", "24h high", "24h low"].map((label) =>
                  <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-brand-text-muted md:px-6">{t(label)}</th>
                )}
              </tr></thead>
              <tbody>{markets.map((item) => (
                <tr key={item.sym} className="border-b border-brand-border/50 transition-colors last:border-0 hover:bg-brand-surface-hover">
                  <td className="h-16 whitespace-nowrap px-4 py-2 md:px-6">
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={item.sym} className="h-8 w-8" />
                      <div><p className="text-sm font-semibold text-brand-text">{names[item.sym] || item.sym}</p><p className="text-xs text-brand-text-muted">{item.sym}/USDT</p></div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 type-body font-semibold tabular-nums text-brand-text md:px-6">{price(item.price, numberLocale)}</td>
                  <td className="whitespace-nowrap px-4 md:px-6"><Change value={item.chg} /></td>
                  <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{item.vol} USDT</td>
                  <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{price(item.high, numberLocale)}</td>
                  <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{price(item.low, numberLocale)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
